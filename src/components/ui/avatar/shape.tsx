import { createAvatar } from "@dicebear/core";
import * as adventurer from "@dicebear/adventurer";
import { hashString } from "@/lib/utils/hash";
import styles from "./avatar.module.css";

type AvatarShapeProps = { seed: string };

const MASK_ID = "viewboxMask";
const CACHE_LIMIT = 200;

/* Desenhar o rosto custa CPU no servidor, e a mesma semente aparece várias vezes por página (a pessoa
   no cabeçalho, no menu, nos blocos). O SVG pronto fica em cache por semente, com teto para não crescer
   sem fim num processo longo. */
const cache = new Map<string, string>();

function shapeFor(seed: string) {
  const cached = cache.get(seed);
  if (cached) return cached;
  const maskId = `sp-${hashString(seed).toString(36)}`;
  const svg = createAvatar(adventurer, { seed })
    .toString()
    .replace(/<metadata[\s\S]*?<\/metadata>/, "")
    .replaceAll(MASK_ID, maskId);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(seed, svg);
  return svg;
}

// Rosto do Adventurer desenhado a partir da semente: SVG gerado em código, sem DOM, então sai igual no
// servidor e no cliente, sem folha injetada nem nonce. O único `id` do SVG é reescrito com o hash da
// semente, porque a mesma máscara em vários avatares na página colidiria e o `randomizeIds` da lib usa
// Math.random, que discordaria na hidratação. O `<metadata>` sai para não pesar em cada avatar.
export function AvatarShape({ seed }: AvatarShapeProps) {
  return <span className={styles.shape} aria-hidden="true" dangerouslySetInnerHTML={{ __html: shapeFor(seed) }} />;
}
