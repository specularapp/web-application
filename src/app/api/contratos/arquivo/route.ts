import { PDFDocument } from "pdf-lib";
import { contractLimits } from "@/features/contracts/schemas";
import { createPdfContract } from "@/features/contracts/service";
import { requireOrganization } from "@/features/organizations/context";
import { checkRateLimit } from "@/lib/security/rate-limit";

/**
 * O PDF anexado sobe por aqui, em `multipart/form-data`, e não por Server Action: a action tem teto de 1 MB
 * no corpo e um contrato escaneado passa disso com folga. A rota lê o arquivo, confere tipo e tamanho, conta
 * as páginas (o que também prova que é um PDF de verdade) e cria o rascunho com a origem `pdf`, devolvendo o
 * id para o editor de campos abrir. Os bytes vão para o balde `contract-files` do Storage, e o contrato
 * guarda só o caminho. Node, porque o `pdf-lib` lê o arquivo inteiro na memória.
 */
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const { supabase, organizationId, user } = await requireOrganization("/contratos");

  const { allowed } = await checkRateLimit("action", `contract-upload:${user.id}`, crypto.randomUUID());
  if (!allowed) return Response.json({ error: "Muitos envios em pouco tempo. Aguarde um instante." }, { status: 429 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("arquivo");
  if (!(file instanceof File)) return Response.json({ error: "Envie um arquivo PDF." }, { status: 400 });
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return Response.json({ error: "O arquivo precisa ser um PDF." }, { status: 400 });
  }
  if (file.size > contractLimits.file) {
    return Response.json({ error: "O PDF passa de 10 MB. Envie um arquivo menor." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let pages = 0;
  try {
    pages = (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount();
  } catch {
    return Response.json({ error: "Não deu para ler esse PDF. Tente exportar o arquivo de novo." }, { status: 400 });
  }
  if (pages === 0) return Response.json({ error: "O PDF está vazio." }, { status: 400 });

  /* O cliente vem junto quando o contrato nasce da ficha dele, pelas três origens igualmente: anexar um PDF
     não é motivo para a pessoa ter de escolher de novo quem ela acabou de abrir. */
  const cliente = form?.get("cliente");
  const clientId = typeof cliente === "string" && UUID.test(cliente) ? cliente : undefined;

  const created = await createPdfContract(supabase, organizationId, user.id, { name: file.name, bytes, pages, clientId });
  if (!created.ok) return Response.json({ error: created.error }, { status: 400 });

  return Response.json({ id: created.data.id, pages });
}
