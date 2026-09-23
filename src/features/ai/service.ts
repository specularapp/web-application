import "server-only";
import { dbMessage } from "@/lib/db/message";
import { addMonths, format, startOfMonth } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { planLimit } from "@/features/billing/service";
import { getAiModel, getOpenAI } from "@/lib/ai/client";
import { createAdminClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils/format";
import type { Database } from "@/types/database";
import type { AiConversation, AiMessage, AiReply, AiSource } from "./conversation";
import { aiTitle } from "./conversation";
import type { AiScopeId } from "./scope";
import type { AiUsage } from "./summary";

/**
 * A regra do assistente contra o banco e contra o modelo. A conversa é de quem a teve, e não da equipe: ela
 * costuma citar cliente, valor e prazo, e um time de dez não precisa ler a pergunta que o outro fez. O que a
 * resposta pode ler é a conta de quem pergunta, filtrada pelas fontes escolhidas, e sempre com a RLS
 * valendo: o contexto é montado com o cliente da sessão, então o modelo nunca vê o que a pessoa não veria.
 */
export type AiClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Quantas ações de IA o plano gratuito dá por ciclo, quando o plano não declara teto próprio. */
const FREE_LIMIT = 50;

/** Quantos registros de cada fonte entram no contexto: o bastante para responder sem estourar o pedido. */
const PER_SOURCE = 25;

/** O teto de caracteres do contexto que vai ao modelo, para uma conta grande não virar um pedido enorme. */
const CONTEXT_LIMIT = 24_000;

const SYSTEM_PROMPT = `Você é o assistente do Specular, um sistema de gestão para freelancers e pequenas agências.
Responda sempre em português brasileiro, direto e objetivo, sem rodeios e sem elogiar a pergunta.
Use apenas os dados do contexto fornecido; quando algo não estiver lá, diga que não consta em vez de supor.
Formate com parágrafos curtos; use listas com "- " quando houver mais de dois itens e **negrito** para
identificadores e valores. Nunca invente número, data, nome ou identificador.
Valores monetários já vêm formatados em reais: repita-os como estão.`;

export async function getAiUsage(client: AiClient, organizationId: string): Promise<AiUsage> {
  const period = startOfMonth(new Date());
  const [{ data }, limit] = await Promise.all([
    client
      .from("ai_usage")
      .select("used")
      .eq("organization_id", organizationId)
      .eq("period_start", format(period, "yyyy-MM-dd"))
      .maybeSingle(),
    planLimit(client, organizationId, "ai_actions"),
  ]);

  return {
    used: data?.used ?? 0,
    limit: limit ?? FREE_LIMIT,
    renewsAt: format(addMonths(period, 1), "yyyy-MM-dd"),
  };
}

type ConversationRow = {
  id: string;
  title: string;
  updated_at: string;
  ai_messages: {
    id: string;
    role: "person" | "assistant";
    content: string;
    files: AiMessage["files"];
    sources: AiSource[];
    steps: string[];
    voice_url: string | null;
    voice_seconds: number | null;
    state: AiMessage["state"];
    created_at: string;
  }[];
};

function toConversation(row: ConversationRow): AiConversation {
  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    messages: [...row.ai_messages]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((message) => ({
        id: message.id,
        role: message.role,
        text: message.content,
        files: message.files?.length ? message.files : undefined,
        sources: message.sources?.length ? message.sources : undefined,
        steps: message.steps?.length ? message.steps : undefined,
        voice: message.voice_url && message.voice_seconds ? { url: message.voice_url, seconds: message.voice_seconds } : undefined,
        state: message.state ?? undefined,
      })),
  };
}

export async function listConversations(client: AiClient, userId: string, limit = 50): Promise<AiConversation[]> {
  const { data } = await client
    .from("ai_conversations")
    .select("id, title, updated_at, ai_messages(id, role, content, files, sources, steps, voice_url, voice_seconds, state, created_at)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as ConversationRow[]).map(toConversation);
}

export async function deleteConversation(client: AiClient, userId: string, id: string): Promise<ServiceResult<undefined>> {
  const { error } = await client.from("ai_conversations").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: dbMessage(error, "Não foi possível concluir a operação. Tente de novo em instantes.") };
  return { ok: true, data: undefined };
}

export async function renameConversation(
  client: AiClient,
  userId: string,
  id: string,
  title: string,
): Promise<ServiceResult<undefined>> {
  const { error } = await client.from("ai_conversations").update({ title }).eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: dbMessage(error, "Não foi possível concluir a operação. Tente de novo em instantes.") };
  return { ok: true, data: undefined };
}

/**
 * O que a resposta pode ler, por fonte. A leitura passa pelo cliente da sessão, então a RLS decide o que
 * entra: o modelo nunca vê o que a pessoa não veria na tela. Cada fonte vira um bloco curto de texto, e não
 * JSON cru, porque o modelo lê melhor a linha escrita e o pedido fica menor.
 */
async function contextFor(
  client: AiClient,
  organizationId: string,
  scope: readonly AiScopeId[],
): Promise<{ text: string; sources: AiSource[] }> {
  const blocks: string[] = [];
  const sources: AiSource[] = [];
  const wanted = new Set(scope);

  if (wanted.has("clientes")) {
    const { data } = await client
      .from("clients")
      .select("reference, name, company, email, phone, city, active")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE);

    if (data?.length) {
      sources.push({ id: "clientes", label: "Clientes" });
      blocks.push(
        `## Clientes (${data.length})\n` +
          data.map((row) => `- ${row.reference} ${row.name}${row.company ? ` (${row.company})` : ""}${row.city ? `, ${row.city}` : ""}${row.active ? "" : " [inativo]"}`).join("\n"),
      );
    }
  }

  if (wanted.has("crm")) {
    const { data } = await client
      .from("opportunities")
      .select("reference, title, client_name, stage, value, temperature, probability, expected_at, last_touch_at")
      .eq("organization_id", organizationId)
      .order("stage_since", { ascending: false })
      .limit(PER_SOURCE);

    if (data?.length) {
      sources.push({ id: "crm", label: "Funil de vendas" });
      blocks.push(
        `## Oportunidades (${data.length})\n` +
          data
            .map(
              (row) =>
                `- ${row.reference} ${row.title}, ${row.client_name}, etapa ${row.stage}, ${formatMoney(row.value)}, ${row.probability}% de chance${row.expected_at ? `, previsão ${row.expected_at}` : ""}${row.last_touch_at ? `, último contato ${row.last_touch_at}` : ""}`,
            )
            .join("\n"),
      );
    }
  }

  if (wanted.has("orcamentos")) {
    const { data } = await client
      .from("quotes")
      .select("reference, title, client_name, status, issued_at, valid_until, sent_at, viewed_at, discount_kind, discount_value, quote_lines(quantity, unit_price, courtesy)")
      .eq("organization_id", organizationId)
      .order("issued_at", { ascending: false })
      .limit(PER_SOURCE);

    if (data?.length) {
      sources.push({ id: "orcamentos", label: "Orçamentos" });
      blocks.push(
        `## Orçamentos (${data.length})\n` +
          data
            .map((row) => {
              const total = (row.quote_lines ?? []).reduce(
                (sum, line) => sum + (line.courtesy === "no" ? Math.round(Number(line.quantity) * line.unit_price) : 0),
                0,
              );
              return `- ${row.reference} ${row.title}, ${row.client_name}, ${row.status}, ${formatMoney(total)}, emitido ${row.issued_at}${row.sent_at ? `, enviado ${row.sent_at.slice(0, 10)}` : ""}${row.viewed_at ? ", já aberto pelo cliente" : ""}`;
            })
            .join("\n"),
      );
    }
  }

  if (wanted.has("contratos")) {
    const { data } = await client
      .from("contracts")
      .select("reference, title, status, amount, sent_at, signed_at, expires_at, clients(name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE);

    if (data?.length) {
      sources.push({ id: "contratos", label: "Contratos" });
      blocks.push(
        `## Contratos (${data.length})\n` +
          data
            .map(
              (row) =>
                `- ${row.reference} ${row.title}${row.clients ? `, ${row.clients.name}` : ""}, ${row.status}${row.amount !== null ? `, ${formatMoney(row.amount)}` : ""}${row.expires_at ? `, prazo ${row.expires_at.slice(0, 10)}` : ""}`,
            )
            .join("\n"),
      );
    }
  }

  if (wanted.has("projetos")) {
    const { data } = await client
      .from("projects")
      .select("reference, name, status, progress, started_at, due_at, clients(name)")
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false })
      .limit(PER_SOURCE);

    if (data?.length) {
      sources.push({ id: "projetos", label: "Projetos" });
      blocks.push(
        `## Projetos (${data.length})\n` +
          data
            .map(
              (row) =>
                `- ${row.reference} ${row.name}${row.clients ? `, ${row.clients.name}` : ""}, ${row.status}, ${row.progress}%${row.due_at ? `, entrega ${row.due_at}` : ""}`,
            )
            .join("\n"),
      );
    }
  }

  if (wanted.has("tarefas")) {
    const { data } = await client
      .from("tasks")
      .select("reference, title, priority, due_date, projects(name), task_stages!inner(name, kind)")
      .eq("organization_id", organizationId)
      .neq("task_stages.kind", "done")
      .order("due_date")
      .limit(PER_SOURCE);

    if (data?.length) {
      sources.push({ id: "tarefas", label: "Tarefas" });
      blocks.push(
        `## Tarefas em aberto (${data.length})\n` +
          data
            .map((row) => `- ${row.reference} ${row.title}${row.projects ? `, ${row.projects.name}` : ""}, ${row.task_stages.name}, prioridade ${row.priority}, prazo ${row.due_date}`)
            .join("\n"),
      );
    }
  }

  if (wanted.has("financeiro")) {
    const [{ data: charges }, { data: installments }] = await Promise.all([
      client
        .from("charges")
        .select("reference, title, client_name, amount, sent_at, cancelled_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE),
      client
        .from("charge_installments")
        .select("number, amount, due_date, reported, charges!inner(reference, client_name, cancelled_at)")
        .eq("organization_id", organizationId)
        .is("paid_at", null)
        .order("due_date")
        .limit(PER_SOURCE),
    ]);

    if (charges?.length || installments?.length) {
      sources.push({ id: "financeiro", label: "Financeiro" });
      const parts: string[] = [];
      if (charges?.length) {
        parts.push(
          `### Cobranças (${charges.length})\n` +
            charges.map((row) => `- ${row.reference} ${row.title}, ${row.client_name}, ${formatMoney(row.amount)}${row.cancelled_at ? " [cancelada]" : ""}`).join("\n"),
        );
      }
      if (installments?.length) {
        parts.push(
          `### Parcelas em aberto (${installments.length})\n` +
            installments
              .filter((row) => !row.charges.cancelled_at)
              .map((row) => `- ${row.charges.reference} parcela ${row.number}, ${row.charges.client_name}, ${formatMoney(row.amount)}, vence ${row.due_date}${row.reported ? ", cliente avisou que pagou" : ""}`)
              .join("\n"),
        );
      }
      blocks.push(`## Financeiro\n${parts.join("\n\n")}`);
    }
  }

  return { text: blocks.join("\n\n").slice(0, CONTEXT_LIMIT), sources };
}

/** Os passos que a tela mostra antes da primeira palavra, escritos pelas fontes que a resposta leu. */
function stepsFor(sources: AiSource[]) {
  if (sources.length === 0) return ["Procurando na sua conta"];
  return [`Lendo ${sources.map((source) => source.label.toLowerCase()).join(", ")}`, "Montando a resposta"];
}

export type AskInput = {
  question: string;
  scope: readonly AiScopeId[];
  /** Nulo abre conversa nova; com id, continua a que já existe. */
  conversationId: string | null;
  /** As últimas trocas da conversa, para a resposta manter o fio. */
  history: readonly { role: "person" | "assistant"; text: string }[];
};

export type AskResult = { ok: true; conversationId: string; reply: AiReply; usage: AiUsage } | { ok: false; error: string };

/**
 * Uma pergunta ao assistente: confere o teto do plano, monta o contexto da conta, chama o modelo e grava a
 * conversa. O consumo é somado **antes** da chamada, pela função do banco com a chave secreta: somar depois
 * deixaria uma resposta cara passar de graça quando o pedido falhasse no meio.
 */
export async function ask(
  client: AiClient,
  organizationId: string,
  userId: string,
  input: AskInput,
): Promise<AskResult> {
  const usage = await getAiUsage(client, organizationId);
  if (usage.used >= usage.limit) {
    return { ok: false, error: "As ações de IA do plano acabaram neste ciclo. Mude de plano para continuar." };
  }

  const admin = createAdminClient();
  const { data: used } = await admin.rpc("consume_ai_credit", { p_organization_id: organizationId, p_amount: 1 });

  const context = await contextFor(client, organizationId, input.scope);

  let text: string;
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: getAiModel(),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: context.text ? `Dados da conta:\n\n${context.text}` : "A conta ainda não tem dados cadastrados." },
        ...input.history.slice(-8).map((entry) => ({
          role: entry.role === "person" ? ("user" as const) : ("assistant" as const),
          content: entry.text,
        })),
        { role: "user", content: input.question },
      ],
    });

    text = completion.choices[0]?.message?.content?.trim() || "Não consegui montar a resposta agora. Tente de novo em instantes.";
  } catch {
    return { ok: false, error: "O assistente não respondeu agora. Tente de novo em instantes." };
  }

  const conversationId = await persist(client, organizationId, userId, input, text, context.sources);

  return {
    ok: true,
    conversationId,
    reply: { text, sources: context.sources, steps: stepsFor(context.sources) },
    usage: { ...usage, used: used ?? usage.used + 1 },
  };
}

/** Grava a pergunta e a resposta, abrindo a conversa quando ela ainda não existe. */
async function persist(
  client: AiClient,
  organizationId: string,
  userId: string,
  input: AskInput,
  answer: string,
  sources: AiSource[],
) {
  let conversationId = input.conversationId;

  if (conversationId) {
    await client.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", userId);
  } else {
    const { data } = await client
      .from("ai_conversations")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        title: aiTitle([{ id: "nova", role: "person", text: input.question }]).slice(0, 200),
      })
      .select("id")
      .single();

    conversationId = data?.id ?? null;
  }

  if (!conversationId) return "";

  await client.from("ai_messages").insert([
    { organization_id: organizationId, conversation_id: conversationId, role: "person", content: input.question },
    {
      organization_id: organizationId,
      conversation_id: conversationId,
      role: "assistant",
      content: answer,
      sources,
      steps: stepsFor(sources),
      state: "done",
    },
  ]);

  return conversationId;
}
