import "server-only";
import { Avatar, Style } from "@dicebear/core";
import adventurer from "@dicebear/styles/adventurer.json";
import { memoizeSvg, stripSvgMetadata } from "@/lib/generated-svg";

/* Só o servidor desenha: quem monta o endereço no cliente usa `svgToken` de `lib/generated-svg.ts`, sem
   trazer o DiceBear para o navegador. Construir o estilo aqui no escopo do módulo é caro e não tem lugar
   no bundle do cliente; o `server-only` garante que ninguém o importe de lá por engano. */
const style = new Style(adventurer);

/**
 * O rosto do Adventurer desenhado a partir do token. SVG gerado em código, sem DOM e sem folha injetada.
 * No DiceBear 10 os `id` internos já saem com um sufixo derivado da semente, então não há mais o que
 * reescrever para o arquivo continuar único; só o `<metadata>` sai.
 */
export const avatarSvg = memoizeSvg((token) => stripSvgMetadata(new Avatar(style, { seed: token }).toString()));
