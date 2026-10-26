"use client";

import {
  ArrowClockwiseIcon,
  CameraIcon,
  CaretDownIcon,
  CopyIcon,
  DotsThreeIcon,
  FileTextIcon,
  FolderOpenIcon,
  FunnelIcon,
  IdentificationCardIcon,
  MicrophoneIcon,
  SparkleIcon,
  TargetIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { TagDot, TagPicker } from "@/components/ui/tag-picker";
import { Text } from "@/components/ui/text";
import { useTabList } from "@/hooks/use-tab-list";
import { documentType, firstName, formatDuration, formatFull, formatListTime, formatPhone, formatSize, formatTime, sourceLabels, statusLabels, windowOpen } from "../inbox";
import { whatsappTagCatalog } from "../tags";
import type { ContactStage, TeamMember, WhatsappContact, WhatsappConversation } from "../types";
import styles from "./contact-panel.module.css";

type PanelTab = "ficha" | "origem" | "midia" | "resumo";

const TABS: { value: PanelTab; label: string; icon: typeof IdentificationCardIcon }[] = [
  { value: "ficha", label: "Ficha", icon: IdentificationCardIcon },
  { value: "origem", label: "Origem", icon: TargetIcon },
  { value: "midia", label: "Mídia", icon: FolderOpenIcon },
  { value: "resumo", label: "Resumo", icon: SparkleIcon },
];

const TAB_VALUES = TABS.map((tab) => tab.value);

/** Quanto o resumo de exemplo leva para aparecer, para o estado de carregando ficar à vista. */
const SUMMARY_DELAY = 900;

const MAX_CONTACT_TAGS = 6;

export type ContactPanelProps = {
  conversation: WhatsappConversation;
  team: TeamMember[];
  stages: ContactStage[];
  now: string;
  onClose: () => void;
  onContactChange: (patch: Partial<WhatsappContact>, notice?: string) => void;
};

/** Uma linha da ficha: o rótulo apagado à esquerda e o valor à direita. */
function Fact({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd data-empty={!children || undefined}>{children || "Sem dado"}</dd>
    </div>
  );
}

/** Um grupo de linhas com o título e quantas têm dado. */
function Group({ title, rows }: { title: string; rows: { label: string; value?: string }[] }) {
  const filled = rows.filter((row) => row.value).length;
  return (
    <section className={styles.group}>
      <header>
        <strong>{title}</strong>
        <span>
          {filled} de {rows.length}
        </span>
      </header>
      <dl className={styles.counts}>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd data-empty={!row.value || undefined}>{row.value || "Sem dado"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** O resumo da conversa, de exemplo enquanto a IA não lê as mensagens de verdade. */
function SummaryTab({ conversation, stages }: { conversation: WhatsappConversation; stages: ContactStage[] }) {
  const [state, setState] = useState<"idle" | "loading" | "ready">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const generate = () => {
    setState("loading");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("ready"), SUMMARY_DELAY);
  };

  const { contact } = conversation;
  const name = firstName(contact.name);

  if (state === "loading")
    return (
      <div className={styles.summaryLoading} aria-busy="true" aria-label="Gerando o resumo">
        <Skeleton height="0.875rem" width="40%" />
        <Skeleton height="0.875rem" />
        <Skeleton height="0.875rem" width="85%" />
        <Skeleton shape="rect" height="2rem" />
        <Skeleton shape="rect" height="2rem" />
      </div>
    );

  if (state === "idle")
    return (
      <div className={styles.empty}>
        <EmptyState icon={SparkleIcon} size="sm" title="Resumo da conversa" description={`Organiza o que ${name} quer, onde a conversa parou e o próximo passo.`}>
          <Button size="sm" radius="md" iconStart={<SparkleIcon />} onClick={generate}>
            Gerar resumo
          </Button>
        </EmptyState>
      </div>
    );

  const stage = stages.find((item) => item.id === contact.stage);
  const lastFromContact = conversation.messages.filter((message) => message.author === "contact").at(-1);
  return (
    <div className={styles.stack}>
      <p className={styles.lead}>
        <strong>Resumo</strong>
        {name}
        {contact.company ? `, da ${contact.company},` : ""} conversa com a equipe sobre {contact.tags.length > 0 ? contact.tags.join(", ").toLowerCase() : "um novo projeto"}. A conversa está em {stage?.label.toLowerCase() ?? "andamento"}
        {lastFromContact?.text ? ` e a última mensagem foi: "${lastFromContact.text}"` : ""}.
      </p>
      <Group
        title="Andamento"
        rows={[
          { label: "Etapa", value: stage?.label },
          { label: "Situação", value: statusLabels[conversation.status] },
          { label: "Mensagens trocadas", value: String(conversation.messages.filter((message) => message.kind !== "note").length) },
        ]}
      />
      <section className={styles.group}>
        <header>
          <strong>Próximos passos</strong>
        </header>
        <ol className={styles.steps}>
          {conversation.status === "resolvida" ? <li>Nada pendente: a conversa foi resolvida.</li> : <li>Responder {name} e confirmar o que falta para avançar.</li>}
          {contact.stage === "proposta" && <li>Retomar a proposta enviada e combinar uma data de decisão.</li>}
          {contact.stage === "novo" && <li>Entender o projeto e marcar uma chamada.</li>}
        </ol>
      </section>
      <footer className={styles.summaryFoot}>
        <small>Resumo de exemplo. A leitura pela IA entra junto com a integração do WhatsApp.</small>
        <Button variant="ghost" size="sm" radius="md" iconStart={<ArrowClockwiseIcon />} onClick={generate}>
          Gerar de novo
        </Button>
      </footer>
    </div>
  );
}

/**
 * A ficha do contato ao lado da conversa: quem é, as etiquetas, a etapa do funil com a barra das etapas e, em abas, a
 * ficha, a origem, os arquivos trocados e o resumo.
 */
export function ContactPanel({ conversation, team, stages, now, onClose, onContactChange }: ContactPanelProps) {
  const { toast } = useToast();
  const { contact } = conversation;
  const [tab, setTab] = useState<PanelTab>("ficha");
  const [hoverStage, setHoverStage] = useState<number | null>(null);
  const tabs = useTabList(TAB_VALUES, tab, setTab);
  const stageIndex = stages.findIndex((stage) => stage.id === contact.stage);
  const stage = stages[stageIndex];
  const assignee = team.find((member) => member.id === conversation.assigneeId);
  const open = windowOpen(conversation.windowExpiresAt, now);
  const files = conversation.messages.filter((message) => message.attachment);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copiado`, description: value, tone: "success", feedback: false });
    } catch {
      toast({ title: "Não deu para copiar", description: value, tone: "warning" });
    }
  };

  const move = (next: ContactStage) => {
    if (next.id !== contact.stage) onContactChange({ stage: next.id }, `Etapa: ${next.label}`);
  };

  return (
    <aside className={styles.panel} aria-label={`Ficha de ${contact.name}`}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <Avatar name={contact.name} seed={contact.id} size="md" />
          <span className={styles.identity}>
            <Text as="h2" variant="headline" weight="semibold" truncate>
              {contact.name}
            </Text>
            <Text as="span" variant="footnote" tone="secondary" numeric>
              {formatPhone(contact.phone)}
            </Text>
          </span>
          <DropdownMenu
            label="Ações do contato"
            triggerLabel={`Mais ações de ${contact.name}`}
            icon={<DotsThreeIcon />}
            size="sm"
            searchable={false}
            sections={[
              {
                id: "acoes",
                items: [
                  { id: "telefone", label: "Copiar telefone", icon: CopyIcon, onSelect: () => void copy(formatPhone(contact.phone), "Telefone") },
                  ...(contact.email ? [{ id: "email", label: "Copiar e-mail", icon: CopyIcon, onSelect: () => void copy(contact.email ?? "", "E-mail") }] : []),
                  { id: "funil", label: "Abrir o funil de vendas", icon: FunnelIcon, href: "/crm" as const },
                ],
              },
            ]}
          />
          <IconButton label="Fechar a ficha" variant="ghost" size="sm" onClick={onClose}>
            <XIcon />
          </IconButton>
        </div>

        <TagPicker catalog={whatsappTagCatalog} label={`Etiquetas de ${contact.name}`} value={contact.tags} max={MAX_CONTACT_TAGS} onChange={(tags) => onContactChange({ tags })} />

        <div className={styles.funnel}>
          <span className={styles.funnelName}>Funil de vendas</span>
          <DropdownMenu
            label="Mover de etapa"
            triggerLabel={`Etapa: ${stage?.label ?? "sem etapa"}. Mover de etapa`}
            searchable={false}
            triggerContent={
              <span className={styles.stage}>
                {stage && <TagDot hue={stage.hue} />}
                <strong>{stage?.label ?? "Sem etapa"}</strong>
                <CaretDownIcon aria-hidden="true" />
              </span>
            }
            sections={[
              {
                id: "etapas",
                label: "Funil de vendas",
                items: stages.map((item, index) => ({
                  id: item.id,
                  label: item.label,
                  suffix: item.id === contact.stage ? "Atual" : `${index + 1} de ${stages.length}`,
                  selected: item.id === contact.stage,
                  media: <TagDot hue={item.hue} />,
                  onSelect: () => move(item),
                })),
              },
            ]}
          />
          <div className={styles.progress} role="group" aria-label={`Etapa ${stageIndex + 1} de ${stages.length}. Mover para outra etapa`} onPointerLeave={() => setHoverStage(null)}>
            {stages.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={styles.step}
                data-on={index <= (hoverStage ?? stageIndex) || undefined}
                data-current={index === stageIndex || undefined}
                style={{ "--tone": item.hue } as CSSProperties}
                aria-label={index === stageIndex ? `${item.label}, etapa atual` : `Mover para ${item.label}`}
                aria-current={index === stageIndex ? "step" : undefined}
                onPointerEnter={() => setHoverStage(index)}
                onFocus={() => setHoverStage(index)}
                onBlur={() => setHoverStage(null)}
                onClick={() => move(item)}
              />
            ))}
          </div>
          <span className={styles.stepHint} aria-hidden="true" data-visible={(hoverStage !== null && hoverStage !== stageIndex) || undefined}>
            {hoverStage !== null && hoverStage !== stageIndex ? `Mover para ${stages[hoverStage]?.label}` : " "}
          </span>
        </div>

        <div className={styles.tabs} aria-label="Seções da ficha" {...tabs.listProps}>
          {TABS.map(({ value, label, icon: Glyph }) => (
            <button key={value} type="button" id={`ficha-aba-${value}`} aria-controls={`ficha-painel-${value}`} className={styles.tab} {...tabs.tabProps(value)} onClick={() => setTab(value)}>
              <Glyph weight={tab === value ? "duotone" : "regular"} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <div key={tab} className={styles.body} role="tabpanel" id={`ficha-painel-${tab}`} aria-labelledby={`ficha-aba-${tab}`}>
        {tab === "ficha" && (
          <dl className={styles.facts}>
            <Fact label="Responsável">
              {assignee && (
                <span className={styles.person}>
                  <Avatar name={assignee.name} seed={assignee.id} size="xs" />
                  {assignee.name}
                </span>
              )}
            </Fact>
            <Fact label="Situação">{statusLabels[conversation.status]}</Fact>
            <Fact label="Janela de 24 horas">{open && conversation.windowExpiresAt ? `Aberta até ${formatTime(conversation.windowExpiresAt)}` : "Fechada"}</Fact>
            <Fact label="Telefone">
              <a className={styles.link} href={`tel:+${contact.phone}`}>
                {formatPhone(contact.phone)}
              </a>
            </Fact>
            <Fact label="E-mail">
              {contact.email && (
                <a className={styles.link} href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              )}
            </Fact>
            <Fact label="Empresa">{contact.company}</Fact>
            <Fact label="Cargo">{contact.role}</Fact>
            <Fact label="Cidade">{contact.city}</Fact>
            <Fact label="Contato desde">{formatFull(contact.createdAt).split(" às")[0]}</Fact>
          </dl>
        )}

        {tab === "origem" && (
          <div className={styles.stack}>
            <p className={styles.lead}>
              <strong>Origem</strong>
              {sourceLabels[contact.source]}, {formatFull(contact.createdAt).split(" às")[0]}
            </p>
            <Group
              title="Campanha"
              rows={[
                { label: "Campanha", value: contact.origin?.campaign },
                { label: "Anúncio", value: contact.origin?.ad },
                { label: "UTM source", value: contact.origin?.utmSource },
                { label: "UTM medium", value: contact.origin?.utmMedium },
              ]}
            />
            <Group
              title="Visitante"
              rows={[
                { label: "Página de entrada", value: contact.origin?.landingPage },
                { label: "Dispositivo", value: contact.origin?.device },
                { label: "Localização", value: contact.origin?.location },
              ]}
            />
          </div>
        )}

        {tab === "midia" &&
          (files.length === 0 ? (
            <div className={styles.empty}>
              <EmptyState icon={FolderOpenIcon} size="sm" title="Nenhum arquivo" description="Fotos, áudios e documentos trocados na conversa aparecem aqui." />
            </div>
          ) : (
            <ul className={styles.files}>
              {files.map((message) => {
                const Glyph = message.kind === "image" ? CameraIcon : message.kind === "audio" ? MicrophoneIcon : FileTextIcon;
                const attachment = message.attachment;
                if (!attachment) return null;
                return (
                  <li key={message.id}>
                    <span className={styles.fileGlyph} data-kind={message.kind}>
                      <Glyph weight="duotone" aria-hidden="true" />
                    </span>
                    <span className={styles.fileText}>
                      <strong>{message.kind === "audio" ? "Áudio" : attachment.name}</strong>
                      <small>
                        {message.kind === "audio" ? formatDuration(attachment.duration) : `${documentType(attachment.name)}, ${formatSize(attachment.size)}`}, {message.author === "contact" ? firstName(contact.name) : "equipe"}
                      </small>
                    </span>
                    <time dateTime={message.at}>{formatListTime(message.at, now)}</time>
                  </li>
                );
              })}
            </ul>
          ))}

        {tab === "resumo" && <SummaryTab conversation={conversation} stages={stages} />}
      </div>
    </aside>
  );
}
