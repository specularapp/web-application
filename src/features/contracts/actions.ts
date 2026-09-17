"use server";

import { headers } from "next/headers";
import { firstIssue, guardAction, revalidateDomain } from "@/features/organizations/context";
import { cacheTags } from "@/lib/cache/tags";
import { getAiModel, getOpenAI } from "@/lib/ai/client";
import { hasAi } from "@/lib/env";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { sendSignatureInviteEmail, sendSignedCopyEmail } from "./emails";
import { contractIdSchema, createContractSchema, rewriteSchema, saveContractSchema, signContractSchema, type RewriteMode } from "./schemas";
import { contractSignUrl } from "./share";
import { cancelContract, createContract, getContract, saveContract, sendContract, signContract } from "./service";
import type { Contract, ContractStatus } from "./summary";

/**
 * As actions do contrato: cada uma valida a entrada com zod, mesmo já validada na tela, porque é assim que
 * toda entrada de usuário chega ao servidor, e chama a regra de `service.ts`, que é a mesma que o Route
 * Handler de `api/v1` usa. A RLS decide o acesso; a página pública entra pela chave secreta, com o token da
 * parte como única credencial.
 */
export type ActionError = { ok: false; error: string; field?: string };

export async function loadContractAction(id: string): Promise<Contract | null> {
  const guard = await guardAction("contract-load");
  if (!guard.ok) return null;

  return getContract(guard.context.supabase, guard.context.organizationId, id);
}

export async function createContractAction(input: unknown): Promise<{ ok: true; id: string } | ActionError> {
  const guard = await guardAction("contract-create");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = createContractSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const created = await createContract(supabase, organizationId, user.id, parsed.data);
  if (!created.ok) return { ok: false, error: created.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.contracts], ["/contratos"]);
  return { ok: true, id: created.data.id };
}

export async function saveContractAction(input: unknown): Promise<{ ok: true; contract: Contract } | ActionError> {
  const guard = await guardAction("contract-save");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = saveContractSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const saved = await saveContract(guard.context.supabase, guard.context.organizationId, parsed.data);
  if (!saved.ok) return saved;

  await revalidateDomain(guard.context.organizationId, [cacheTags.contracts], ["/contratos"]);
  return { ok: true, contract: saved.contract };
}

export type SendActionResult = { ok: true; contract: Contract; emailed: boolean; reminder: boolean } | ActionError;

/**
 * Envia, ou reenvia, o convite de assinatura: um e-mail para cada parte, com o link pessoal dela. O registro
 * fica antes de o e-mail sair, então falha de entrega não desfaz o envio, e `emailed` diz à tela se os
 * e-mails saíram de verdade (sem Resend configurado, não saem).
 */
export async function sendContractAction(input: unknown): Promise<SendActionResult> {
  const guard = await guardAction("contract-send");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = contractIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const result = await sendContract(supabase, organizationId, parsed.data.id, user.fullName ?? user.email ?? "Equipe");
  if (!result.ok) return result;

  const { contract, reminder } = result;
  const issuer = contract.parties.find((party) => party.role === "issuer");
  const deliveries = await Promise.all(
    contract.parties.map((party) =>
      sendSignatureInviteEmail({
        to: party.email,
        name: party.name,
        title: contract.title,
        reference: contract.reference,
        issuerName: issuer?.name ?? contract.owner.name,
        senderName: contract.owner.name,
        url: contractSignUrl(party.token),
        expiresAt: contract.expiresAt,
        reminder,
      }),
    ),
  );

  await revalidateDomain(guard.context.organizationId, [cacheTags.contracts], ["/contratos"]);
  return { ok: true, contract, emailed: deliveries.every(Boolean), reminder };
}

export async function cancelContractAction(input: unknown): Promise<{ ok: true; contract: Contract } | ActionError> {
  const guard = await guardAction("contract-cancel");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = contractIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { supabase, organizationId, user } = guard.context;
  const cancelled = await cancelContract(supabase, organizationId, parsed.data.id, user.fullName ?? user.email ?? "Equipe");
  if (!cancelled.ok) return { ok: false, error: cancelled.error };

  await revalidateDomain(guard.context.organizationId, [cacheTags.contracts], ["/contratos"]);
  return { ok: true, contract: cancelled.data };
}

export type SignActionResult = { ok: true; status: ContractStatus; completed: boolean; emailed: boolean } | ActionError;

/**
 * A assinatura de uma parte pela página pública: o token é a credencial, e quem assina não tem sessão, então
 * o teto de requisições é por endereço de origem. Quando a última parte assina, as duas recebem a cópia
 * assinada por e-mail, cada uma com o próprio link.
 */
export async function signContractAction(input: unknown): Promise<SignActionResult> {
  const parsed = signContractSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const ip = clientIp(await headers());
  const { allowed } = await checkRateLimit("publicLink", `contract-sign:${ip}`, crypto.randomUUID());
  if (!allowed) return { ok: false, error: "Muitas tentativas. Aguarde um instante." };

  const result = await signContract(createAdminClient(), parsed.data.token, {
    name: parsed.data.name,
    signature: parsed.data.signature,
  });
  if (!result.ok) return result;

  let emailed = true;
  if (result.completed) {
    const issuer = result.contract.parties.find((party) => party.role === "issuer");
    const deliveries = await Promise.all(
      result.contract.parties.map((party) =>
        sendSignedCopyEmail({
          to: party.email,
          name: party.name,
          title: result.contract.title,
          reference: result.contract.reference,
          issuerName: issuer?.name ?? result.contract.owner.name,
          url: contractSignUrl(party.token),
        }),
      ),
    );
    emailed = deliveries.every(Boolean);
  }

  await revalidateDomain(result.organizationId, [cacheTags.contracts], ["/contratos"]);
  return { ok: true, status: result.contract.status, completed: result.completed, emailed };
}

const rewriteInstructions: Record<RewriteMode, string> = {
  grammar: "Corrija a gramática, a ortografia e a pontuação do trecho, sem mudar o sentido nem o tom.",
  formal: "Reescreva o trecho em tom formal e jurídico, próprio de contrato de prestação de serviços, sem mudar o sentido.",
  direct: "Reescreva o trecho de forma mais direta e clara, com frases curtas, sem perder nenhuma condição ou obrigação.",
  shorter: "Resuma o trecho mantendo todas as condições, prazos, valores e obrigações, em menos palavras.",
};

/**
 * A reescrita por IA de um trecho do contrato: o trecho selecionado vai para o modelo com a instrução do
 * modo e volta pronto para trocar no lugar. Só texto, sem formatação, e nunca mais que o trecho pedia. Sem
 * chave da OpenAI configurada a action diz isso, e o editor esconde a opção.
 */
export async function rewriteTextAction(input: unknown): Promise<{ ok: true; text: string } | ActionError> {
  const guard = await guardAction("contract-rewrite");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = rewriteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  if (!hasAi()) return { ok: false, error: "A reescrita por IA não está configurada neste ambiente." };

  const { allowed } = await checkRateLimit("ai", `rewrite:${guard.context.user.id}`, crypto.randomUUID());
  if (!allowed) return { ok: false, error: "Muitos pedidos em pouco tempo. Aguarde um instante." };

  try {
    const response = await getOpenAI().chat.completions.create({
      model: getAiModel(),
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Você revisa trechos de contratos de prestação de serviços em português do Brasil. Responda somente com o trecho reescrito, sem aspas, sem comentários e sem formatação Markdown. Preserve nomes, valores, datas e prazos exatamente como estão.",
        },
        { role: "user", content: `${rewriteInstructions[parsed.data.mode]}\n\nTrecho:\n${parsed.data.text}` },
      ],
    });

    const text = response.choices[0]?.message.content?.trim();
    if (!text) return { ok: false, error: "A IA não devolveu texto. Tente de novo." };
    return { ok: true, text };
  } catch (error) {
    console.error("reescrita por IA falhou:", error);
    return { ok: false, error: "Não deu para reescrever agora. Tente de novo em instantes." };
  }
}

export async function aiAvailableAction() {
  return hasAi();
}
