import type { CSSProperties } from "react";
import { StoredImage } from "@/components/ui/stored-image";
import { cx } from "@/lib/utils/cx";
import { squircle } from "@/lib/corners";
import { catalogArtworkUrl } from "../list-options";
import type { CatalogItem } from "../summary";
import styles from "./catalog-artwork.module.css";

export type CatalogArtworkSize = "sm" | "md" | "lg";

export type CatalogArtworkProps = {
  item: Pick<CatalogItem, "id" | "name" | "imageUrl" | "hue">;
  size?: CatalogArtworkSize;
  className?: string;
};

/* Lado em pixels de cada tamanho, para a imagem declarar largura e altura e o layout não pular. */
const pixelSizes: Record<CatalogArtworkSize, number> = { sm: 32, md: 40, lg: 52 };

// A imagem de um item do catálogo num azulejo tingido no matiz dele: a foto quando há, e a arte gerada
// pelo DiceBear no estilo Icons quando não há, com o ícone no mesmo matiz. É o que a pessoa varre com o
// olho na grade antes de ler o nome, e o mesmo desenho aparece na ficha, maior.
//
// A arte vem da rota, e não embutida, pelo mesmo motivo do rosto do avatar: é um arquivo com cache de um
// ano, e o mesmo item em cinco lugares custa uma requisição. `<img>` cru para o SVG, como no avatar: o
// otimizador não mexe em SVG sem `dangerouslyAllowSVG`. A foto do item é nossa, do armazenamento, então
// passa pelo otimizador: quem decide isso é o `StoredImage`.
export function CatalogArtwork({ item, size = "md", className }: CatalogArtworkProps) {
  const side = pixelSizes[size];

  return (
    <span
      className={cx(styles.artwork, className)}
      data-size={size}
      style={{ "--item-hue": `var(--sys-${item.hue})` } as CSSProperties}
      aria-hidden="true"
      {...squircle(size === "lg" ? "lg" : size === "sm" ? "sm" : "md")}
    >
      {item.imageUrl ? (
        <StoredImage src={item.imageUrl} alt="" width={side} height={side} className={styles.photo} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={catalogArtworkUrl(item)} alt="" width={side} height={side} loading="lazy" decoding="async" className={styles.art} />
      )}
    </span>
  );
}
