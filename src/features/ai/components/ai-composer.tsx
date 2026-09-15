"use client";

import {
  BrainIcon,
  FileTextIcon,
  ImageIcon,
  LightningIcon,
  MicrophoneIcon,
  PaperclipIcon,
  PaperPlaneTiltIcon,
  StopIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useRef, useState, type FormEvent, type RefObject } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { AudioBubble, LiveWave, VoiceButton, clock, useVoiceRecorder } from "@/features/tasks/components/chat-audio";
import { acceptAny, acceptDocuments, acceptImages, sizeLabel } from "@/features/tasks/files";
import { squircle, squircleAuto } from "@/lib/corners";
import { aiModel, aiModels, defaultAiModel, type AiModelId } from "../models";
import { aiRemaining, type AiAttachment, type AiUsage, type AiVoice } from "../summary";
import styles from "./ai-composer.module.css";

export type AiComposerProps = {
  value: string;
  onChange: (value: string) => void;
  /** Mandar a pergunta com o que ela leva junto. Ela sempre lê os registros da conta: é para isso que o
   *  assistente mora aqui dentro. */
  onSend: (question: string, carried: { files: readonly AiAttachment[]; voice: AiVoice | null }) => void;
  /** Interromper a resposta que está saindo. */
  onStop: () => void;
  answering: boolean;
  /** No modo bandeja as ações saem do pé do cartão e vão para a barra flutuante do celular. */
  sheet: boolean;
  /** Fechar o assistente, que no celular é o sair da barra flutuante. */
  onClose: () => void;
  /** Onde a pessoa está, na rota do menu ("Área de trabalho/Projetos"), com o glifo da página. */
  context?: { trail: string; icon: Icon };
  /** O uso do ciclo, para o saldo aparecer no pé do cartão. */
  usage?: AiUsage;
  /** O campo, para a sugestão clicada no vazio cair aqui com o cursor dentro. */
  fieldRef: RefObject<HTMLTextAreaElement | null>;
};

const modelIcons: Record<AiModelId, Icon> = { fast: LightningIcon, deep: BrainIcon };

/**
 * O compositor do assistente: o cartão **é** o campo, como o da conversa da tarefa, e no pé dele ficam o
 * clipe, o que muda o modo da resposta, a voz e o enviar. Acima do cartão, o aviso do que vai junto da
 * pergunta (a tela aberta atrás, com o glifo dela) e o que já foi pendurado nela.
 *
 * No celular o clipe, a voz e o enviar viram glifos da barra flutuante; o que sobra no pé do cartão é o que
 * é ajuste, e não ação: o modo da resposta.
 */
export function AiComposer({ value, onChange, onSend, onStop, answering, sheet, onClose, context, usage, fieldRef }: AiComposerProps) {
  const [model, setModel] = useState<AiModelId>(defaultAiModel);
  const [files, setFiles] = useState<AiAttachment[]>([]);
  const [voice, setVoice] = useState<AiVoice | null>(null);
  /* Qual tela a pessoa já dispensou. Guardando o nome, e não um sim ou não, o aviso volta sozinho quando ela
     muda de página, que é quando o que vai junto da pergunta muda de verdade. */
  const [dismissed, setDismissed] = useState<string | null>(null);
  const imagePicker = useRef<HTMLInputElement>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  const anyPicker = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const recorder = useVoiceRecorder(setVoice);

  const sharing = context && dismissed !== context.trail ? context : null;
  const ready = value.trim().length > 0 || files.length > 0 || voice !== null;

  const take = (chosen: FileList | null) => {
    if (!chosen?.length) return;
    setFiles((current) => [
      ...current,
      ...Array.from(chosen).map((file) => {
        nextId.current += 1;
        return { id: "arquivo-" + nextId.current, name: file.name, size: sizeLabel(file.size) };
      }),
    ]);
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

  useFloatingActionsRegistration(
    sheet
      ? {
          primary: answering
            ? { label: "Parar a resposta", icon: <StopIcon weight="fill" />, iconOnly: true, onClick: onStop }
            : { label: "Enviar", icon: <PaperPlaneTiltIcon weight="bold" />, iconOnly: true, disabled: !ready, onClick: send },
          extras: [
            { label: "Anexar à pergunta", icon: <PaperclipIcon weight="bold" />, onClick: () => anyPicker.current?.click() },
            recorder.recording
              ? { label: "Encerrar a gravação", icon: <StopIcon weight="fill" />, onClick: recorder.stop }
              : { label: "Ditar a pergunta", icon: <MicrophoneIcon weight="bold" />, onClick: () => void recorder.start() },
          ],
          cancel: { label: "Fechar o SpeculAI", onClick: onClose },
        }
      : null,
  );

  /* O clipe abre o menu com os dois tipos, como o da conversa da tarefa: o seletor do sistema não separa
     imagem de documento, e quem escolhe antes é a pessoa. */
  const attachSections: DropdownSection[] = [
    {
      id: "anexo",
      label: "Anexar à pergunta",
      items: [
        { id: "imagem", label: "Imagem", icon: ImageIcon, onSelect: () => imagePicker.current?.click() },
        { id: "documento", label: "Documento", icon: FileTextIcon, onSelect: () => filePicker.current?.click() },
      ],
    },
  ];

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

  const chosen = aiModel(model);
  const PageGlyph = sharing?.icon;

  return (
    <form className={styles.composer} onSubmit={submit}>
      <div className={styles.card} {...squircle("lg")}>
        {/* O que vai junto da pergunta sem ninguém pedir: a tela aberta atrás, numa linha fina no alto do
            cartão, separada do campo pelo mesmo fio da casa. Sem caixa dentro de caixa (2026-09-14): a tira
            com fundo e fio próprios dentro de um cartão que já tem os dois lia como um aviso colado ali. Some
            no × e volta sozinha na próxima tela, porque lá o que vai junto é outro. */}
        {sharing && PageGlyph && (
          <div className={styles.context} {...squircle("md")}>
            <PageGlyph className={styles.contextGlyph} />
            <Text as="span" variant="caption2" tone="secondary" truncate className={styles.contextName}>
              Ativo em {sharing.trail}
            </Text>
            <IconButton label="Não enviar a tela junto" variant="ghost" size="sm" onClick={() => setDismissed(sharing.trail)}>
              <XIcon />
            </IconButton>
          </div>
        )}

        {recorder.recording && (
          <div className={styles.recording}>
            <LiveWave level={recorder.level} />
            <Text as="span" variant="caption2" weight="medium" className={styles.clock}>
              {clock(recorder.seconds)}
            </Text>
            <Text as="span" variant="caption2" tone="secondary">
              Ditando
            </Text>
          </div>
        )}

        {voice && (
          <div className={styles.pending}>
            <span className={styles.audio} {...squircle("md")}>
              <AudioBubble audio={voice} />
            </span>
            <IconButton label="Tirar o áudio" variant="ghost" size="sm" onClick={() => setVoice(null)}>
              <XIcon />
            </IconButton>
          </div>
        )}

        {files.length > 0 && (
          <ul className={styles.files}>
            {files.map((file) => (
              <li key={file.id} className={styles.file} {...squircle("sm")}>
                <Text as="span" variant="caption2" weight="medium" truncate>
                  {file.name}
                </Text>
                <Text as="span" variant="caption2" tone="tertiary" numeric>
                  {file.size}
                </Text>
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

        <textarea
          ref={fieldRef}
          className={styles.field}
          value={value}
          rows={2}
          placeholder="Pergunte qualquer coisa"
          aria-label="Pergunte ao SpeculAI"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            /* Enter manda e Shift+Enter quebra a linha, como em toda conversa. */
            event.preventDefault();
            send();
          }}
        />

        <div className={styles.bar}>
          <span className={styles.tools}>
            <span className={styles.attach}>
              <DropdownMenu
                label="Anexar"
                triggerLabel="Anexar à pergunta"
                sections={attachSections}
                icon={<PaperclipIcon />}
                size="sm"
              />
            </span>

            <DropdownMenu
              label="Como responder"
              triggerLabel={"Modo de resposta: " + chosen.label}
              sections={modelSections}
              triggerContent={
                <span className={styles.pill} title={chosen.hint} {...squircleAuto()}>
                  <Text as="span" variant="caption2" weight="medium">
                    {chosen.label}
                  </Text>
                </span>
              }
            />
          </span>

          {/* O saldo do ciclo à vista enquanto se escreve (a pedido, 2026-09-14): sem ele a pessoa só
              descobre que acabou quando a resposta não vem. O número por extenso fica na dica e na voz. */}
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
            {/* Enquanto a resposta sai, enviar vira parar: é a mesma posição e o mesmo dedo, como em toda
                conversa com assistente. */}
            {answering ? (
              <IconButton label="Parar a resposta" size="sm" radius="md" variant="secondary" onClick={onStop}>
                <StopIcon weight="fill" />
              </IconButton>
            ) : (
              <IconButton label="Enviar a pergunta" size="sm" radius="md" type="submit" disabled={!ready}>
                <PaperPlaneTiltIcon />
              </IconButton>
            )}
          </span>
        </div>
      </div>

      {/* Três campos de arquivo, porque o `accept` mudado no clique chegaria depois de o seletor do sistema
          abrir: um por tipo no desktop e o dos dois juntos para o clipe da barra flutuante. Escondidos: o
          desenho deles não é da casa. */}
      <input
        ref={imagePicker}
        type="file"
        multiple
        accept={acceptImages}
        className={styles.picker}
        aria-label="Escolher imagens para a pergunta"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={filePicker}
        type="file"
        multiple
        accept={acceptDocuments}
        className={styles.picker}
        aria-label="Escolher documentos para a pergunta"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={anyPicker}
        type="file"
        multiple
        accept={acceptAny}
        className={styles.picker}
        aria-label="Escolher arquivos para a pergunta"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
    </form>
  );
}
