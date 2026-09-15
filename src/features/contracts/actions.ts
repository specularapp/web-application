"use server";

import { getAiModel, getOpenAI } from "@/lib/ai/client";
import { hasAi } from "@/lib/env";
import { sendSignatureInviteEmail, sendSignedCopyEmail } from "./emails";
import { contractIdSchema, createContractSchema, rewriteSchema, saveContractSchema, signContractSchema, type RewriteMode } from "./schemas";
import { contractSignUrl } from "./share";
import { cancelContract, createContract, findContract, saveContract, sendContract, signContract } from "./store";
import type { Contract, ContractStatus } from "./summary";

/**
 * As actions do contrato: cada uma valida a entrada com zod, mesmo já validada na tela, porque é assim que
 * toda entrada de usuário chega ao servidor, e chama a regra do store. Hoje o store é a memória do servidor,
 * porque **o domínio não existe no banco**; com a tabela, a regra vai para `service.ts`, com a RLS valendo,
 * e as mesmas funções ganham um Route Handler em `api/v1` para o aplicativo.
 */

const INVALID = "Confira os dados informados.";

export type ActionError = { ok: false; error: string; field?: string };

function invalid(issues: { path: PropertyKey[]; message: string }[]): ActionError {
  const issue = issues[0];
  const field = issue?.path.join(".");
  return { ok: false, error: issue?.message ?? INVALID, field: field || undefined };
}

export async function loadContractAction(id: string): Promise<Contract | null> {
  return findContract(id);
}

export async function createContractAction(input: unknown): Promise<{ ok: true; id: string } | ActionError> {
  const parsed = createContractSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const contract = await createContract(parsed.data);
  return { ok: true, id: contract.id };
}

export async function saveContractAction(input: unknown): Promise<{ ok: true; contract: Contract } | ActionError> {
  const parsed = saveContractSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const result = await saveContract(parsed.data);
  return result.ok ? { ok: true, contract: result.contract } : result;
}

export type SendActionResult = { ok: true; contract: Contract; emailed: boolean; reminder: boolean } | ActionError;

/**
 * Envia, ou reenvia, o convite de assinatura: um e-mail para cada parte, com o link pessoal dela. O registro
 * fica antes de o e-mail sair, então falha de entrega não desfaz o envio, e `emailed` diz à tela se os
 * e-mails saíram de verdade (sem Resend configurado, não saem).
 */
export async function sendContractAction(input: unknown): Promise<SendActionResult> {
  const parsed = contractIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const result = await sendContract(parsed.data.id);
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

  return { ok: true, contract, emailed: deliveries.every(Boolean), reminder };
}

export async function cancelContractAction(input: unknown): Promise<{ ok: true; contract: Contract } | ActionError> {
  const parsed = contractIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  return cancelContract(parsed.data.id);
}

export type SignActionResult = { ok: true; status: ContractStatus; completed: boolean; emailed: boolean } | ActionError;

/**
 * A assinatura de uma parte pela página pública: o token é a credencial. Quando a última parte assina, as
 * duas recebem a cópia assinada por e-mail, cada uma com o próprio link, onde o PDF final fica para baixar.
 */
export async function signContractAction(input: unknown): Promise<SignActionResult> {
  const parsed = signContractSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const result = await signContract(parsed.data.token, { name: parsed.data.name, signature: parsed.data.signature });
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

  return { ok: true, status: result.contract.status, completed: result.completed, emailed };
}

const rewriteInstructions: Record<RewriteMode, string> = {
  grammar: "Corrija a gramática, a ortografia e a pontuação do trecho, sem mudar o sentido nem o tom.",
  formal: "Reescreva o trecho em tom formal e jurídico, próprio de contrato de prestação de serviços, sem mudar o sentido.",
  direct: "Reescreva o trecho de forma mais direta e clara, com frases curtas, sem perder nenhuma condição ou obrigação.",
  shorter: "Resuma o trecho mantendo todas as condições, prazos, valores e obrigações, em menos palavras.",
};

/**
 * A reescrita por IA de um trecho do contrato (sobre a referência de editor de notas do usuário, o menu
 * "Rewrite"): o trecho selecionado vai para o modelo com a instrução do modo e volta pronto para trocar no
 * lugar. Só texto, sem formatação, e nunca mais que o trecho pedia. Sem chave da OpenAI configurada a
 * action diz isso, e o editor esconde a opção.
 */
export async function rewriteTextAction(input: unknown): Promise<{ ok: true; text: string } | ActionError> {
  const parsed = rewriteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!hasAi()) return { ok: false, error: "A reescrita por IA não está configurada neste ambiente." };

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
