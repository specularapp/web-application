"use client";

import styled from "@emotion/styled";
import { ArrowSquareOutIcon, CheckCircleIcon, DownloadSimpleIcon, FileImageIcon, FilePdfIcon, LinkIcon, LinkSimpleIcon, XIcon, type Icon } from "@phosphor-icons/react";
import Image from "next/image";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import type { TaskAttachment } from "../summary";
import styles from "./task-sheet.module.css";

export type AttachmentCardProps = { file: TaskAttachment };

const fileIcons: Record<TaskAttachment["type"], Icon> = { pdf: FilePdfIcon, image: FileImageIcon, link: LinkIcon };
const fileLabels: Record<TaskAttachment["type"], string> = { pdf: "PDF", image: "Imagem", link: "Link" };

/* Cartão e chip no raio `md` e `sm` da casa, recortados no fallback porque não têm borda. */
const cardCorner = squircle("md", { clip: true });
const chipCorner = squircle("sm", { clip: true });
const stageCorner = squircle("lg", { clip: true });
/* A pílula de ações tem 44px de altura, e o raio `lg` (20px) fica abaixo da metade dela; com borda, não recorta. */
const toolbarCorner = squircle("lg");

const Viewer = styled.div`
  display: grid;
  gap: var(--space-4);
  min-height: 0;
  padding: var(--space-4);
`;

const Head = styled.div`
  display: grid;
  gap: var(--space-half);
  min-width: 0;
  padding-inline: var(--space-1);
`;

/* O palco do arquivo: proporção de tela, o preenchimento da casa por trás e o que vier por dentro, na
   largura toda. O container de ações flutua sobre ele, no rodapé. */
const Stage = styled.div`
  position: relative;
  aspect-ratio: 16 / 10;
  max-height: 60dvh;
  overflow: hidden;
  background-color: var(--color-fill-quaternary);
  border-radius: var(--radius-lg);

  & > img {
    object-fit: contain;
  }

  & > iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
  }
`;

const LinkPreview = styled.div`
  display: grid;
  gap: var(--space-2);
  place-content: center;
  justify-items: center;
  height: 100%;
  padding: var(--space-6);
  text-align: center;

  & > svg {
    width: 2.5rem;
    height: 2.5rem;
    color: var(--color-label-tertiary);
  }
`;

/* As ações num container flutuante centrado no rodapé do palco, no mesmo vidro do toast e do menu:
   fundo a 20%, borrão de 16px, fio fino e sombra, no canto superelíptico da casa. */
const Toolbar = styled.div`
  position: absolute;
  inset-block-end: var(--space-4);
  inset-inline-start: 50%;
  display: inline-flex;
  gap: var(--space-1);
  padding: var(--space-1);
  background-color: var(--glass-layer-bg);
  -webkit-backdrop-filter: var(--glass-layer-blur);
  backdrop-filter: var(--glass-layer-blur);
  border: 0.0375rem solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  transform: translateX(-50%);
`;

function absoluteUrl(url: string) {
  return new URL(url, window.location.origin).href;
}

// O anexo é um cartão que abre o arquivo na própria tela, numa janela por cima da ficha: o palco mostra
// a imagem, o PDF ou o endereço do link, e um container flutuante de vidro no rodapé traz as ações,
// baixar, abrir em nova aba, copiar o link e fechar. Nada sai da tela sem a pessoa pedir.
export function AttachmentCard({ file }: AttachmentCardProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const Glyph = fileIcons[file.type];
  const meta = file.size ? `${fileLabels[file.type]}, ${file.size}` : fileLabels[file.type];

  const download = () => {
    const anchor = document.createElement("a");
    anchor.href = file.url;
    anchor.download = file.name;
    anchor.rel = "noreferrer";
    anchor.click();
  };

  const openInTab = () => window.open(file.url, "_blank", "noopener,noreferrer");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl(file.url));
      toast({ title: "Link copiado", description: "O endereço do anexo está na área de transferência", tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: "Copie o endereço pela barra do navegador", tone: "warning" });
    }
  };

  return (
    <>
      <button type="button" className={styles.file} aria-haspopup="dialog" onClick={() => setOpen(true)} {...cardCorner}>
        <span className={styles.fileIcon} aria-hidden="true" {...chipCorner}>
          <Glyph weight="duotone" />
        </span>
        <span className={styles.fileCopy}>
          <Text as="span" variant="subheadline" weight="medium" truncate>
            {file.name}
          </Text>
          <Text as="span" variant="footnote" tone="secondary">
            {meta}
          </Text>
        </span>
        {file.label && (
          <Badge tone="success" size="sm" icon={<CheckCircleIcon />}>
            {file.label}
          </Badge>
        )}
        <ArrowSquareOutIcon className={styles.open} aria-hidden="true" />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} label={`Anexo ${file.name}`} size="lg" surface="glass" focusOnOpen={false}>
        <Viewer>
          <Head>
            <Text as="h2" variant="headline" weight="semibold" truncate>
              {file.name}
            </Text>
            <Text variant="footnote" tone="secondary">
              {meta}
            </Text>
          </Head>

          <Stage {...stageCorner}>
            {file.type === "image" && <Image src={file.url} alt={file.name} fill sizes="(max-width: 48rem) 100vw, 40rem" />}
            {file.type === "pdf" && <iframe src={file.url} title={file.name} />}
            {file.type === "link" && (
              <LinkPreview>
                <LinkIcon weight="duotone" aria-hidden="true" />
                <Text variant="subheadline" weight="medium">
                  {file.name}
                </Text>
                <Text variant="footnote" tone="secondary" truncate>
                  {file.url}
                </Text>
              </LinkPreview>
            )}

            <Toolbar role="toolbar" aria-label="Ações do anexo" {...toolbarCorner}>
              {file.type !== "link" && (
                <IconButton label="Baixar" variant="ghost" size="sm" onClick={download}>
                  <DownloadSimpleIcon />
                </IconButton>
              )}
              <IconButton label="Abrir em nova aba" variant="ghost" size="sm" onClick={openInTab}>
                <ArrowSquareOutIcon />
              </IconButton>
              <IconButton label="Copiar link" variant="ghost" size="sm" onClick={copy}>
                <LinkSimpleIcon />
              </IconButton>
              <IconButton label="Fechar" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                <XIcon />
              </IconButton>
            </Toolbar>
          </Stage>
        </Viewer>
      </Dialog>
    </>
  );
}
