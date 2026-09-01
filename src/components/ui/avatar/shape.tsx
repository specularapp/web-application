"use client";

import Avvvatars from "avvvatars-react";
import type { AvatarSize } from "./index";

type AvatarShapeProps = {
  seed: string;
  initials: string;
  size: AvatarSize;
};

const pixels: Record<AvatarSize, number> = { xs: 24, sm: 36, md: 44, lg: 52 };

// O raio e o recorte ficam com o invólucro, que já tem overflow escondido para a foto: assim círculo
// e squircle continuam saindo de um lugar só, e a lib só entrega cor e letra.
export function AvatarShape({ seed, initials, size }: AvatarShapeProps) {
  return <Avvvatars value={seed} displayValue={initials} size={pixels[size]} radius={0} shadow={false} border={false} />;
}
