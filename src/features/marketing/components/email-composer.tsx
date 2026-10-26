"use client";

import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, CalendarDotsIcon, FloppyDiskIcon, PaperPlaneTiltIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useState, type CSSProperties } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useTabList } from "@/hooks/use-tab-list";
import { emailBlockLabels, emailHues, emailStatuses, estimateReach, formatCount, newEmailBlock } from "../email-catalog";
import type { ContactList, EmailBlock, EmailBlockKind, EmailCampaign, EmailHue } from "../types";
import { DeviceSwitch, type PreviewDevice } from "./device-switch";
import { EmailPreview } from "./email-preview";
import { blockIcons } from "./icons";
import styles from "./email-composer.module.css";

export type EmailComposerProps = {
  campaign: EmailCampaign;
  lists: ContactList[];
  onBack: () => void;
  onSave: (campaign: EmailCampaign) => void;
  onSchedule: (campaign: EmailCampaign, at: string) => void;
  onSend: (campaign: EmailCampaign) => void;
};

const LIMITS = { name: 80, subject: 120, preheader: 140, heading: 140, text: 1200, label: 40, href: 300 };

const halves = ["dados", "previa"] as const;
type Half = (typeof halves)[number];

const blockKinds = Object.keys(emailBlockLabels) as EmailBlockKind[];

const hueOptions = (Object.keys(emailHues) as EmailHue[]).map((hue) => ({
  value: hue,
  label: emailHues[hue].label,
  media: <span className={styles.swatch} style={{ "--hue": emailHues[hue].value } as CSSProperties} aria-hidden="true" />,
}));

const timeOptions = Array.from({ length: 27 }, (_, index) => {
  const minutes = 7 * 60 + index * 30;
  const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return { value, label: value };
});

// O editor do e-mail, numa tela e não numa janela sobre a lista, como todo documento da casa: a barra com o
// voltar, o nome editável, a situação e as ações; embaixo, a ficha à esquerda (envio, público, cor e os blocos
// do conteúdo) e a prévia à direita, redesenhada a cada tecla, no computador ou no celular. No celular as
// duas metades viram abas e as ações vão para a barra flutuante. Nada sai de verdade: salvar, agendar e
// enviar só mexem na lista desta tela até o domínio existir no banco.
export function EmailComposer({ campaign, lists, onBack, onSave, onSchedule, onSend }: EmailComposerProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [draft, setDraft] = useState(campaign);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [half, setHalf] = useState<Half>("dados");
  const [attempted, setAttempted] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const halfTabs = useTabList(halves, half, setHalf);

  const reach = estimateReach(lists, draft.audience);
  const problems = { subject: draft.subject.trim() ? undefined : "Escreva o assunto", audience: draft.audience.length > 0 ? undefined : "Escolha ao menos uma lista" };
  const ready = !problems.subject && !problems.audience;

  const patch = (next: Partial<EmailCampaign>) => setDraft((current) => ({ ...current, ...next }));
  const patchBlock = (id: string, next: Partial<EmailBlock>) => setDraft((current) => ({ ...current, blocks: current.blocks.map((block) => (block.id === id ? ({ ...block, ...next } as EmailBlock) : block)) }));
  const moveBlock = (index: number, step: -1 | 1) =>
    setDraft((current) => {
      const blocks = [...current.blocks];
      const target = index + step;
      if (target < 0 || target >= blocks.length) return current;
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...current, blocks };
    });
  const removeBlock = (id: string) => setDraft((current) => ({ ...current, blocks: current.blocks.filter((block) => block.id !== id) }));
  const addBlock = (kind: EmailBlockKind) => setDraft((current) => ({ ...current, blocks: [...current.blocks, newEmailBlock(kind)] }));
  const toggleList = (id: string, on: boolean) => patch({ audience: on ? [...draft.audience, id] : draft.audience.filter((item) => item !== id) });

  const guard = (next: () => void) => {
    setAttempted(true);
    if (!ready) {
      setHalf("dados");
      return;
    }
    next();
  };

  useFloatingActionsRegistration(
    mobile && !scheduling && !confirming
      ? {
          primary: { label: "Enviar", icon: <PaperPlaneTiltIcon weight="bold" />, onClick: () => guard(() => setConfirming(true)) },
          extras: [
            { label: "Agendar", icon: <CalendarDotsIcon weight="bold" />, onClick: () => guard(() => setScheduling(true)) },
            { label: "Salvar rascunho", icon: <FloppyDiskIcon weight="bold" />, onClick: () => onSave(draft) },
          ],
          cancel: { label: "Voltar aos e-mails", onClick: onBack },
        }
      : null,
  );

  const status = emailStatuses[draft.status];

  return (
    <div className={styles.composer}>
      <header className={styles.bar}>
        <IconButton label="Voltar aos e-mails" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon />
        </IconButton>
        <input className={styles.nameInput} type="text" value={draft.name} maxLength={LIMITS.name} aria-label="Nome do e-mail" placeholder="Nome do e-mail" onChange={(event) => patch({ name: event.target.value })} />
        <span className={styles.status}>
          <Badge tone={status.tone} size="sm">
            {status.label}
          </Badge>
        </span>
        <div className={styles.barActions}>
          <Button size="sm" radius="md" variant="ghost" iconStart={<FloppyDiskIcon />} onClick={() => onSave(draft)}>
            Salvar rascunho
          </Button>
          <Button size="sm" radius="md" variant="outline" iconStart={<CalendarDotsIcon />} onClick={() => guard(() => setScheduling(true))}>
            Agendar
          </Button>
          <Button size="sm" radius="md" iconStart={<PaperPlaneTiltIcon />} onClick={() => guard(() => setConfirming(true))}>
            Enviar
          </Button>
        </div>
      </header>

      <div className={styles.halves} aria-label="O que ver do e-mail" {...halfTabs.listProps}>
        <button type="button" className={styles.half} {...halfTabs.tabProps("dados")} onClick={() => setHalf("dados")}>
          Dados
        </button>
        <button type="button" className={styles.half} {...halfTabs.tabProps("previa")} onClick={() => setHalf("previa")}>
          Prévia
        </button>
      </div>

      <div className={styles.work} data-half={half}>
        <section className={styles.form} aria-label="Dados do e-mail">
          <fieldset className={styles.group}>
            <legend className={styles.legend}>Envio</legend>
            <Field label="Assunto" required error={problems.subject} revealError={attempted}>
              <Input value={draft.subject} maxLength={LIMITS.subject} placeholder="O que faz a pessoa abrir" onChange={(event) => patch({ subject: event.target.value })} />
            </Field>
            <Field label="Texto de apoio">
              <Input value={draft.preheader} maxLength={LIMITS.preheader} placeholder="Aparece ao lado do assunto na caixa de entrada" onChange={(event) => patch({ preheader: event.target.value })} />
            </Field>
            <div className={styles.from}>
              <Text as="span" variant="caption1" tone="secondary">
                Remetente
              </Text>
              <Text as="span" variant="footnote" weight="medium">
                {draft.fromName}, {draft.fromEmail}
              </Text>
            </div>
          </fieldset>

          <fieldset className={styles.group} aria-describedby={attempted && problems.audience ? "email-audience-error" : undefined}>
            <legend className={styles.legend}>Para quem vai</legend>
            <ul className={styles.lists}>
              {lists.map((list) => (
                <li key={list.id}>
                  <Checkbox checked={draft.audience.includes(list.id)} onChange={(event) => toggleList(list.id, event.target.checked)}>
                    <span className={styles.listCopy}>
                      <span className={styles.listName}>{list.name}</span>
                      <small>
                        {formatCount(list.count)} contatos, {list.kind}
                      </small>
                    </span>
                  </Checkbox>
                </li>
              ))}
            </ul>
            <p className={styles.reach} data-invalid={(attempted && Boolean(problems.audience)) || undefined}>
              {attempted && problems.audience ? (
                <span id="email-audience-error" role="alert">
                  {problems.audience}
                </span>
              ) : (
                <>
                  Alcance estimado: <strong>{formatCount(reach)} contatos</strong>
                </>
              )}
            </p>
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>Aparência</legend>
            <Field label="Cor do e-mail">
              <Select label="Cor do e-mail" options={hueOptions} value={draft.hue} onChange={(hue) => patch({ hue })} />
            </Field>
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>Conteúdo</legend>
            {draft.blocks.length === 0 && (
              <Text variant="footnote" tone="secondary">
                O e-mail está vazio. Adicione um título, um parágrafo e um botão para começar.
              </Text>
            )}
            <ol className={styles.blocks}>
              {draft.blocks.map((block, index) => {
                const Glyph = blockIcons[block.kind];
                return (
                  <li key={block.id} className={styles.block}>
                    <header className={styles.blockHead}>
                      <span className={styles.blockGlyph} aria-hidden="true">
                        <Glyph weight="bold" />
                      </span>
                      <Text as="span" variant="footnote" weight="semibold" className={styles.blockName}>
                        {emailBlockLabels[block.kind]}
                      </Text>
                      <IconButton label={`Subir ${emailBlockLabels[block.kind]}`} variant="ghost" size="sm" disabled={index === 0} onClick={() => moveBlock(index, -1)}>
                        <ArrowUpIcon />
                      </IconButton>
                      <IconButton label={`Descer ${emailBlockLabels[block.kind]}`} variant="ghost" size="sm" disabled={index === draft.blocks.length - 1} onClick={() => moveBlock(index, 1)}>
                        <ArrowDownIcon />
                      </IconButton>
                      <IconButton label={`Remover ${emailBlockLabels[block.kind]}`} variant="ghost" size="sm" onClick={() => removeBlock(block.id)}>
                        <TrashIcon />
                      </IconButton>
                    </header>
                    <BlockFields block={block} onChange={(next) => patchBlock(block.id, next)} />
                  </li>
                );
              })}
            </ol>
            <DropdownMenu
              label="Adicionar bloco"
              triggerLabel="Adicionar bloco"
              searchable={false}
              trigger={{ variant: "outline", radius: "md" }}
              triggerContent={
                <span className={styles.addTrigger}>
                  <PlusIcon aria-hidden="true" />
                  Adicionar bloco
                </span>
              }
              sections={[{ id: "blocos", label: "Blocos", items: blockKinds.map((kind) => ({ id: kind, label: emailBlockLabels[kind], icon: blockIcons[kind], onSelect: () => addBlock(kind) })) }]}
            />
          </fieldset>
        </section>

        <section className={styles.preview} aria-label="Prévia do e-mail">
          <div className={styles.previewBar}>
            <Text as="h2" variant="subheadline" weight="semibold">
              Prévia
            </Text>
            <Text as="span" variant="caption1" tone="secondary" className={styles.previewHint}>
              Com os dados de um contato de exemplo
            </Text>
            <DeviceSwitch value={device} onChange={setDevice} />
          </div>
          <EmailPreview subject={draft.subject} preheader={draft.preheader} fromName={draft.fromName} fromEmail={draft.fromEmail} hue={draft.hue} blocks={draft.blocks} size={device} />
        </section>
      </div>

      {scheduling && <ScheduleDialog onClose={() => setScheduling(false)} onConfirm={(at) => onSchedule(draft, at)} />}

      <ConfirmDialog
        open={confirming}
        title={`Enviar para ${formatCount(reach)} contatos?`}
        description={`“${draft.subject}” sai agora, de ${draft.fromName}. Depois de enviado, o e-mail não se edita mais: abre o relatório.`}
        confirmLabel="Enviar agora"
        pendingLabel="Enviando"
        tone="default"
        icon={<PaperPlaneTiltIcon weight="duotone" />}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onSend(draft);
        }}
      />
    </div>
  );
}

function BlockFields({ block, onChange }: { block: EmailBlock; onChange: (next: Partial<EmailBlock>) => void }) {
  switch (block.kind) {
    case "heading":
      return (
        <Field label="Texto do título">
          <Input size="sm" value={block.text} maxLength={LIMITS.heading} onChange={(event) => onChange({ text: event.target.value })} />
        </Field>
      );
    case "text":
      return (
        <Field label="Texto">
          <Textarea size="sm" rows={4} value={block.text} maxLength={LIMITS.text} onChange={(event) => onChange({ text: event.target.value })} />
        </Field>
      );
    case "button":
      return (
        <div className={styles.pair}>
          <Field label="Rótulo">
            <Input size="sm" value={block.label} maxLength={LIMITS.label} onChange={(event) => onChange({ label: event.target.value })} />
          </Field>
          <Field label="Link">
            <Input size="sm" type="url" value={block.href} maxLength={LIMITS.href} onChange={(event) => onChange({ href: event.target.value })} />
          </Field>
        </div>
      );
    case "image":
      return (
        <Field label="Legenda da imagem">
          <Input size="sm" value={block.caption} maxLength={LIMITS.heading} onChange={(event) => onChange({ caption: event.target.value })} />
        </Field>
      );
    case "list":
      return (
        <Field label="Itens, um por linha">
          <Textarea size="sm" rows={4} value={block.items.join("\n")} maxLength={LIMITS.text} onChange={(event) => onChange({ items: event.target.value.split("\n") })} />
        </Field>
      );
    case "quote":
      return (
        <>
          <Field label="Depoimento">
            <Textarea size="sm" rows={3} value={block.text} maxLength={LIMITS.text} onChange={(event) => onChange({ text: event.target.value })} />
          </Field>
          <Field label="Quem disse">
            <Input size="sm" value={block.author} maxLength={LIMITS.heading} onChange={(event) => onChange({ author: event.target.value })} />
          </Field>
        </>
      );
    case "divider":
      return (
        <Text variant="caption1" tone="tertiary">
          Uma linha fina separando as partes do e-mail.
        </Text>
      );
  }
}

// O agendamento: o dia no calendário da casa e o horário numa lista de meia em meia hora, no fuso de São Paulo.
function ScheduleDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (at: string) => void }) {
  const [today] = useState(() => new Date());
  const [day, setDay] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("09:00");
  const mobile = useMediaQuery(MOBILE_QUERY);
  const confirm = () => {
    if (!day) return;
    const [hours, minutes] = time.split(":").map(Number);
    const at = new Date(day);
    at.setHours(hours, minutes, 0, 0);
    onConfirm(at.toISOString());
  };
  useFloatingActionsRegistration(mobile ? { primary: { label: "Agendar", icon: <CalendarDotsIcon weight="bold" />, disabled: !day, onClick: confirm }, cancel: { label: "Cancelar", onClick: onClose } } : null);

  return (
    <Dialog open onClose={onClose} label="Agendar envio" size="sm" surface="solid">
      <DialogHeader title="Agendar envio" description="O e-mail sai sozinho no dia e na hora escolhidos" onClose={onClose} />
      <div className={styles.schedule}>
        <Field label="Dia" required>
          <DatePicker value={day} min={today} onChange={setDay} placeholder="Escolha o dia" />
        </Field>
        <Field label="Horário" required>
          <Select label="Horário" options={timeOptions} value={time} onChange={setTime} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" size="sm" radius="md" onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" radius="md" iconStart={<CalendarDotsIcon />} disabled={!day} onClick={confirm}>
          Agendar
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
