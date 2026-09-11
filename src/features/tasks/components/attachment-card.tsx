"use client";

import styled from "@emotion/styled";
import { ArrowSquareOutIcon, CheckCircleIcon, DownloadSimpleIcon, FigmaLogoIcon, FileIcon, FileImageIcon, FilePdfIcon, GlobeSimpleIcon, LinkSimpleIcon, XIcon, type Icon } from "@phosphor-icons/react";
import Image from "next/image";
import { useState } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { squircle } from "@/lib/corners";
import type { TaskAttachment, TaskAttachmentType } from "../summary";
import styles from "./task-sheet.module.css";

export type AttachmentCardProps = { file: TaskAttachment };

/**
 * Cada tipo de anexo tem o próprio jeito de aparecer, e é aqui que isso mora, num lugar só: o glifo de
 * reserva, o nome do formato, se o arquivo pode ser baixado e como o palco o mostra. `stage` é o que
 * diferencia a pré-visualização: `image` desenha a imagem, `frame` embute o arquivo num iframe e `card`
 * monta a ficha do endereço, para o que não abre dentro da nossa tela.
 */
type AttachmentKind = {
  icon: Icon;
  label: string;
  downloadable: boolean;
  stage: "image" | "frame" | "card";
  /** Nome do arquivo em `public/brands` quando a marca diz mais que o glifo. */
  brand?: string;
};

const kinds: Record<TaskAttachmentType, AttachmentKind> = {
  pdf: { icon: FilePdfIcon, label: "PDF", downloadable: true, stage: "frame" },
  image: { icon: FileImageIcon, label: "Imagem", downloadable: true, stage: "image" },
  figma: { icon: FigmaLogoIcon, label: "Figma", downloadable: false, stage: "card", brand: "figma" },
  link: { icon: GlobeSimpleIcon, label: "Link", downloadable: false, stage: "card" },
  /* Arquivo que a nossa tela não abre por dentro (planilha, documento, compactado): baixa, e o palco mostra
     a ficha dele em vez de uma moldura vazia. Nasceu com o upload de 2026-09-10. */
  file: { icon: FileIcon, label: "Arquivo", downloadable: true, stage: "card" },
};

/* Endereços que a casa reconhece pela marca: o anexo mostra o logo do serviço em vez do globo genérico,
   e a pessoa sabe para onde vai antes de tocar. Só entram marcas que existem em `public/brands`. */
const brandHosts: Record<string, string> = {
  "figma.com": "figma",
  "behance.net": "behance",
  "github.com": "github",
  "gitlab.com": "gitlab",
  "linkedin.com": "linkedin",
  "canva.com": "canva",
  "webflow.com": "webflow",
  "wordpress.com": "wordpress",
  "vercel.com": "vercel",
  "google.com": "google",
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** A marca do endereço, pelo domínio ou por um subdomínio dele; sem marca conhecida devolve nulo. */
function brandOf(url: string, fallback?: string) {
  const host = hostOf(url);
  if (!host) return fallback ?? null;
  const exact = brandHosts[host];
  if (exact) return exact;
  const parent = Object.keys(brandHosts).find((known) => host.endsWith(`.${known}`));
  return parent ? brandHosts[parent] : (fallback ?? null);
}

/* Cartão e chip no raio `md` e `sm` da casa, recortados no fallback porque não têm borda. */
const cardCorner = squircle("md", { clip: true });
const chipCorner = squircle("sm", { clip: true });
const stageCorner = squircle("lg", { clip: true });
/* A pílula de ações tem 44px de altura, e o raio `lg` (20px) fica abaixo da metade dela; com borda, não recorta. */
const toolbarCorner = squircle("lg");

/**
 * As ações do anexo na barra flutuante do celular (2026-09-11, a pedido), no mesmo contrato das janelas de
 * acrescentar: abrir em outra aba é a principal, baixar e copiar são os glifos do meio, e o X fecha. Mora
 * **dentro** da `Dialog`, porque a barra elege quem registrou na maior profundidade e é ali que o
 * `FloatingLayer` da janela já elevou a conta; de fora, esta janela empataria com a ficha que a abre.
 */
function ViewerActions({
  active,
  downloadable,
  onDownload,
  onOpen,
  onCopy,
  onClose,
}: {
  active: boolean;
  downloadable: boolean;
  onDownload: () => void;
  onOpen: () => void;
  onCopy: () => Promise<void>;
  onClose: () => void;
}) {
  useFloatingActionsRegistration(
    active
      ? {
          primary: { label: "Abrir em nova aba", icon: <ArrowSquareOutIcon weight="bold" />, onClick: onOpen },
          extras: [
            ...(downloadable ? [{ label: "Baixar", icon: <DownloadSimpleIcon weight="bold" />, onClick: onDownload }] : []),
            { label: "Copiar link", icon: <LinkSimpleIcon weight="bold" />, onClick: () => void onCopy() },
          ],
          cancel: { label: "Fechar", onClick: onClose },
        }
      : null,
  );

  return null;
}

const Viewer = styled.div`
  display: grid;
  gap: var(--space-4);
  min-height: 0;
  padding: var(--space-4);

  /* Na bandeja o fim abre o espaço da barra flutuante, que é o contrato de toda janela da casa: o palco fecha
     acima dela em vez de ficar por baixo. O recuo é o inset da barra, o mesmo das janelas de acrescentar. */
  @media (max-width: 47.9375rem) {
    gap: var(--space-3);
    padding: var(--space-3);
    padding-block-end: var(--floating-bar-inset);
  }
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

  /* No celular o palco toma a altura da bandeja, em pé, em vez da proporção de tela. A conta desconta o
     cabeçalho e a folga da barra flutuante, senão o palco pedia mais altura do que a bandeja tem e o pé
     dela ficava atrás da barra. */
  @media (max-width: 47.9375rem) {
    aspect-ratio: auto;
    height: min(calc(85dvh - var(--floating-bar-inset) - var(--space-16)), 30rem);
  }

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

/* O que não abre dentro da nossa tela (Figma, endereço solto) ganha ficha em vez de moldura vazia: a
   marca do serviço num azulejo, o nome do anexo, o domínio e a linha que diz para onde o botão leva.
   Assim cada tipo tem uma cara própria e a pessoa sabe o que vai encontrar antes de sair daqui. */
const CardPreview = styled.div`
  display: grid;
  gap: var(--space-3);
  place-content: center;
  justify-items: center;
  height: 100%;
  padding: var(--space-6);
  text-align: center;
`;

/* O azulejo da marca, no fundo da página e no raio da casa, para o logo colorido assentar em qualquer
   tema. A marca sai do `BrandIcon`, que mede 1.2em, então quem dá o tamanho dela é a fonte daqui. */
const Mark = styled.span`
  display: grid;
  place-items: center;
  width: 4.5rem;
  height: 4.5rem;
  font-size: 2.25rem;
  background-color: var(--color-bg);
  border-radius: var(--radius-lg);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);

  & > svg {
    width: 2.25rem;
    height: 2.25rem;
    color: var(--color-label-secondary);
  }
`;

const Host = styled.span`
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  max-width: 100%;
  padding: var(--space-1) var(--space-3);
  font-family: var(--font-body);
  font-size: var(--text-footnote);
  color: var(--color-label-secondary);
  background-color: var(--color-bg);
  border-radius: var(--radius-full);
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

  /* No celular os botões encolhem para 32px, pelos tokens do controle pequeno redeclarados aqui. */
  @media (max-width: 47.9375rem) {
    --control-height-sm: 2rem;
    --icon-button-radius-sm: 1rem;
    --touch-target: 2rem;
    inset-block-end: var(--space-3);
    border-radius: var(--radius-md);
  }
`;

function absoluteUrl(url: string) {
  return new URL(url, window.location.origin).href;
}

// O anexo é um cartão que abre o arquivo na própria tela, numa janela por cima da ficha: o palco mostra
// a imagem, o PDF ou o endereço do link, e um container flutuante de vidro no rodapé traz as ações,
// baixar, abrir em nova aba, copiar o link e fechar. Nada sai da tela sem a pessoa pedir.
export function AttachmentCard({ file }: AttachmentCardProps) {
  const [open, setOpen] = useState(false);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const { toast } = useToast();
  const kind = kinds[file.type];
  const Glyph = kind.icon;
  const brand = kind.stage === "card" ? brandOf(file.url, kind.brand) : null;
  const host = hostOf(file.url);
  const meta = file.size ? `${kind.label}, ${file.size}` : (host ?? kind.label);

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
        {/* A prévia (2026-09-10, a pedido): imagem mostra a imagem em miniatura, e o resto mostra a marca do
            serviço quando a casa a conhece, ou o glifo do formato quando não. No meio de uma lista de
            anexos, é a prévia que diz na hora o que é cada um. */}
        <span className={styles.fileIcon} data-preview={kind.stage === "image" || undefined} aria-hidden="true" {...chipCorner}>
          {kind.stage === "image" ? (
            <Image src={file.url} alt="" fill sizes="72px" />
          ) : brand ? (
            <BrandIcon name={brand} color className={styles.fileBrand} />
          ) : (
            <Glyph weight="duotone" />
          )}
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
          <Badge tone="success" size="sm" icon={<CheckCircleIcon />} className={styles.fileLabel}>
            {file.label}
          </Badge>
        )}
        <ArrowSquareOutIcon className={styles.open} aria-hidden="true" />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} label={`Anexo ${file.name}`} size="md" surface="glass" focusOnOpen={false}>
        <ViewerActions
          active={open && mobile}
          downloadable={kind.downloadable}
          onDownload={download}
          onOpen={openInTab}
          onCopy={copy}
          onClose={() => setOpen(false)}
        />
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
            {kind.stage === "image" && <Image src={file.url} alt={file.name} fill sizes="(max-width: 48rem) 100vw, 40rem" />}
            {kind.stage === "frame" && <iframe src={file.url} title={file.name} />}
            {kind.stage === "card" && (
              <CardPreview>
                <Mark aria-hidden="true">{brand ? <BrandIcon name={brand} color /> : <Glyph weight="duotone" />}</Mark>
                <Text variant="headline" weight="semibold">
                  {file.name}
                </Text>
                {host && (
                  <Host>
                    <GlobeSimpleIcon aria-hidden="true" width={14} height={14} />
                    <Text as="span" variant="footnote" tone="secondary" truncate>
                      {host}
                    </Text>
                  </Host>
                )}
                <Text variant="footnote" tone="tertiary">
                  {file.type === "figma" ? "O arquivo abre no Figma, em outra aba" : "O endereço abre em outra aba"}
                </Text>
              </CardPreview>
            )}

            {/* No celular as ações moram na barra flutuante, como em toda janela da casa, e a fila de cima do
                palco sai: as mesmas quatro coisas nos dois lugares seriam a mesma coisa duas vezes na tela, e
                a fila pousada sobre a imagem ainda comia a parte de baixo dela. */}
            {!mobile && (
              <Toolbar role="toolbar" aria-label="Ações do anexo" {...toolbarCorner}>
                {kind.downloadable && (
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
            )}
          </Stage>
        </Viewer>
      </Dialog>
    </>
  );
}
