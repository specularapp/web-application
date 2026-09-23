"use client";

import {
  AddressBookIcon,
  BooksIcon,
  BrainIcon,
  BriefcaseIcon,
  CurrencyCircleDollarIcon,
  FunnelIcon,
  ListChecksIcon,
  ReceiptIcon,
  SignatureIcon,
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
import { rounded, roundedAuto } from "@/lib/corners";
import { aiModel, aiModels, defaultAiModel, type AiModelId } from "../models";
import { aiScopeIds, aiScopeLabel, aiScopeLabels, defaultAiScope, type AiScopeId } from "../scope";
import { aiRemaining, type AiAttachment, type AiUsage, type AiVoice } from "../summary";
import styles from "./ai-composer.module.css";

/* O glifo de cada fonte mora aqui, e não em `scope.ts`: aquele arquivo é lido pelo zod, que é lido pela
   action e pela rota de `api/v1`, e um mapa de ícones ali arrastava a biblioteca inteira para o servidor.
   Os glifos são os mesmos do menu, para a fonte aqui e a página lá serem lidas como a mesma coisa. */
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
  /**
   * O que o assistente pode ler, quando quem chama deixa escolher: a pílula das fontes entra ao lado da do
   * modo. É da página cheia, e não da coluna: lá o que vai junto da pergunta é a tela aberta atrás, que já
   * diz o assunto, e a pílula seria uma escolha a mais numa barra que já está cheia.
   */
  scope?: { chosen: readonly AiScopeId[]; onChange: (scope: readonly AiScopeId[]) => void };
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
export function AiComposer({ value, onChange, onSend, onStop, answering, sheet, onClose, context, scope, usage, fieldRef }: AiComposerProps) {
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

  /* As fontes em interruptores, e não em escolha única: ler o funil e os orçamentos juntos é o caso comum, e
     um menu que fecha a cada toque faria a pessoa reabrir para cada fonte. A linha do fim liga tudo de uma
     vez, que é como se desfaz um recorte sem tocar em sete interruptores. */
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

  return (
    <form className={styles.composer} data-sheet={sheet || undefined} onSubmit={submit}>
      <div className={styles.card} {...rounded("lg")}>
        {/* O que vai junto da pergunta sem ninguém pedir: a tela aberta atrás, numa linha fina no alto do
            cartão, separada do campo pelo mesmo fio da casa. Sem caixa dentro de caixa (2026-09-14): a tira
            com fundo e fio próprios dentro de um cartão que já tem os dois lia como um aviso colado ali. Some
            no × e volta sozinha na próxima tela, porque lá o que vai junto é outro. */}
        {sharing && PageGlyph && (
          <div className={styles.context} {...rounded("md")}>
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
            <span className={styles.audio} {...rounded("md")}>
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
              <li key={file.id} className={styles.file} {...rounded("sm")}>
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
                <span className={styles.pill} title={chosen.hint} {...roundedAuto()}>
                  <Text as="span" variant="caption2" weight="medium">
                    {chosen.label}
                  </Text>
                </span>
              }
            />

            {/* De onde a resposta sai. A pílula diz o recorte em uma palavra, porque na maior parte do tempo
                ele é "toda a conta" e só interessa quando deixa de ser. */}
            {scope && (
              <DropdownMenu
                label="O que eu posso ler"
                triggerLabel={"Fontes da resposta: " + aiScopeLabel(scope.chosen)}
                sections={scopeSections}
                triggerContent={
                  <span className={styles.pill} {...roundedAuto()}>
                    <BooksIcon />
                    <Text as="span" variant="caption2" weight="medium">
                      {aiScopeLabel(scope.chosen)}
                    </Text>
                  </span>
                }
              />
            )}
          </span>

          {/* O saldo e as ações andam juntos na ponta, num invólucro só: numa tela estreita a barra quebra,
              e soltos eles quebravam entre si, deixando o enviar sozinho no começo da linha de baixo. */}
          <span className={styles.end}>
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
