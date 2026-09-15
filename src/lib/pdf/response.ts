/**
 * A resposta HTTP de um PDF, a mesma para toda rota que entrega arquivo: o tipo, o nome do arquivo com acento
 * pelo `filename*` e sem acento na reserva, o tamanho e o cache privado, porque documento é de quem o recebe
 * e não do buscador nem da borda.
 */

/* O nome do arquivo tem acento e vírgula, e cabeçalho HTTP é ASCII: o `filename*` leva o nome de verdade em
   UTF-8, que é o que todo navegador atual lê, e o `filename` fica como reserva sem acento para o resto. */
function contentDisposition(kind: "attachment" | "inline", name: string) {
  const plain = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["\\]/g, "")
    .replace(/[^\x20-\x7e]/g, "");
  return `${kind}; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export function pdfResponse(file: Uint8Array, name: string, kind: "attachment" | "inline" = "attachment") {
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(kind, name),
      "Content-Length": String(file.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
