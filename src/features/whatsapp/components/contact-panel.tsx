"use client";

import {
  CameraIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CopyIcon,
  DotsThreeIcon,
  FileTextIcon,
  FolderOpenIcon,
  FunnelIcon,
  IdentificationCardIcon,
  MicrophoneIcon,
  PlusIcon,
  TagSimpleIcon,
  TargetIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { TagDot, tagSections } from "@/components/ui/tag-picker";
import { Text } from "@/components/ui/text";
import { useTabList } from "@/hooks/use-tab-list";
import { cx } from "@/lib/utils/cx";
import { documentType, firstName, formatDuration, formatFull, formatListTime, formatPhone, formatSize, formatTime, sourceLabels, statusLabels, windowOpen } from "../inbox";
import { whatsappTagCatalog } from "../tags";
import type { ContactStage, TeamMember, WhatsappContact, WhatsappConversation } from "../types";
/* O desenho da ficha do lead da Le Ange, o mesmo da ficha da oportunidade (2026-10-26, a pedido: "seguindo
   literalmente o padrão da Le Ange"): o contato da conversa é o lead do funil, então a lateral do WhatsApp é a
   mesma ficha, e as classes vêm de lá para as duas nunca saírem de sincronia. */
import profile from "@/features/crm/components/opportunity-profile.module.css";
import styles from "./contact-panel.module.css";

type PanelTab = "ficha" | "origem" | "midia";

const TABS: { value: PanelTab; label: string; icon: typeof IdentificationCardIcon }[] = [
  { value: "ficha", label: "Principal", icon: IdentificationCardIcon },
  { value: "origem", label: "Rastreio", icon: TargetIcon },
  { value: "midia", label: "Mídia", icon: FolderOpenIcon },
];

const TAB_VALUES = TABS.map((tab) => tab.value);

const MAX_CONTACT_TAGS = 6;

export type ContactPanelProps = {
  conversation: WhatsappConversation;
  team: TeamMember[];
  stages: ContactStage[];
  now: string;
  onClose: () => void;
  onContactChange: (patch: Partial<WhatsappContact>, notice?: string) => void;
};

/** Uma linha da ficha, na receita da ficha do lead: o rótulo apagado à esquerda e o valor à direita. */
function Fact({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className={profile.field}>
      <dt title={label}>{label}</dt>
      <dd>
        <span className={profile.static} data-empty={!children || undefined}>
          {children || "Selecione"}
        </span>
      </dd>
    </div>
  );
}

/** Um grupo de linhas com o título e quantas têm dado, no bloco de rastreio da ficha do lead. */
function Group({ title, rows }: { title: string; rows: { label: string; value?: string }[] }) {
  const filled = rows.filter((row) => row.value).length;
  return (
    <div className={profile.tracked}>
      <strong>{title}</strong>
      <span>
        {filled} de {rows.length}
      </span>
      <dl className={profile.counts}>
        {rows.map((row) => (
          <div key={row.label}>
            <dt title={row.label}>{row.label}</dt>
            <dd data-empty={!row.value || undefined}>{row.value || "Sem dado"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * A ficha do contato ao lado da conversa, no desenho compacto da ficha do lead da Le Ange: quem é, as etiquetas, a
 * etapa do funil com a barra das etapas e, em abas, a ficha, o rastreio e os arquivos trocados. O resumo saiu
 * (2026-10-26, a pedido).
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

  const removeTag = (tag: string) => onContactChange({ tags: contact.tags.filter((item) => item !== tag) });

  return (
    <aside className={cx(styles.panel, profile.profile, profile.compact)} aria-label={`Ficha de ${contact.name}`}>
      <header className={profile.head}>
        <div className={profile.titleRow}>
          <IconButton label="Fechar a ficha" variant="ghost" size="sm" className={profile.headButton} onClick={onClose}>
            <CaretLeftIcon />
          </IconButton>
          <span className={profile.name}>
            <Text as="h2" variant="title3" weight="semibold">
              {contact.name}
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
        </div>

        {/* O telefone no lugar do código do lead, copiável, e as etiquetas com o X e o "+" de acrescentar. */}
        <div className={profile.tagRow}>
          <button type="button" className={profile.number} title="Copiar o telefone" onClick={() => void copy(formatPhone(contact.phone), "Telefone")}>
            {formatPhone(contact.phone)}
          </button>
          {contact.tags.map((tag) => (
            <span key={tag} className={profile.tag} style={{ "--tag": whatsappTagCatalog.hueOf(tag) } as CSSProperties}>
              <span className={profile.tagIcon} aria-hidden="true">
                <TagSimpleIcon weight="fill" />
              </span>
              {tag}
              <button type="button" aria-label={`Tirar a etiqueta ${tag}`} onClick={() => removeTag(tag)}>
                <XIcon />
              </button>
            </span>
          ))}
          <DropdownMenu
            label={`Etiquetas de ${contact.name}`}
            triggerLabel={contact.tags.length === 0 ? "Adicionar etiqueta" : `Escolher etiquetas, ${contact.tags.length} de ${MAX_CONTACT_TAGS}`}
            sections={tagSections(whatsappTagCatalog, contact.tags, (tags) => onContactChange({ tags }), MAX_CONTACT_TAGS)}
            triggerContent={
              <span className={profile.addTag}>
                <PlusIcon aria-hidden="true" />
                {contact.tags.length === 0 ? "Adicionar etiqueta" : `${contact.tags.length}/${MAX_CONTACT_TAGS}`}
              </span>
            }
          />
        </div>

        <div className={profile.funnel}>
          <span className={profile.funnelName}>Funil de vendas</span>
          <DropdownMenu
            label="Mover de etapa"
            triggerLabel={`Etapa: ${stage?.label ?? "sem etapa"}. Mover de etapa`}
            searchable={false}
            triggerContent={
              <span className={profile.stage}>
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
          {/* A linha das etapas também move: cada pedaço é a etapa, na cor dela; passar o mouse mostra o nome e
              acende até ali, e o clique leva o contato para lá. */}
          <div className={profile.progress} role="group" aria-label={`Etapa ${stageIndex + 1} de ${stages.length}. Mover para outra etapa`} onPointerLeave={() => setHoverStage(null)}>
            {stages.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={profile.step}
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
          <span className={profile.stepHint} aria-hidden="true" data-visible={(hoverStage !== null && hoverStage !== stageIndex) || undefined}>
            {hoverStage !== null && hoverStage !== stageIndex ? `Mover para ${stages[hoverStage]?.label}` : " "}
          </span>
        </div>

        <div className={profile.sections} aria-label="Seções da ficha" {...tabs.listProps}>
          {TABS.map(({ value, label, icon: Glyph }) => (
            <button key={value} type="button" id={`ficha-aba-${value}`} aria-controls={`ficha-painel-${value}`} className={profile.section} {...tabs.tabProps(value)} onClick={() => setTab(value)}>
              <Glyph weight={tab === value ? "duotone" : "regular"} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <div key={tab} className={profile.body} role="tabpanel" id={`ficha-painel-${tab}`} aria-labelledby={`ficha-aba-${tab}`}>
        {tab === "ficha" && (
          <dl className={profile.fields}>
            <Fact label="Responsável">
              {assignee && (
                <span className={styles.person}>
                  <Avatar name={assignee.name} seed={assignee.id} size="xs" />
                  {assignee.name}
                </span>
              )}
            </Fact>
            <Fact label="Situação">{statusLabels[conversation.status]}</Fact>
            <Fact label="Janela 24h">{open && conversation.windowExpiresAt ? `Aberta até ${formatTime(conversation.windowExpiresAt)}` : "Fechada"}</Fact>
            <Fact label="Telefone">
              <a className={profile.link} href={`tel:+${contact.phone}`}>
                {formatPhone(contact.phone)}
              </a>
            </Fact>
            <Fact label="E-mail">
              {contact.email && (
                <a className={profile.link} href={`mailto:${contact.email}`}>
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
          <div className={profile.stats}>
            <div className={profile.tracked}>
              <strong>Origem</strong>
              <span>{sourceLabels[contact.source]}</span>
              <dl className={profile.counts}>
                <div>
                  <dt>Entrou em</dt>
                  <dd>{formatFull(contact.createdAt).split(" às")[0]}</dd>
                </div>
              </dl>
            </div>
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

      </div>
    </aside>
  );
}
