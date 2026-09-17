"use client";

import { ArrowLeftIcon, ArrowRightIcon, FilePdfIcon, UploadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import { useId, useState, type CSSProperties } from "react";
import { useDropzone } from "react-dropzone";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { callAction } from "@/lib/action";
import { squircle } from "@/lib/corners";
import { cx } from "@/lib/utils/cx";
import { createContractAction } from "../actions";
import { contractKinds, contractSources } from "../labels";
import { contractLimits } from "../schemas";
import type { ContractSource } from "../summary";
import { contractTemplates, plainText, type ContractTemplate } from "../templates";
import styles from "./new-contract-dialog.module.css";

export type NewContractDialogProps = {
  open: boolean;
  onClose: () => void;
  /** De quem é o contrato, quando ele nasce da ficha de um cliente: o rascunho já sai com ele. */
  clientId?: string;
  /** O rascunho nasceu: quem monta leva a pessoa para o editor dele. */
  onCreated: (id: string) => void;
};

type Step = "choose" | "upload" | "gallery";

/* As três origens na ordem em que a pessoa costuma pensar: já tenho o documento, quero partir de um modelo,
   quero escrever. Cada uma com o matiz do azulejo, o que acontece depois de escolher e o caminho em três
   palavras. */
const options: { source: ContractSource; hue: string; description: string; path: string }[] = [
  { source: "pdf", hue: "var(--sys-red)", description: "Envie o contrato que você já tem e marque no documento onde cada parte assina.", path: "Arquivo, campos, envio" },
  { source: "template", hue: "var(--sys-blue)", description: "Um modelo da casa por tipo de trabalho, na forma da norma. Edite só o necessário.", path: "Modelo, ajustes, envio" },
  { source: "scratch", hue: "var(--sys-purple)", description: "A folha em branco no editor, com as cláusulas e os dados do contrato à mão.", path: "Editor, envio" },
];

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Quantos blocos da abertura do modelo cabem na folha em miniatura do cartão. */
const PREVIEW_BLOCKS = 7;

type TemplatePreview = { title: string; lines: { text: string; heading: boolean }[]; clauses: number };

/* A miniatura de cada modelo: o documento de verdade, montado sem cliente (os colchetes ficam à vista, que é
   o "só editar o necessário"), reduzido ao título e aos primeiros blocos. Uma vez por carga, porque o modelo
   não muda. */
function previewOf(template: ContractTemplate): TemplatePreview {
  const { body } = template.build({ issuer: { name: "Nome do estúdio" }, client: null, amount: null, date: format(new Date(), "yyyy-MM-dd"), project: null });
  const blocks = body.content ?? [];
  const [first, ...rest] = blocks;
  return {
    title: first ? plainText(first) : template.name,
    lines: rest.slice(0, PREVIEW_BLOCKS).map((node) => ({ text: plainText(node), heading: node.type === "heading" })),
    clauses: blocks.filter((node) => node.type === "heading" && node.attrs?.level === 2).length,
  };
}

const previews = new Map(contractTemplates.map((template) => [template.id, previewOf(template)]));

// O primeiro passo de um contrato novo (2026-09-14, a pedido; redesenhado em 2026-09-15 para "uma interface
// mais interessante", com as peças da casa): uma janela central com as três origens em cartões lado a lado,
// cada um com o azulejo no matiz da origem, o nome, o que acontece depois e o caminho. Escolher segue no
// mesmo lugar: o PDF pede o arquivo aqui, o modelo abre a galeria aqui, e o do zero já nasce e abre o
// editor. A galeria mostra cada modelo como um cartão com a folha em miniatura do documento de verdade, o
// tipo, o nome, a frase e as entregas. No celular é a bandeja da casa, com o sair na barra flutuante. Tem
// endereço (`/contratos/novo`).
export function NewContractDialog({ open, onClose, clientId, onCreated }: NewContractDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} label="Novo contrato" size="lg" focusOnOpen={false}>
      <Chooser onClose={onClose} clientId={clientId} onCreated={onCreated} />
    </Dialog>
  );
}

function Chooser({ onClose, clientId, onCreated }: Pick<NewContractDialogProps, "onClose" | "clientId" | "onCreated">) {
  const { toast } = useToast();
  const titleId = useId();
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const working = busy !== null;

  useFloatingActionsRegistration({
    primary: step === "upload" && file ? { label: working ? "Enviando" : "Continuar", loading: working, onClick: () => void upload() } : undefined,
    cancel: { label: "Fechar", onClick: onClose },
  });

  const create = async (input: { source: "template" | "scratch"; templateId?: string }) => {
    setBusy(input.templateId ?? input.source);
    const result = await callAction(createContractAction({ ...input, clientId }));
    setBusy(null);
    if (!result.ok) {
      toast({ title: "Não deu para criar", description: result.error, tone: "danger" });
      return;
    }
    onCreated(result.id);
  };

  /* O PDF sobe pela rota de arquivo, e não por action: a action tem teto de 1 MB e um contrato escaneado
     passa disso. A resposta é o id do rascunho, que abre no editor de campos. */
  const upload = async () => {
    if (!file) return;
    setBusy("pdf");
    try {
      const form = new FormData();
      form.set("arquivo", file);
      if (clientId) form.set("cliente", clientId);
      const response = await fetch("/api/contratos/arquivo", { method: "POST", body: form });
      const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error ?? "Não deu para enviar o arquivo.");
      onCreated(data.id);
    } catch (error) {
      toast({ title: "Não deu para enviar", description: error instanceof Error ? error.message : "Tente de novo.", tone: "danger" });
    } finally {
      setBusy(null);
    }
  };

  const choose = (source: ContractSource) => {
    if (source === "pdf") setStep("upload");
    else if (source === "template") setStep("gallery");
    else void create({ source: "scratch" });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxSize: contractLimits.file,
    multiple: false,
    disabled: working,
    onDrop: (accepted, rejected) => {
      if (rejected.length > 0) {
        toast({ title: "Arquivo recusado", description: "Envie um PDF de até 10 MB.", tone: "warning" });
        return;
      }
      setFile(accepted[0] ?? null);
    },
  });

  const heading = step === "choose" ? "Novo contrato" : step === "upload" ? "Anexar o PDF" : "Escolher um modelo";
  const subheading = step === "choose" ? "Como você quer começar?" : step === "upload" ? "O documento pronto, para marcar onde cada parte assina." : "Um por tipo de trabalho, na forma da norma e com as cláusulas de um estúdio. Depois é só editar o necessário.";

  return (
    <div className={styles.dialog} data-step={step} aria-labelledby={titleId}>
      <header className={styles.head}>
        {step !== "choose" && (
          <IconButton label="Voltar" variant="ghost" size="sm" disabled={working} onClick={() => setStep("choose")}>
            <ArrowLeftIcon />
          </IconButton>
        )}
        <div className={styles.heading}>
          <Text as="h2" id={titleId} variant="headline" weight="semibold">
            {heading}
          </Text>
          <Text variant="footnote" tone="secondary">
            {subheading}
          </Text>
        </div>
        <IconButton label="Fechar" variant="ghost" size="sm" disabled={working} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      {step === "choose" && (
        <ul className={styles.options}>
          {options.map(({ source, hue, description, path }) => {
            const meta = contractSources[source];
            const creating = busy === source;
            return (
              <li key={source}>
                <button type="button" className={styles.option} style={{ "--option-hue": hue } as CSSProperties} disabled={working} aria-busy={creating || undefined} onClick={() => choose(source)} {...squircle("lg")}>
                  <span className={styles.glyph} aria-hidden="true" {...squircle("md")}>
                    {creating ? <Spinner size="sm" label="" /> : <meta.icon weight="duotone" />}
                  </span>
                  <span className={styles.copy}>
                    <Text as="span" variant="subheadline" weight="semibold">
                      {meta.label}
                    </Text>
                    <Text as="span" variant="footnote" tone="secondary">
                      {description}
                    </Text>
                  </span>
                  <span className={styles.path}>
                    <Text as="span" variant="caption1" tone="tertiary" truncate>
                      {path}
                    </Text>
                    <ArrowRightIcon className={styles.arrow} weight="bold" aria-hidden="true" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {step === "upload" && (
        <div className={styles.upload}>
          <div {...getRootProps({ className: cx(styles.dropzone, isDragActive && styles.dropzoneActive), ...squircle("lg") })}>
            <input {...getInputProps()} aria-label="Escolher o PDF do contrato" />
            <span className={cx(styles.glyph, styles.uploadGlyph)} aria-hidden="true" {...squircle("md")}>
              {file ? <FilePdfIcon weight="duotone" /> : <UploadSimpleIcon weight="duotone" />}
            </span>
            {file ? (
              <span className={styles.copy}>
                <Text as="span" variant="subheadline" weight="semibold" truncate>
                  {file.name}
                </Text>
                <Text as="span" variant="footnote" tone="secondary">
                  {sizeLabel(file.size)}. Clique para trocar.
                </Text>
              </span>
            ) : (
              <span className={styles.copy}>
                <Text as="span" variant="subheadline" weight="semibold">
                  {isDragActive ? "Solte o arquivo aqui" : "Arraste o PDF ou clique para escolher"}
                </Text>
                <Text as="span" variant="footnote" tone="secondary">
                  Só PDF, até 10 MB. Depois você marca onde cada parte assina.
                </Text>
              </span>
            )}
          </div>
          <footer className={styles.foot}>
            <Button variant="outline" size="sm" radius="md" disabled={working} onClick={() => setStep("choose")}>
              Voltar
            </Button>
            <Button size="sm" radius="md" iconStart={<UploadSimpleIcon />} loading={busy === "pdf"} disabled={!file} onClick={() => void upload()}>
              {busy === "pdf" ? "Enviando" : "Continuar"}
            </Button>
          </footer>
        </div>
      )}

      {step === "gallery" && (
        <ul className={styles.gallery}>
          {contractTemplates.map((template) => {
            const kind = contractKinds[template.kind];
            const preview = previews.get(template.id);
            const creating = busy === template.id;
            return (
              <li key={template.id}>
                <button
                  type="button"
                  className={styles.template}
                  style={{ "--template-hue": kind.hue } as CSSProperties}
                  disabled={working}
                  aria-busy={creating || undefined}
                  aria-label={`Usar o modelo ${template.name}`}
                  onClick={() => void create({ source: "template", templateId: template.id })}
                  {...squircle("lg")}
                >
                  {/* A folha em miniatura: o documento de verdade em corpo miúdo, esmaecendo no pé. */}
                  <span className={styles.paper} data-scheme="light" aria-hidden="true">
                    <span className={styles.paperTitle}>{preview?.title}</span>
                    {preview?.lines.map((line, index) => (
                      <span key={index} className={styles.paperLine} data-heading={line.heading || undefined}>
                        {line.text}
                      </span>
                    ))}
                    {creating && (
                      <span className={styles.paperBusy}>
                        <Spinner size="sm" label="" />
                      </span>
                    )}
                  </span>
                  <span className={styles.templateBody}>
                    <span className={styles.templateHead}>
                      <Badge size="sm" hue={kind.hue}>
                        {kind.label}
                      </Badge>
                      {preview && (
                        <Text as="span" variant="caption1" tone="tertiary">
                          {preview.clauses} cláusulas
                        </Text>
                      )}
                    </span>
                    <Text as="span" variant="subheadline" weight="semibold">
                      {template.name}
                    </Text>
                    <Text as="span" variant="footnote" tone="secondary" className={styles.summary}>
                      {template.summary}
                    </Text>
                    <span className={styles.highlights}>
                      {template.highlights.slice(0, 3).map((item) => (
                        <Badge key={item} variant="outline" size="sm">
                          {item}
                        </Badge>
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
