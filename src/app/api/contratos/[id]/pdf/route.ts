import { renderContractPdf } from "@/features/contracts/pdf";
import { contractDocumentName } from "@/features/contracts/share";
import { findContract, readContractFile } from "@/features/contracts/store";
import { pdfResponse } from "@/lib/pdf/response";

/**
 * O contrato em PDF para quem está na aplicação: o documento escrito desenhado no react-pdf, ou o PDF
 * anexado com as assinaturas carimbadas e a página de registro. Um clique e o arquivo desce. Node, porque a
 * fonte é lida do disco e o `pdf-lib` escreve o arquivo inteiro na memória.
 */
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contract, file] = await Promise.all([findContract(id), readContractFile(id)]);
  if (!contract) return new Response("Contrato não encontrado", { status: 404 });
  const bytes = await renderContractPdf(contract, file);
  return pdfResponse(bytes, `${contractDocumentName(contract)}.pdf`);
}
