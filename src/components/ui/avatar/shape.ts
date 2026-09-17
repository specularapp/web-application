import "server-only";
import { Avatar, Style } from "@dicebear/core";
import lorelei from "@dicebear/styles/lorelei.json";
import { memoizeSvg, stripSvgMetadata } from "@/lib/generated-svg";

/* Só o servidor desenha: quem monta o endereço no cliente usa `svgToken` de `lib/generated-svg.ts`, sem
   trazer o DiceBear para o navegador. Construir o estilo aqui no escopo do módulo é caro e não tem lugar
   no bundle do cliente; o `server-only` garante que ninguém o importe de lá por engano. */
const style = new Style(lorelei);

/**
 * O rosto do Lorelei desenhado a partir do token (2026-09-16, a pedido, sobre a página do estilo): traço
 * fino e desenhado à mão, que é o que casa com a tipografia e o fio fino da casa; o Adventurer, que esteve
 * em uso de 2026-09-05 até aqui, é mais cheio e roubava atenção numa lista de quarenta rostos.
 *
 * SVG gerado em código, sem DOM e sem folha injetada. No DiceBear 10 os `id` internos já saem com um
 * sufixo derivado da semente, então não há mais o que reescrever para o arquivo continuar único; só o
 * `<metadata>` sai.
 */
export const avatarSvg = memoizeSvg((token) => stripSvgMetadata(new Avatar(style, { seed: token }).toString()));
