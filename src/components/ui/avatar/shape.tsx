import { createAvatar } from "@dicebear/core";
import * as lorelei from "@dicebear/lorelei";
import { hashString } from "@/lib/utils/hash";
import styles from "./avatar.module.css";

type AvatarShapeProps = { seed: string };

const MASK_ID = "viewboxMask";

// Rosto do Lorelei desenhado a partir da semente: SVG gerado em código, sem DOM, então sai igual no
// servidor e no cliente, sem folha injetada nem nonce. O único `id` do SVG é reescrito com o hash da
// semente, porque a mesma máscara em vários avatares na página colidiria e o `randomizeIds` da lib usa
// Math.random, que discordaria na hidratação. O `<metadata>` sai para não pesar em cada avatar.
export function AvatarShape({ seed }: AvatarShapeProps) {
  const maskId = `sp-${hashString(seed).toString(36)}`;
  const svg = createAvatar(lorelei, { seed })
    .toString()
    .replace(/<metadata[\s\S]*?<\/metadata>/, "")
    .replaceAll(MASK_ID, maskId);

  return <span className={styles.shape} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}
