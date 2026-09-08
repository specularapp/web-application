import Image from "next/image";
import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { squircleAuto } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import { hashString } from "@/lib/utils/hash";
import styles from "./avatar.module.css";
import { avatarToken } from "./shape";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

export type AvatarShapeName = "circle" | "squircle" | "hexagon";

export type AvatarProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  name: string;
  src?: string;
  seed?: string;
  size?: AvatarSize;
  shape?: AvatarShapeName;
};

const imageSizes: Record<AvatarSize, string> = { xs: "24px", sm: "36px", md: "44px", lg: "52px" };

/* Lado em pixels de cada tamanho, para o `<img>` do rosto gerado declarar largura e altura e não deixar
   o layout pular antes de o arquivo chegar. O CSS continua mandando no tamanho de verdade. */
const pixelSizes: Record<AvatarSize, number> = { xs: 24, sm: 36, md: 44, lg: 52 };

/* Fundo do rosto desenhado: um matiz da paleta do sistema escolhido pela semente, então a mesma pessoa
   tem sempre a mesma cor e duas pessoas lado a lado quase nunca repetem. */
const hues = ["red", "orange", "yellow", "green", "mint", "teal", "cyan", "blue", "indigo", "purple", "pink", "brown"];

/** O nome do matiz da paleta do sistema que a semente escolhe, para pintar outra coisa com a cor da pessoa. */
export function avatarHue(seed: string) {
  return hues[hashString(seed) % hues.length];
}

export function Avatar({ name, src, seed, size = "md", shape = "circle", className, style, ...props }: AvatarProps) {
  const key = seed ?? name;
  const hue = avatarHue(key);
  const vars = { ...style, ...(!src && { "--avatar-hue": `var(--sys-${hue})` }) } as CSSProperties;

  return (
    <span
      role="img"
      aria-label={name}
      className={cx(styles.avatar, className)}
      data-size={size}
      data-shape={shape}
      data-generated={src ? undefined : ""}
      style={vars}
      {...(shape === "squircle" && squircleAuto())}
      {...props}
    >
      {src ? (
        <Image src={src} alt="" fill sizes={imageSizes[size]} className={styles.image} />
      ) : (
        /* O rosto gerado vem da rota, e não embutido: o SVG do Adventurer tem uns 11 KB, ia inteiro na
           marcação e de novo na carga do RSC, e uma página com quarenta avatares carregava mais de um
           mega só disso. Pela rota ele é um arquivo com cache de um ano, então a mesma pessoa em cinco
           lugares custa uma requisição, e nas próximas visitas custa zero.

           `<img>` cru, e não `next/image`: o otimizador não mexe em SVG sem `dangerouslyAllowSVG`, que
           é rebaixar a segurança para não ganhar nada. É o desvio consciente da regra de imagens. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/avatar/${avatarToken(key)}.svg`}
          alt=""
          width={pixelSizes[size]}
          height={pixelSizes[size]}
          loading="lazy"
          decoding="async"
          className={styles.shape}
        />
      )}
    </span>
  );
}

export type AvatarGroupProps = ComponentPropsWithoutRef<"span">;

export function AvatarGroup({ className, ...props }: AvatarGroupProps) {
  return <span className={cx(styles.group, className)} {...props} />;
}
