"use client";

import {
  AddressBookIcon,
  BooksIcon,
  BrainIcon,
  BriefcaseIcon,
  CaretDownIcon,
  CurrencyCircleDollarIcon,
  FileTextIcon,
  FunnelIcon,
  LightningIcon,
  ListChecksIcon,
  MicrophoneIcon,
  PaperclipIcon,
  ArrowUpIcon,
  PlusIcon,
  ReceiptIcon,
  SignatureIcon,
  StopIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type RefObject,
} from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { Tooltip } from "@/components/ui/tooltip";
import { AudioBubble, LiveWave, VoiceButton, clock, useVoiceRecorder } from "@/features/tasks/components/chat-audio";
import { acceptAny, sizeLabel } from "@/features/tasks/files";
import { rounded, roundedAuto } from "@/lib/corners";
import { aiModel, aiModels, defaultAiModel, type AiModelId } from "../models";
import { aiScopeIds, aiScopeLabel, aiScopeLabels, defaultAiScope, type AiScopeId } from "../scope";
import { aiRemaining, type AiAttachment, type AiUsage, type AiVoice } from "../summary";
import styles from "./ai-composer.module.css";

/* O glifo de cada fonte mora aqui, e não em `scope.ts`: aquele arquivo é lido pelo zod do servidor, e um mapa
   de ícones ali arrastava a biblioteca inteira para a rota. */
const scopeGlyphs: Record<AiScopeId, Icon> = {
  crm: FunnelIcon,
  orcamentos: ReceiptIcon,
  contratos: SignatureIcon,
  clientes: AddressBookIcon,
  projetos: BriefcaseIcon,
  tarefas: ListChecksIcon,
  financeiro: CurrencyCircleDollarIcon,
};

const scopeSources = aiScopeIds.map((id) => ({ id, label: aiScopeLabels[id], icon: scopeGlyphs[id] }));

const modelIcons: Record<AiModelId, Icon> = { fast: LightningIcon, deep: BrainIcon };

export type AiComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (question: string, carried: { files: readonly AiAttachment[]; voice: AiVoice | null }) => void;
  onStop: () => void;
  answering: boolean;
  /** No modo bandeja o anexo, a voz e o enviar saem do cartão e vão para a barra flutuante do celular. */
  sheet: boolean;
  onClose: () => void;
  /** Onde a pessoa está, na rota do menu ("Área de trabalho/Projetos"), com o glifo da página. */
  context?: { trail: string; icon: Icon };
  /** O que o assistente pode ler, quando quem chama deixa escolher. */
  scope?: { chosen: readonly AiScopeId[]; onChange: (scope: readonly AiScopeId[]) => void };
  usage?: AiUsage;
  fieldRef: RefObject<HTMLTextAreaElement | null>;
};

/**
 * O compositor do SpeculAI: um cartão só, com o que vai junto da pergunta no alto, o campo que cresce com o
 * texto e, no pé, anexar, o modo da resposta, as fontes, a voz e o enviar. Arrastar um arquivo para o cartão
 * ou colar uma imagem também anexa. Enter manda e Shift+Enter quebra a linha.
 */
export function AiComposer({ value, onChange, onSend, onStop, answering, sheet, onClose, context, scope, usage, fieldRef }: AiComposerProps) {
  const [model, setModel] = useState<AiModelId>(defaultAiModel);
  const [files, setFiles] = useState<AiAttachment[]>([]);
  const [voice, setVoice] = useState<AiVoice | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const nextId = useRef(0);
  const recorder = useVoiceRecorder(setVoice);

  const sharing = context && dismissed !== context.trail ? context : null;
  const ready = value.trim().length > 0 || files.length > 0 || voice !== null;

  const fit = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [fieldRef]);

  useLayoutEffect(fit, [value, fit]);

  /* A largura muda sem o texto mudar (a coluna abrindo, a janela redimensionada), e o texto quebra em outras
     linhas: medir só ao digitar deixaria a altura errada. */
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    let width = -1;
    const observer = new ResizeObserver(() => {
      if (field.offsetWidth === width) return;
      width = field.offsetWidth;
      fit();
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [fit, fieldRef]);

  const take = (chosen: readonly File[]) => {
    if (chosen.length === 0) return;
    setFiles((current) => [
      ...current,
      ...chosen.map((file) => {
        nextId.current += 1;
        return { id: "arquivo-" + nextId.current, name: file.name || "Imagem colada", size: sizeLabel(file.size) };
      }),
    ]);
    fieldRef.current?.focus();
  };

  const send = () => {
    if (!ready || answering) return;
    onSend(value, { files, voice });
    onChange("");
    setFiles([]);
    setVoice(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  const paste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(event.clipboardData.files);
    if (pasted.length === 0) return;
    event.preventDefault();
    take(pasted);
  };

  /* Arrastar um arquivo para o cartão é atalho do ponteiro: o caminho de teclado é o "+". Por isso a escuta é
     do próprio elemento, e não um alvo de clique a mais. */
  const taking = useRef(take);
  useEffect(() => {
    taking.current = take;
  });

  useEffect(() => {
    const target = form.current;
    if (!target) return;
    const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const over = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (!target.contains(event.relatedTarget as Node | null)) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setDragging(false);
      taking.current(Array.from(event.dataTransfer?.files ?? []));
    };
    target.addEventListener("dragover", over);
    target.addEventListener("dragleave", leave);
    target.addEventListener("drop", drop);
    return () => {
      target.removeEventListener("dragover", over);
      target.removeEventListener("dragleave", leave);
      target.removeEventListener("drop", drop);
    };
  }, []);

  useFloatingActionsRegistration(
    sheet
      ? {
          primary: answering
            ? { label: "Parar a resposta", icon: <StopIcon weight="fill" />, iconOnly: true, onClick: onStop }
            : { label: "Enviar", icon: <ArrowUpIcon weight="bold" />, iconOnly: true, disabled: !ready, onClick: send },
          extras: [
            { label: "Anexar à pergunta", icon: <PaperclipIcon weight="bold" />, onClick: () => picker.current?.click() },
            recorder.recording
              ? { label: "Encerrar a gravação", icon: <StopIcon weight="fill" />, onClick: recorder.stop }
              : { label: "Ditar a pergunta", icon: <MicrophoneIcon weight="bold" />, onClick: () => void recorder.start() },
          ],
          cancel: { label: "Fechar o SpeculAI", onClick: onClose },
        }
      : null,
  );

  const modelSections: DropdownSection[] = [
    {
      id: "modos",
      label: "Como responder",
      items: aiModels.map((entry) => ({
        id: entry.id,
        label: entry.label,
        icon: modelIcons[entry.id],
        selected: entry.id === model,
        onSelect: () => setModel(entry.id),
      })),
    },
  ];

  const scopeSections: DropdownSection[] = scope
    ? [
        {
          id: "fontes",
          label: "O que eu posso ler",
          items: scopeSources.map((source) => ({
            kind: "toggle" as const,
            id: source.id,
            label: source.label,
            icon: source.icon,
            checked: scope.chosen.includes(source.id),
            onChange: (on: boolean) =>
              scope.onChange(on ? [...scope.chosen, source.id] : scope.chosen.filter((entry) => entry !== source.id)),
          })),
        },
        {
          id: "tudo",
          items: [
            {
              id: "toda-a-conta",
              label: "Toda a conta",
              icon: BooksIcon,
              selected: scope.chosen.length >= scopeSources.length,
              keepOpen: true,
              onSelect: () => scope.onChange(defaultAiScope),
            },
          ],
        },
      ]
    : [];

  const chosen = aiModel(model);
  const PageGlyph = sharing?.icon;
  const ModelGlyph = modelIcons[chosen.id];

  return (
    <form
      className={styles.composer}
      data-sheet={sheet || undefined}
      ref={form}
      onSubmit={submit}
    >
      <div className={styles.card} data-dragging={dragging || undefined} {...rounded("2xl")}>
        {sharing && PageGlyph && (
          <div className={styles.context} {...rounded("lg")}>
            <PageGlyph className={styles.contextGlyph} />
            <Text as="span" variant="caption2" tone="secondary" truncate className={styles.contextName}>
              Ativo em {sharing.trail}
            </Text>
            <IconButton label="Não enviar a tela junto" variant="ghost" size="sm" onClick={() => setDismissed(sharing.trail)}>
              <XIcon />
            </IconButton>
          </div>
        )}

        {files.length > 0 && (
          <ul className={styles.files} aria-label="Arquivos anexados">
            {files.map((file) => (
              <li key={file.id} className={styles.file} {...rounded("lg")}>
                <span className={styles.fileGlyph} {...rounded("md")}>
                  <FileTextIcon weight="duotone" />
                </span>
                <span className={styles.fileText}>
                  <Text as="span" variant="caption1" weight="medium" truncate title={file.name}>
                    {file.name}
                  </Text>
                  <Text as="span" variant="caption2" tone="secondary" numeric>
                    {file.size}
                  </Text>
                </span>
                <IconButton
                  label={"Tirar " + file.name}
                  variant="ghost"
                  size="sm"
                  onClick={() => setFiles((current) => current.filter((entry) => entry.id !== file.id))}
                >
                  <XIcon />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        {recorder.recording && (
          <div className={styles.recording}>
            <LiveWave level={recorder.level} />
            <Text as="span" variant="caption2" weight="medium" numeric>
              {clock(recorder.seconds)}
            </Text>
            <Text as="span" variant="caption2" tone="secondary">
              Ditando
            </Text>
          </div>
        )}

        {voice && (
          <div className={styles.pending}>
            <span className={styles.audio} {...rounded("md")}>
              <AudioBubble audio={voice} />
            </span>
            <IconButton label="Tirar o áudio" variant="ghost" size="sm" onClick={() => setVoice(null)}>
              <XIcon />
            </IconButton>
          </div>
        )}

        <div className={styles.body}>
          <textarea
            ref={fieldRef}
            className={styles.field}
            value={value}
            rows={1}
            placeholder="Pergunte ao SpeculAI"
            aria-label="Pergunte ao SpeculAI"
            onChange={(event) => onChange(event.target.value)}
            onPaste={paste}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              send();
            }}
          />

          <div className={styles.tools}>
            <span className={styles.attach}>
              <Tooltip content="Anexar imagem ou documento" align="start">
                <IconButton label="Anexar à pergunta" variant="outline" size="sm" radius="full" onClick={() => picker.current?.click()}>
                  <PlusIcon />
                </IconButton>
              </Tooltip>
            </span>

            <DropdownMenu
              label="Como responder"
              triggerLabel={"Modo de resposta: " + chosen.label}
              sections={modelSections}
              triggerContent={
                <span className={styles.pill} title={chosen.hint} {...roundedAuto()}>
                  <ModelGlyph />
                  <Text as="span" variant="caption1" weight="medium">
                    {chosen.label}
                  </Text>
                  <CaretDownIcon className={styles.caret} />
                </span>
              }
            />

            {scope && (
              <DropdownMenu
                label="O que eu posso ler"
                triggerLabel={"Fontes da resposta: " + aiScopeLabel(scope.chosen)}
                sections={scopeSections}
                triggerContent={
                  <span className={styles.pill} {...roundedAuto()}>
                    <BooksIcon />
                    <Text as="span" variant="caption1" weight="medium">
                      {aiScopeLabel(scope.chosen)}
                    </Text>
                    <CaretDownIcon className={styles.caret} />
                  </span>
                }
              />
            )}

            <span className={styles.end}>
              {usage && (
                <Text
                  as="span"
                  variant="caption2"
                  tone="tertiary"
                  numeric
                  className={styles.balance}
                  title={`${aiRemaining(usage)} de ${usage.limit} ações de IA disponíveis neste ciclo`}
                >
                  {aiRemaining(usage)} restantes
                </Text>
              )}

              <span className={styles.send}>
                <VoiceButton onRecorded={setVoice} />
                {answering ? (
                  <IconButton label="Parar a resposta" size="sm" radius="full" onClick={onStop}>
                    <StopIcon weight="fill" />
                  </IconButton>
                ) : (
                  <IconButton
                    label="Enviar a pergunta"
                    size="sm"
                    radius="full"
                    type="submit"
                    variant={ready ? "primary" : "secondary"}
                    disabled={!ready}
                  >
                    <ArrowUpIcon />
                  </IconButton>
                )}
              </span>
            </span>
          </div>
        </div>
      </div>

      <input
        ref={picker}
        type="file"
        multiple
        accept={acceptAny}
        tabIndex={-1}
        className={styles.picker}
        aria-label="Escolher arquivos para a pergunta"
        onChange={(event) => {
          take(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </form>
  );
}
