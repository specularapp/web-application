import { renderContractPdf } from "@/features/contracts/pdf";
import { loadPublicContract, readPublicContractFile } from "@/features/contracts/public";
import { contractDocumentName } from "@/features/contracts/share";
import { pdfResponse } from "@/lib/pdf/response";

/**
 * O contrato em PDF pelo endereço público da parte, com a mesma credencial da página: o token dela. É o
 * arquivo que a cópia assinada por e-mail leva a pessoa a baixar. Quem tem o token tem o documento, então
 * não há uma segunda porta para o mesmo arquivo.
 */
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await loadPublicContract(token);
  if (!found) return new Response("Contrato não encontrado", { status: 404 });

  const file = found.contract.file ? await readPublicContractFile(found.organizationId, found.contract.id) : null;
  const bytes = await renderContractPdf(found.contract, file);

  return pdfResponse(bytes, `${contractDocumentName(found.contract)}.pdf`);
}
