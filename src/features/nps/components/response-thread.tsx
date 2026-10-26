"use client";

import styled from "@emotion/styled";
import {
  ArrowUpIcon,
  CaretUpDownIcon,
  ChatTextIcon,
  CheckCircleIcon,
  HandshakeIcon,
  LightningIcon,
  LockSimpleIcon,
  PhoneIcon,
  StarIcon,
  UserIcon,
  WhatsappLogoIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { channelLabels, dateLabel, dateTimeLabel, groupLabels, groupOf, serviceLabels, themeLabel, timeLabel, treatmentIsOpen, treatmentLabels, treatmentOrder } from "../labels";
import { addTreatmentEvent, setTreatmentOwner, setTreatmentStatus, slaOf } from "../treatments";
import type { Answer, NpsClient, NpsGroup, NpsMember, NpsResponse, Question, Survey, Treatment, TreatmentStatus } from "../types";
import { ScoreBubble } from "./parts";
import styles from "./responses.module.css";
import { Segmented } from "./segmented";

const firstName = (name: string) => name.split(" ")[0];

function quickReplies(name: string, project: string, group: NpsGroup) {
  const who = firstName(name);
  return [
    { id: "sorry", label: "Pedido de desculpas", text: `Oi, ${who}! Lemos a sua avaliação do ${project} e sentimos muito pelo que aconteceu. Podemos conversar para entender melhor e corrigir?` },
    { id: "understand", label: "Entender o que pesou", text: `Oi, ${who}! Obrigado pela avaliação. Queremos entender o que faltou para o ${project} ser nota 10. Pode contar um pouco mais?` },
    { id: "adjust", label: "Oferecer ajuste sem custo", text: `${who}, como forma de corrigir, gostaríamos de fazer os ajustes no ${project} sem custo nas próximas duas semanas.` },
    group === "promoter"
      ? { id: "testimonial", label: "Pedir depoimento", text: `${who}, que bom que gostou! Se puder, deixe um depoimento curto: ele vai para o nosso portfólio com o ${project}.` }
      : { id: "thanks", label: "Agradecer o retorno", text: `${who}, obrigado pelo retorno. Já passamos para a equipe e vamos melhorar.` },
  ];
}

const HistoryButton = styled.button`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: center;
  width: 100%;
  min-height: var(--touch-target);
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-body);
  font-size: var(--text-footnote);
  color: var(--color-label);
  text-align: start;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: var(--radius-md);

  & > span:nth-of-type(2) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  & time {
    font-size: var(--text-caption-1);
    color: var(--color-label-tertiary);
  }

  &:hover:not(:disabled),
  &[aria-current="true"] {
    background-color: var(--color-fill-quaternary);
  }

  &:disabled {
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
`;

function AnswerValue({ question, value }: { question: Question; value: Answer | undefined }) {
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return <span className={styles.muted}>Sem resposta</span>;
  if (question.kind === "nps" && typeof value === "number") return <ScoreBubble score={value} size="sm" />;
  if (question.kind === "stars" && typeof value === "number")
    return (
      <span className={styles.starsValue} aria-label={`${value} de 5 estrelas`}>
        {Array.from({ length: 5 }, (_, index) => (
          <StarIcon key={index} weight={index < value ? "fill" : "regular"} aria-hidden="true" />
        ))}
      </span>
    );
  if (typeof value === "boolean") return <span>{value ? "Sim" : "Não"}</span>;
  if (Array.isArray(value)) return <span>{value.join(", ")}</span>;
  return <span>{String(value)}</span>;
}

/** Ao resolver, a pergunta do desfecho: o cliente saiu satisfeito ou não. É o que mede a recuperação. */
export function ResolveDialog({ open, name, onClose, onResolve }: { open: boolean; name: string; onClose: () => void; onResolve: (recovered: boolean) => void }) {
  return (
    <Dialog open={open} onClose={onClose} label="Resolver a tratativa" size="sm" surface="solid">
      <DialogHeader title={`Como terminou com ${firstName(name)}?`} description="É o que mede a recuperação dos detratores." onClose={onClose} />
      <div className={styles.resolve}>
        <Button variant="outline" fullWidth iconStart={<CheckCircleIcon weight="fill" style={{ color: "var(--sys-green)" }} />} onClick={() => onResolve(true)}>
          Recuperado, saiu satisfeito
        </Button>
        <Button variant="outline" fullWidth iconStart={<XCircleIcon weight="fill" style={{ color: "var(--sys-red)" }} />} onClick={() => onResolve(false)}>
          Segue insatisfeito
        </Button>
      </div>
    </Dialog>
  );
}

export type ResponseThreadProps = {
  response: NpsResponse;
  client: NpsClient | undefined;
  survey: Survey | undefined;
  treatment: Treatment | null;
  team: NpsMember[];
  now: string;
  /** Antes do nome: o voltar do celular. */
  leading?: ReactNode;
  /** Depois das ações: o botão da ficha, quando ela não cabe ao lado. */
  trailing?: ReactNode;
  /** Sem ele, a resposta sem tratativa não oferece começar uma. */
  onStart?: () => void;
  onTreatment: (treatment: Treatment) => void;
};

/**
 * O atendimento de uma resposta, no desenho de conversa da casa: a resposta do cliente abre, os contatos e as
 * notas da equipe vêm em balões e as mudanças de situação em avisos no meio. Embaixo, o campo de registrar,
 * com o modo contato ou nota interna, as respostas prontas e o atalho do WhatsApp.
 */
export function ResponseThread({ response, client, survey, treatment, team, now, leading, trailing, onStart, onTreatment }: ResponseThreadProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"contact" | "note">("contact");
  const [text, setText] = useState("");
  const [resolving, setResolving] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const group = groupOf(response.score);
  const name = client?.contact.name ?? "Cliente";
  const project = client?.project.name ?? "projeto";
  const phone = client?.contact.phone.replace(/\D/g, "") ?? "";
  const closed = treatment !== null && !treatmentIsOpen(treatment.status);
  const owner = team.find((member) => member.id === treatment?.ownerId) ?? null;
  const sla = treatment ? slaOf(treatment, now) : null;
  const eventCount = treatment?.events.length ?? 0;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [eventCount, response.id]);

  const stamp = () => new Date().toISOString();

  const send = () => {
    if (!treatment || text.trim().length < 3) return;
    onTreatment(addTreatmentEvent(treatment, mode, text, stamp()));
    setText("");
    toast({ title: mode === "contact" ? "Contato registrado" : "Nota registrada", description: "Já está na linha do tempo da tratativa.", tone: "success", feedback: false });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const move = (status: TreatmentStatus) => {
    if (!treatment || status === treatment.status) return;
    if (status === "resolved") return setResolving(true);
    onTreatment(setTreatmentStatus(treatment, status, stamp()));
  };

  const days: { key: string; items: ReactNode[] }[] = [];
  const push = (at: string, node: ReactNode) => {
    const key = dateLabel(at);
    const last = days.at(-1);
    if (last?.key === key) last.items.push(node);
    else days.push({ key, items: [node] });
  };
  push(response.answeredAt, (
    <p key="survey" className={styles.system}>
      {survey?.name ?? "Pesquisa"} respondida {{ email: "por e-mail", whatsapp: "pelo WhatsApp", link: "pelo link aberto" }[response.channel]} às {timeLabel(response.answeredAt)}
    </p>
  ));
  push(response.answeredAt, (
    <div key="answer" className={styles.row}>
      <Avatar name={name} seed={response.clientId} size="xs" />
      <div className={styles.bubble} data-side="client">
        <span className={styles.bubbleScore}>
          <ScoreBubble score={response.score} size="sm" />
          Nota {response.score}, {groupLabels[group].label.toLowerCase()}
        </span>
        <p>{response.comment || <em className={styles.muted}>Não deixou comentário.</em>}</p>
        {response.themes.length > 0 && (
          <span className={styles.themes}>
            {response.themes.map((theme) => (
              <Badge key={theme} size="sm" variant="outline" tone={group === "promoter" ? "success" : "danger"}>
                {themeLabel(theme)}
              </Badge>
            ))}
          </span>
        )}
        <span className={styles.meta}>{timeLabel(response.answeredAt)}</span>
      </div>
    </div>
  ));
  for (const item of treatment?.events ?? []) {
    if (item.kind === "contact" || item.kind === "note") {
      push(item.at, (
        <div key={item.id} className={styles.row} data-side="team">
          <div className={styles.bubble} data-side="team" data-note={item.kind === "note" || undefined}>
            <span className={styles.bubbleAuthor}>
              {item.kind === "note" ? <LockSimpleIcon aria-hidden="true" /> : <PhoneIcon aria-hidden="true" />}
              {item.by} {item.kind === "note" ? "anotou para a equipe" : "registrou um contato"}
            </span>
            <p>{item.text}</p>
            <span className={styles.meta}>{timeLabel(item.at)}</span>
          </div>
        </div>
      ));
    } else {
      push(item.at, (
        <p key={item.id} className={styles.system}>
          {item.text} <time dateTime={item.at}>{timeLabel(item.at)}</time>
        </p>
      ));
    }
  }

  return (
    <section className={styles.thread} aria-label={`Atendimento de ${name}`}>
      <header className={styles.threadHead}>
        {leading}
        <Avatar name={name} seed={response.clientId} size="sm" />
        <span className={styles.threadTitle}>
          <Text as="h2" variant="subheadline" weight="semibold" truncate>
            {name}
          </Text>
          <Text as="span" variant="caption1" tone="secondary" truncate>
            {[client?.contact.company, project].filter(Boolean).join(", ")}
          </Text>
        </span>
        {treatment && (
          <span className={styles.threadActions}>
            <DropdownMenu
              label="Situação da tratativa"
              triggerLabel={`Situação: ${treatmentLabels[treatment.status].label}`}
              searchable={false}
              triggerContent={
                <span className={styles.statusPill} style={{ "--tone": treatmentLabels[treatment.status].color } as CSSProperties}>
                  {treatmentLabels[treatment.status].label}
                  <CaretUpDownIcon aria-hidden="true" />
                </span>
              }
              sections={[
                {
                  id: "status",
                  label: "Mover para",
                  items: treatmentOrder.map((status) => ({ id: status, label: treatmentLabels[status].label, selected: status === treatment.status, media: <span className={styles.dot} style={{ "--tone": treatmentLabels[status].color } as CSSProperties} />, onSelect: () => move(status) })),
                },
              ]}
            />
            <DropdownMenu
              label="Responsável"
              triggerLabel={owner ? `Responsável: ${owner.name}` : "Sem responsável"}
              searchable={false}
              icon={owner ? <Avatar name={owner.name} seed={owner.id} size="xs" /> : <UserIcon />}
              sections={[
                {
                  id: "owner",
                  label: "Quem cuida",
                  items: [
                    ...team.map((member) => ({ id: member.id, label: member.name, media: <Avatar name={member.name} seed={member.id} size="xs" />, selected: member.id === treatment.ownerId, onSelect: () => onTreatment(setTreatmentOwner(treatment, member, stamp())) })),
                    { id: "none", label: "Sem responsável", icon: UserIcon, selected: treatment.ownerId === null, onSelect: () => onTreatment(setTreatmentOwner(treatment, null, stamp())) },
                  ],
                },
              ]}
            />
          </span>
        )}
        {trailing}
      </header>

      {treatment && sla && (
        <div className={styles.slaBar} data-tone={sla.tone}>
          <span>{treatmentLabels[treatment.status].description}</span>
          <strong>{sla.label}</strong>
        </div>
      )}

      <div className={styles.chat} ref={scroller}>
        {days.map((day) => (
          <section key={day.key} className={styles.day} aria-label={day.key}>
            <span className={styles.dayLabel}>{day.key}</span>
            {day.items}
          </section>
        ))}
      </div>

      <div className={styles.dock}>
        {!treatment ? (
          <div className={styles.closedBlock}>
            <span>
              <HandshakeIcon aria-hidden="true" />
              {group === "detractor" ? `Detrator sem atendimento: vale falar com ${firstName(name)} logo.` : group === "passive" ? "Neutro: um contato pode virar a próxima nota em promotor." : "Promotor: agradeça e convide para um depoimento."}
            </span>
            {onStart && (
              <Button size="sm" radius="md" onClick={onStart}>
                Iniciar atendimento
              </Button>
            )}
          </div>
        ) : closed ? (
          <div className={styles.closedBlock}>
            <span>
              <CheckCircleIcon aria-hidden="true" />
              {treatment.status === "resolved" ? (treatment.recovered ? "Encerrada: cliente recuperado." : "Encerrada: o cliente segue insatisfeito.") : "Encerrada sem retorno do cliente."}
            </span>
            <Button size="sm" radius="md" variant="outline" onClick={() => move("contacted")}>
              Reabrir
            </Button>
          </div>
        ) : (
          <div className={styles.composer} data-note={mode === "note" || undefined}>
            <Textarea
              ref={field}
              rows={2}
              value={text}
              maxLength={600}
              className={styles.field}
              placeholder={mode === "contact" ? `O que foi falado com ${firstName(name)}` : "Nota para a equipe: o que verificar, quem avisar"}
              aria-label={mode === "contact" ? "Registro do contato" : "Nota interna"}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <div className={styles.tools}>
              <span className={styles.toolGroup}>
                <Segmented
                  as="radio"
                  label="Tipo do registro"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "contact", label: "Contato", icon: <PhoneIcon aria-hidden="true" /> },
                    { value: "note", label: "Nota interna", icon: <LockSimpleIcon aria-hidden="true" /> },
                  ]}
                />
                <DropdownMenu
                  label="Respostas prontas"
                  triggerLabel="Respostas prontas"
                  icon={<LightningIcon />}
                  searchable={false}
                  sections={[
                    {
                      id: "ready",
                      label: "Usar no campo",
                      items: quickReplies(name, project, group).map((reply) => ({
                        id: reply.id,
                        label: reply.label,
                        icon: ChatTextIcon,
                        onSelect: () => {
                          setMode("contact");
                          setText(reply.text);
                          window.setTimeout(() => field.current?.focus(), 0);
                        },
                      })),
                    },
                  ]}
                />
                {phone && (
                  <Tooltip content="Abrir no WhatsApp com este texto">
                    <IconButton label="Abrir no WhatsApp com este texto" variant="ghost" size="sm" href={`https://wa.me/55${phone}?text=${encodeURIComponent(text.trim() || `Oi, ${firstName(name)}! Aqui é do estúdio.`)}`} target="_blank" rel="noreferrer">
                      <WhatsappLogoIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </span>
              <IconButton label={mode === "contact" ? "Registrar o contato" : "Registrar a nota"} size="sm" disabled={text.trim().length < 3} onClick={send}>
                <ArrowUpIcon />
              </IconButton>
            </div>
          </div>
        )}
      </div>

      {treatment && (
        <ResolveDialog
          open={resolving}
          name={name}
          onClose={() => setResolving(false)}
          onResolve={(recovered) => {
            setResolving(false);
            onTreatment(setTreatmentStatus(treatment, "resolved", stamp(), recovered));
          }}
        />
      )}
    </section>
  );
}

/** A ficha da resposta: quem respondeu, o projeto, as respostas de cada pergunta e as outras avaliações dele. */
export function ResponseProfile({ response, client, survey, history, onSelect }: { response: NpsResponse; client: NpsClient | undefined; survey: Survey | undefined; history: NpsResponse[]; onSelect?: (id: string) => void }) {
  const group = groupOf(response.score);
  return (
    <div className={styles.profile}>
      <header className={styles.profileHead}>
        <ScoreBubble score={response.score} size="lg" />
        <span className={styles.profileTitle}>
          <Text as="h2" variant="headline" weight="semibold" truncate>
            {client?.contact.name ?? "Cliente"}
          </Text>
          <Text as="span" variant="caption1" tone="secondary" truncate>
            {client?.contact.company}
          </Text>
        </span>
        <Badge tone={groupLabels[group].tone} size="sm">
          {groupLabels[group].label}
        </Badge>
      </header>

      <dl className={styles.facts}>
        <div>
          <dt>Projeto</dt>
          <dd>
            {client?.project.name}
            <small>{client ? `${client.project.reference}, ${serviceLabels[client.project.service].label}` : ""}</small>
          </dd>
        </div>
        <div>
          <dt>Pesquisa</dt>
          <dd>{survey?.name ?? "Pesquisa"}</dd>
        </div>
        <div>
          <dt>Canal</dt>
          <dd>{channelLabels[response.channel]}</dd>
        </div>
        <div>
          <dt>Enviada em</dt>
          <dd>{response.sentAt ? dateTimeLabel(response.sentAt) : "Link aberto"}</dd>
        </div>
        <div>
          <dt>Respondida em</dt>
          <dd>{dateTimeLabel(response.answeredAt)}</dd>
        </div>
        <div>
          <dt>Contato</dt>
          <dd>
            {client?.contact.email}
            <small>{client?.contact.phone}</small>
          </dd>
        </div>
      </dl>

      <section className={styles.profileSection} aria-label="Respostas">
        <Text as="h3" variant="caption1" weight="semibold" tone="secondary">
          Respostas
        </Text>
        <ol className={styles.answers}>
          {(survey?.questions ?? []).map((question) => (
            <li key={question.id}>
              <span>{question.kind === "stars" ? question.aspect : question.title}</span>
              <AnswerValue question={question} value={response.answers[question.id]} />
            </li>
          ))}
        </ol>
      </section>

      {history.length > 1 && (
        <section className={styles.profileSection} aria-label="Outras avaliações">
          <Text as="h3" variant="caption1" weight="semibold" tone="secondary">
            Avaliações de {firstName(client?.contact.name ?? "Cliente")}
          </Text>
          <ul className={styles.history}>
            {history.map((item) => (
              <li key={item.id}>
                <HistoryButton type="button" aria-current={item.id === response.id || undefined} disabled={!onSelect} onClick={() => onSelect?.(item.id)}>
                  <ScoreBubble score={item.score} size="sm" />
                  <span>{item.comment || "Sem comentário"}</span>
                  <time dateTime={item.answeredAt}>{dateLabel(item.answeredAt)}</time>
                </HistoryButton>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
