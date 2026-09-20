import Image, { type ImageProps } from "next/image";
import { isStoredImage } from "@/lib/images/stored";

/**
 * A imagem que a pessoa enviou, desenhada pelo otimizador do Next quando ele pode tratá-la (2026-09-20, na
 * rodada de peso de imagem). Antes cada tela que mostrava rosto, logo ou capa passava `unoptimized` fixo,
 * com a mesma justificativa copiada em quatro arquivos: "vem de fora e sem domínio para liberar". Isso valia
 * quando a logo era um endereço qualquer da internet; desde que o armazenamento nasceu a imagem é nossa, o
 * host está liberado em `remotePatterns`, e passar reto do otimizador significava baixar mil e quinhentos
 * pixels para desenhar quarenta.
 *
 * Quem decide é o endereço, e não a tela: arquivo do nosso balde vai pelo otimizador, que corta na medida do
 * `sizes` e entrega WebP com cache longo; qualquer outro (um `blob:` de prévia, um endereço externo que
 * tenha entrado na coluna) segue cru, porque para esse o otimizador devolveria 400 e a imagem sumiria.
 *
 * Server Component: é desenho parado, e assim ele serve tanto a tela de servidor quanto a de cliente.
 */
export function StoredImage({ src, alt, ...props }: ImageProps) {
  return <Image src={src} alt={alt} unoptimized={typeof src === "string" && !isStoredImage(src)} {...props} />;
}
