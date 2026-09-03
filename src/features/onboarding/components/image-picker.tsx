"use client";

import { CloudArrowUpIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import type { ReactNode } from "react";
import { Text } from "@/components/ui/text";
import { LOGO_MAX_BYTES } from "@/features/organizations/schemas";
import { cx } from "@/lib/utils/cx";
import styles from "./onboarding.module.css";

/* Banner e logo formam um conjunto: a logo é absoluta dentro deste bloco e senta na borda de baixo
   do banner, que transborda para fora. Quem monta o par usa este agrupador, e não uma div própria,
   senão cada tela repete as medidas e elas saem de sincronia. */
export function ImageGroup({ children }: { children: ReactNode }) {
  return <div className={styles.identity}>{children}</div>;
}

type ImagePickerProps = {
  variant: "banner" | "logo";
  label: string;
  hint: string;
  preview: string | null;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onReject: (message: string) => void;
};

const accept = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};

const sizes = {
  banner: "(max-width: 40rem) 100vw, 32rem",
  logo: "(max-width: 40rem) 4.5rem, 6rem",
};

export function ImagePicker({ variant, label, hint, preview, disabled = false, onSelect, onReject }: ImagePickerProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxSize: LOGO_MAX_BYTES,
    multiple: false,
    disabled,
    onDrop: (accepted, rejected) => {
      const file = accepted[0];
      if (file) {
        onSelect(file);
        return;
      }
      const code = rejected[0]?.errors[0]?.code;
      if (code === "file-too-large") onReject("A imagem precisa ter no máximo 2 MB");
      else if (code) onReject("Envie a imagem em PNG, JPG ou WEBP");
    },
  });

  return (
    <div
      {...getRootProps({
        className: cx(styles.target, variant === "banner" ? styles.banner : styles.logo),
        role: "button",
        "aria-label": preview ? `Trocar ${label}` : `Enviar ${label}`,
      })}
      data-active={isDragActive || undefined}
      data-filled={preview ? "" : undefined}
    >
      <input {...getInputProps()} />
      <span className={styles.targetInner}>
        {preview ? (
          <Image
            src={preview}
            alt=""
            fill
            sizes={sizes[variant]}
            unoptimized={preview.startsWith("blob:")}
          />
        ) : (
          <>
            <CloudArrowUpIcon weight="bold" aria-hidden="true" />
            <Text variant="caption2" tone="tertiary" numeric>
              {hint}
            </Text>
          </>
        )}
      </span>
    </div>
  );
}
