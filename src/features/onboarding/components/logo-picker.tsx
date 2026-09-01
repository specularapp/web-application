"use client";

import { CloudArrowUpIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { LOGO_MAX_BYTES } from "@/features/organizations/schemas";
import styles from "./onboarding.module.css";

type LogoPickerProps = {
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

export function LogoPicker({ preview, disabled = false, onSelect, onReject }: LogoPickerProps) {
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
      if (code === "file-too-large") onReject("A logo precisa ter no máximo 2 MB");
      else if (code) onReject("Envie a logo em PNG, JPG ou WEBP");
    },
  });

  return (
    <div
      {...getRootProps({
        className: styles.dropzone,
        role: "button",
        "aria-label": preview ? "Trocar a logo do time" : "Enviar a logo do time",
      })}
      data-active={isDragActive || undefined}
      data-filled={preview ? "" : undefined}
    >
      <input {...getInputProps()} />
      <span className={styles.dropzoneInner}>
        {preview ? (
          <Image src={preview} alt="" width={80} height={80} unoptimized />
        ) : (
          <CloudArrowUpIcon weight="bold" aria-hidden="true" />
        )}
      </span>
    </div>
  );
}
