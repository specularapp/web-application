"use client";

import {
  AddressBookIcon,
  BriefcaseIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  CurrencyCircleDollarIcon,
  DownloadSimpleIcon,
  EyeIcon,
  FileDashedIcon,
  IdentificationCardIcon,
  LinkIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  ReceiptIcon,
  SignatureIcon,
  TagIcon,
  UserIcon,
  XCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import Link from "next/link";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { TextLink } from "@/components/ui/link";
import { ProfileFact, ProfileFacts, ProfileSection } from "@/components/ui/profile";
import { SheetSwitcher } from "@/components/ui/sheet-switcher";
import { Text } from "@/components/ui/text";
import { Tooltip } from "@/components/ui/tooltip";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { formatMoney } from "@/lib/utils/format";
import { ContractDocument, partyRoles } from "../document";
import { contractKinds, contractSources, contractStatuses, dateOf, shortDate } from "../labels";
import type { Contract, ContractEvent } from "../summary";
import { ContractMenu, type ContractMenuActions } from "./contract-menu";
import { PdfPages } from "./pdf-pages";
import { SignatureFieldMark } from "./signature-field-mark";
import styles from "./contract-dialog.module.css";

export type ContractDialogProps = ContractMenuActions & {
  /** O contrato aberto; nulo mantém a janela montada e fechada, para a saída animar. */
  contract: Contract | null;
  onClose: () => void;
};

/** Quanto o dedo precisa andar na horizontal para o arrasto virar troca de metade, e não rolagem torta. */
const SWIPE = 56;

type ContractTab = "document" | "tracking";

const contractTabs = [
  { id: "document", label: "Documento" },
  { id: "tracking", label: "Acompanhamento" },
] as const satisfies readonly { id: ContractTab; label: string }[];

const whenLabel = (iso: string) => format(parseISO(iso), "d MMM., HH:mm", { locale: ptBR });

/* O que cada registro da linha do tempo diz e com que glifo. */
const eventMeta: Record<ContractEvent["kind"], { label: string; icon: typeof FileDashedIcon }> = {
  created: { label: "criou o contrato", icon: FileDashedIcon },
  sent: { label: "enviou para assinatura", icon: PaperPlaneTiltIcon },
  resent: { label: "reenviou o convite", icon: PaperPlaneTiltIcon },
  viewed: { label: "abriu o documento", icon: EyeIcon },
  signed: { label: "assinou", icon: SignatureIcon },
  cancelled: { label: "cancelou o contrato", icon: XCircleIcon },
};

// A janela do contrato (2026-09-14): a moldura de trabalho da casa, a `Dialog` `xl`, a mesma da ficha do
// projeto e da tarefa. À esquerda o documento inteiro, como a parte o vê (a folha escrita ou as páginas do
// PDF com os campos), os números em azulejo e os detalhes; à direita as partes, cada uma com a situação da
// assinatura e o link pessoal para copiar, e a linha do tempo. Os atalhos do topo são só em glifo: editar e
// enviar no rascunho, reenviar no que aguarda, baixar o PDF, e o leque com o resto. No celular, uma metade
// por vez, Documento ou Acompanhamento, com o `SheetSwitcher` acima da bandeja e o arrasto para o lado, e as
// ações na barra flutuante.
export function ContractDialog({ contract, onClose, ...actions }: ContractDialogProps) {
  const [tab, setTab] = useState<ContractTab>("document");
  const [seen, setSeen] = useState(contract?.id);
  if (contract && contract.id !== seen) {
    setSeen(contract.id);
    setTab("document");
  }

  return (
    <Dialog
      open={Boolean(contract)}
      onClose={onClose}
      label={contract ? `Contrato ${contract.reference}` : "Contrato"}
      size="xl"
      focusOnOpen={false}
      above={contract && <SheetSwitcher label="O que ver do contrato" options={contractTabs} value={tab} onChange={setTab} />}
    >
      {contract && <ContractDetail key={contract.id} contract={contract} tab={tab} onTabChange={setTab} onClose={onClose} {...actions} />}
    </Dialog>
  );
}

type ContractDetailProps = ContractMenuActions & {
  contract: Contract;
  tab: ContractTab;
  onTabChange: (tab: ContractTab) => void;
  onClose: () => void;
};

function ContractDetail({ contract, tab, onTabChange, onClose, onEdit, onSend, onDownload, onCancel }: ContractDetailProps) {
  const { toast } = useToast();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const status = contractStatuses[contract.status];
  const kind = contractKinds[contract.kind];
  const date = dateOf(contract);
  const draft = contract.status === "draft";
  const open = contract.status === "sent" || contract.status === "partial";
  const signedCount = contract.parties.filter((party) => party.signedAt).length;
  const events = [...contract.events].sort((a, b) => b.at.localeCompare(a.at));

  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onSwipeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    if ((event.target as HTMLElement).closest("input, textarea, button, a, [role='button'], [role='menuitem']")) return;
    swipe.current = { x: event.clientX, y: event.clientY };
  };
  const onSwipeCancel = () => {
    swipe.current = null;
  };
  const onSwipeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const from = swipe.current;
    swipe.current = null;
    if (!from) return;
    const moveX = event.clientX - from.x;
    const moveY = event.clientY - from.y;
    if (Math.abs(moveX) < SWIPE || Math.abs(moveY) > Math.abs(moveX)) return;
    onTabChange(moveX < 0 ? "tracking" : "document");
  };

  /* O link pessoal de uma parte, copiado do próprio endereço da aplicação: é o mesmo que vai no e-mail. */
  const copyLink = async (token: string, name: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/contrato/${token}`);
      toast({ title: "Link copiado", description: `O link de assinatura de ${name} está na área de transferência.`, tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: "Copie o endereço pela barra do navegador na página pública.", tone: "warning" });
    }
  };

  useFloatingActionsRegistration(
    mobile
      ? {
          primary: draft && onSend ? { label: "Enviar", icon: <PaperPlaneTiltIcon weight="bold" />, onClick: onSend } : open && onSend ? { label: "Reenviar", icon: <PaperPlaneTiltIcon weight="bold" />, onClick: onSend } : undefined,
          extras: [
            ...(draft && onEdit ? [{ label: "Editar contrato", icon: <PencilSimpleIcon weight="bold" />, onClick: onEdit }] : []),
            ...(onDownload ? [{ label: "Baixar PDF", icon: <DownloadSimpleIcon weight="bold" />, onClick: onDownload }] : []),
          ],
          cancel: { label: "Fechar contrato", onClick: onClose },
        }
      : null,
  );

  return (
    <div className={styles.dialog}>
      <header className={styles.top}>
        <nav className={styles.route} aria-label="Onde o contrato mora">
          <Link href="/contratos" className={styles.crumb}>
            Contratos
          </Link>
          {contract.client && (
            <>
              <span className={styles.slash} aria-hidden="true">
                /
              </span>
              <Link href={`/clientes/${contract.client.id}` as Route} className={styles.crumb}>
                <AddressBookIcon aria-hidden="true" />
                {contract.client.company ?? contract.client.name}
              </Link>
            </>
          )}
          <Badge tone="neutral" variant="soft" size="sm" className={styles.reference}>
            {contract.reference}
          </Badge>
        </nav>
        <div className={styles.actions}>
          {draft && onEdit && (
            <Tooltip content="Editar contrato">
              <IconButton label="Editar contrato" variant="outline" size="sm" radius="md" onClick={onEdit}>
                <PencilSimpleIcon />
              </IconButton>
            </Tooltip>
          )}
          {onDownload && (
            <Tooltip content="Baixar PDF">
              <IconButton label="Baixar PDF" variant="outline" size="sm" radius="md" onClick={onDownload}>
                <DownloadSimpleIcon />
              </IconButton>
            </Tooltip>
          )}
          {(draft || open) && onSend && (
            <Tooltip content={draft ? "Enviar para assinatura" : "Reenviar convite"}>
              <IconButton label={draft ? "Enviar para assinatura" : "Reenviar convite"} size="sm" radius="md" onClick={onSend}>
                <PaperPlaneTiltIcon />
              </IconButton>
            </Tooltip>
          )}
          <ContractMenu contract={contract} onEdit={draft ? onEdit : undefined} onSend={onSend} onDownload={onDownload} onCancel={onCancel} />
          <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
            <XIcon />
          </IconButton>
        </div>
      </header>

      <div className={styles.body} data-tab={tab} onPointerDown={onSwipeStart} onPointerUp={onSwipeEnd} onPointerCancel={onSwipeCancel}>
        <section className={styles.main} aria-label="Documento do contrato">
          <div className={styles.identity}>
            <div className={styles.naming}>
              <Text as="h2" variant="title2" weight="semibold">
                {contract.title}
              </Text>
              <Badge size="sm" hue={kind.hue}>
                {kind.label}
              </Badge>
              <Badge tone={status.tone} size="sm" icon={<status.icon />}>
                {status.label}
              </Badge>
            </div>
            {contract.description && (
              <Text variant="callout" tone="secondary">
                {contract.description}
              </Text>
            )}
          </div>

          <dl className={styles.tiles}>
            <Tile label="Assinaturas" value={`${signedCount} de ${contract.parties.length}`} />
            <Tile label={contract.status === "signed" ? "Assinado" : open ? "Convite vale até" : "Criado"} value={contract.status === "signed" && contract.signedAt ? shortDate(contract.signedAt) : open && contract.expiresAt ? shortDate(contract.expiresAt) : shortDate(contract.createdAt)} tone={open ? date.tone : undefined} />
            <Tile label="Valor" value={contract.amount === null ? "A combinar" : formatMoney(contract.amount)} />
            <Tile label="Origem" value={contractSources[contract.source].label} />
          </dl>

          {/* O documento como a parte o vê: a folha escrita, ou as páginas do PDF com os campos marcados e
              o traço de quem já assinou. */}
          <div className={styles.paper}>
            {contract.file ? (
              <PdfPages
                src={`/api/contratos/${contract.id}/arquivo`}
                overlay={(page) =>
                  contract.fields
                    .filter((field) => field.page === page)
                    .map((field) => {
                      const party = contract.parties.find((entry) => entry.id === field.partyId);
                      return party ? <SignatureFieldMark key={field.id} field={field} party={party} /> : null;
                    })
                }
              />
            ) : (
              <ContractDocument contract={contract} />
            )}
          </div>

          <ProfileSection title="Detalhes">
            <ProfileFacts>
              <ProfileFact icon={AddressBookIcon} label="Cliente">
                {contract.client ? (
                  <TextLink href={`/clientes/${contract.client.id}` as Route}>{contract.client.company ?? contract.client.name}</TextLink>
                ) : (
                  <Text as="span" variant="subheadline" tone="tertiary">
                    Não escolhido
                  </Text>
                )}
              </ProfileFact>
              <ProfileFact icon={UserIcon} label="Responsável">
                <span className={styles.person}>
                  <Avatar name={contract.owner.name} src={contract.owner.avatarUrl ?? undefined} size="xs" />
                  <Text as="span" variant="subheadline" weight="medium" truncate>
                    {contract.owner.name}
                  </Text>
                </span>
              </ProfileFact>
              {contract.project && (
                <ProfileFact icon={BriefcaseIcon} label="Projeto">
                  <TextLink href={`/projetos/${contract.project.id}` as Route}>{contract.project.name}</TextLink>
                </ProfileFact>
              )}
              {contract.quote && (
                <ProfileFact icon={ReceiptIcon} label="Orçamento">
                  <TextLink href={`/orcamentos/${contract.quote.id}` as Route}>
                    {contract.quote.number}, {formatMoney(contract.quote.amount)}
                  </TextLink>
                </ProfileFact>
              )}
              <ProfileFact icon={CalendarBlankIcon} label="Criado em">
                <Text as="span" variant="subheadline" weight="medium">
                  {shortDate(contract.createdAt)}
                </Text>
              </ProfileFact>
              {contract.sentAt && (
                <ProfileFact icon={PaperPlaneTiltIcon} label="Enviado em">
                  <Text as="span" variant="subheadline" weight="medium">
                    {shortDate(contract.sentAt)}
                  </Text>
                </ProfileFact>
              )}
              <ProfileFact icon={CurrencyCircleDollarIcon} label="Valor">
                <Text as="span" variant="subheadline" weight="medium">
                  {contract.amount === null ? "A combinar" : formatMoney(contract.amount)}
                </Text>
              </ProfileFact>
              <ProfileFact icon={TagIcon} label="Tipo">
                <Text as="span" variant="subheadline" weight="medium">
                  {kind.label}
                </Text>
              </ProfileFact>
              <ProfileFact icon={IdentificationCardIcon} label="Identificador">
                <Text as="span" variant="subheadline" weight="medium">
                  {contract.reference}
                </Text>
              </ProfileFact>
            </ProfileFacts>
          </ProfileSection>
        </section>

        <aside className={styles.side} aria-label="Partes e linha do tempo">
          <section className={styles.sideBlock} aria-labelledby="contract-parties">
            <Text as="h3" id="contract-parties" variant="callout" weight="semibold">
              Partes
            </Text>
            <ul className={styles.parties}>
              {contract.parties.map((party) => (
                <li key={party.id} className={styles.party}>
                  <Avatar name={party.name} src={party.avatarUrl ?? undefined} size="sm" />
                  <span className={styles.partyCopy}>
                    <Text as="span" variant="footnote" weight="medium" truncate>
                      {party.name}
                    </Text>
                    <Text as="span" variant="caption1" tone="secondary" truncate>
                      {partyRoles[party.role]}, {party.email || "sem e-mail"}
                    </Text>
                    <Badge tone={party.signedAt ? "success" : party.viewedAt ? "info" : "neutral"} size="sm" icon={party.signedAt ? <CheckCircleIcon /> : undefined} className={styles.partyState}>
                      {party.signedAt ? `Assinou ${whenLabel(party.signedAt)}` : party.viewedAt ? `Abriu ${whenLabel(party.viewedAt)}` : draft ? "Aguardando envio" : "Não abriu"}
                    </Badge>
                  </span>
                  {!draft && (
                    <IconButton label={`Copiar link de assinatura de ${party.name}`} variant="ghost" size="sm" onClick={() => copyLink(party.token, party.name)}>
                      <LinkIcon />
                    </IconButton>
                  )}
                </li>
              ))}
              {!contract.client && (
                <li>
                  <Text variant="footnote" tone="secondary">
                    Escolha quem contrata no editor para a segunda parte entrar.
                  </Text>
                </li>
              )}
            </ul>
          </section>

          <section className={styles.sideBlock} aria-labelledby="contract-timeline">
            <Text as="h3" id="contract-timeline" variant="callout" weight="semibold">
              Linha do tempo
            </Text>
            <ol className={styles.events}>
              {events.map((event) => {
                const meta = eventMeta[event.kind];
                return (
                  <li key={event.id} className={styles.event}>
                    <span className={styles.eventGlyph} aria-hidden="true">
                      <meta.icon weight="duotone" />
                    </span>
                    <div className={styles.eventCopy}>
                      <Text as="p" variant="footnote">
                        {event.actor && (
                          <Text as="span" variant="footnote" weight="medium">
                            {event.actor}{" "}
                          </Text>
                        )}
                        {meta.label}
                      </Text>
                      <time dateTime={event.at}>
                        <Text as="span" variant="caption1" tone="tertiary">
                          {whenLabel(event.at)}
                        </Text>
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: BadgeTone }) {
  return (
    <div className={styles.tile} data-tone={tone}>
      <Text as="dt" variant="caption1" tone="secondary" truncate>
        {label}
      </Text>
      <Text as="dd" variant="title3" weight="semibold" className={styles.tileValue}>
        {value}
      </Text>
    </div>
  );
}
