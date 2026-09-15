import { PDFDocument } from "pdf-lib";
import { createPdfContract } from "@/features/contracts/store";
import { contractLimits } from "@/features/contracts/schemas";

/**
 * O PDF anexado sobe por aqui, em `multipart/form-data`, e não por Server Action: a action tem teto de 1 MB
 * no corpo e um contrato escaneado passa disso com folga. A rota lê o arquivo, confere tipo e tamanho, conta
 * as páginas (o que também prova que é um PDF de verdade) e cria o rascunho com a origem `pdf`, devolvendo o
 * id para o editor de campos abrir. Node, porque o `pdf-lib` lê o arquivo inteiro na memória.
 *
 * Hoje o arquivo fica na memória do servidor, junto do store; com o banco, os bytes vão para o Storage e o
 * contrato guarda o caminho, na mesma rota.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("arquivo");
  if (!(file instanceof File)) return Response.json({ error: "Envie um arquivo PDF." }, { status: 400 });
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return Response.json({ error: "O arquivo precisa ser um PDF." }, { status: 400 });
  if (file.size > contractLimits.file) return Response.json({ error: "O PDF passa de 10 MB. Envie um arquivo menor." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  let pages = 0;
  try {
    pages = (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount();
  } catch {
    return Response.json({ error: "Não deu para ler esse PDF. Tente exportar o arquivo de novo." }, { status: 400 });
  }
  if (pages === 0) return Response.json({ error: "O PDF está vazio." }, { status: 400 });

  const contract = await createPdfContract({ name: file.name, bytes, pages });
  return Response.json({ id: contract.id, pages });
}
