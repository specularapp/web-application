import { findContract, readContractFile } from "@/features/contracts/store";
import { pdfResponse } from "@/lib/pdf/response";

/**
 * O PDF anexado, como subiu, para o editor de campos e a janela do contrato desenharem as páginas no
 * navegador. `inline`, porque é para ver, e não para baixar; o arquivo assinado, com os carimbos, sai pela
 * rota `pdf` ao lado.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contract, file] = await Promise.all([findContract(id), readContractFile(id)]);
  if (!contract?.file || !file) return new Response("Arquivo não encontrado", { status: 404 });
  return pdfResponse(file, contract.file.name, "inline");
}
