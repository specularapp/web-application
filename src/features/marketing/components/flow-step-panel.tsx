"use client";

import { BracketsCurlyIcon, CopyIcon, PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import {
  flowActions,
  flowChannels,
  flowConditionFields,
  flowDelayUnits,
  flowInputFields,
  flowOperators,
  flowSteps,
  flowTriggers,
  flowVariables,
  newFlowId,
} from "../flow-catalog";
import type { FlowActionKind, FlowChannel, FlowDelayUnit, FlowInputField, FlowOperator, FlowStep, FlowStepData, FlowTriggerKind } from "../types";
import { channelIcons, stepIcons } from "./icons";
import styles from "./flow-step-panel.module.css";

export type FlowStepPanelProps = {
  step: FlowStep;
  flows: { id: string; name: string }[];
  onChange: (step: FlowStep) => void;
  onClose?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

const LIMITS = { title: 60, text: 1000, short: 120, button: 24 };
const MAX = { texts: 5, buttons: 3, triggers: 4, actions: 6, rules: 5, variants: 4 };

const channelOptions = (Object.keys(flowChannels) as FlowChannel[]).map((channel) => {
  const Glyph = channelIcons[channel];
  return { value: channel, label: flowChannels[channel].label, media: <Glyph weight="fill" style={{ color: flowChannels[channel].hue }} aria-hidden="true" /> };
});
const triggerOptions = (Object.keys(flowTriggers) as FlowTriggerKind[]).map((kind) => ({ value: kind, label: flowTriggers[kind].label }));
const actionOptions = (Object.keys(flowActions) as FlowActionKind[]).map((kind) => ({ value: kind, label: flowActions[kind].label }));
const operatorOptions = (Object.keys(flowOperators) as FlowOperator[]).map((operator) => ({ value: operator, label: flowOperators[operator] }));
const fieldOptions = flowConditionFields.map((field) => ({ value: field, label: field }));
const inputOptions = (Object.keys(flowInputFields) as FlowInputField[]).map((field) => ({ value: field, label: flowInputFields[field] }));
const unitOptions = (Object.keys(flowDelayUnits) as FlowDelayUnit[]).map((unit) => ({ value: unit, label: flowDelayUnits[unit] }));
const matchOptions: SelectOption<"all" | "any">[] = [
  { value: "all", label: "Todas as regras valem" },
  { value: "any", label: "Qualquer regra vale" },
];
const delayModeOptions: SelectOption<"for" | "until">[] = [
  { value: "for", label: "Por um tempo" },
  { value: "until", label: "Até um horário" },
];
const hourOptions = Array.from({ length: 24 }, (_, hour) => ({ value: `${String(hour).padStart(2, "0")}:00`, label: `${String(hour).padStart(2, "0")}:00` }));

const replace = <T,>(list: T[], index: number, value: T) => list.map((item, position) => (position === index ? value : item));

// O painel do passo escolhido: o nome, os campos do tipo (gatilhos, balões e botões, regras, variantes,
// espera) e, no pé, duplicar e excluir. Cada mexida devolve o passo inteiro para o quadro, que guarda o
// desfazer. As variáveis entram pelo leque `{ }`, no fim do último balão.
export function FlowStepPanel({ step, flows, onChange, onClose, onDuplicate, onDelete }: FlowStepPanelProps) {
  const spec = flowSteps[step.data.kind];
  const Glyph = step.data.kind === "message" ? channelIcons[step.data.message.channel] : stepIcons[step.data.kind];
  const hue = step.data.kind === "message" ? flowChannels[step.data.message.channel].hue : spec.hue;
  const set = (data: FlowStepData) => onChange({ ...step, data });

  return (
    <div className={styles.panel} style={{ "--hue": hue } as CSSProperties}>
      <header className={styles.head}>
        <span className={styles.glyph} aria-hidden="true">
          <Glyph weight="fill" />
        </span>
        <span className={styles.headCopy}>
          <Text as="h2" variant="headline" weight="semibold" truncate>
            {step.data.kind === "trigger" ? "Quando o fluxo começa" : step.title || spec.label}
          </Text>
          <Text as="span" variant="caption1" tone="secondary">
            {spec.description}
          </Text>
        </span>
        {onClose && (
          <IconButton label="Fechar o painel" variant="ghost" size="sm" onClick={onClose}>
            <XIcon />
          </IconButton>
        )}
      </header>

      <div className={styles.body}>
        {step.data.kind !== "trigger" && (
          <Field label="Nome do passo">
            <Input size="sm" value={step.title} maxLength={LIMITS.title} onChange={(event) => onChange({ ...step, title: event.target.value })} />
          </Field>
        )}
        <KindFields step={step} flows={flows} set={set} />
      </div>

      {step.data.kind !== "trigger" && (
        <footer className={styles.foot}>
          <Button variant="ghost" size="sm" radius="md" iconStart={<CopyIcon />} onClick={onDuplicate}>
            Duplicar
          </Button>
          <Button variant="ghost" size="sm" radius="md" iconStart={<TrashIcon />} foreground="var(--color-danger)" onClick={onDelete}>
            Excluir passo
          </Button>
        </footer>
      )}
    </div>
  );
}

function Item({ children, onRemove, removeLabel }: { children: ReactNode; onRemove?: () => void; removeLabel: string }) {
  return (
    <li className={styles.item}>
      <div className={styles.itemFields}>{children}</div>
      {onRemove && (
        <IconButton label={removeLabel} variant="ghost" size="sm" onClick={onRemove}>
          <TrashIcon />
        </IconButton>
      )}
    </li>
  );
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <Text as="h3" variant="caption1" weight="semibold" tone="secondary" className={styles.sectionTitle}>
          {title}
        </Text>
        {action}
      </header>
      {children}
    </section>
  );
}

function KindFields({ step, flows, set }: { step: FlowStep; flows: FlowStepPanelProps["flows"]; set: (data: FlowStepData) => void }) {
  const { data } = step;
  switch (data.kind) {
    case "trigger":
      return (
        <Section title="Gatilhos">
          <Text variant="caption1" tone="tertiary">
            Qualquer um deles faz o contato entrar no fluxo.
          </Text>
          <ul className={styles.items}>
            {data.triggers.map((trigger, index) => (
              <Item key={trigger.id} removeLabel={`Remover o gatilho ${flowTriggers[trigger.kind].label}`} onRemove={() => set({ ...data, triggers: data.triggers.filter((item) => item.id !== trigger.id) })}>
                <Select size="sm" label="Tipo de gatilho" options={triggerOptions} value={trigger.kind} onChange={(kind) => set({ ...data, triggers: replace(data.triggers, index, { ...trigger, kind }) })} />
                <Input size="sm" aria-label="Detalhe do gatilho" value={trigger.value} maxLength={LIMITS.short} placeholder={flowTriggers[trigger.kind].placeholder} onChange={(event) => set({ ...data, triggers: replace(data.triggers, index, { ...trigger, value: event.target.value }) })} />
                {trigger.kind === "ig-comment" && (
                  <Field label="Respostas públicas, uma por linha">
                    <Textarea
                      size="sm"
                      rows={3}
                      value={trigger.publicReplies.join("\n")}
                      maxLength={LIMITS.text}
                      placeholder="Te mandei no direct!"
                      onChange={(event) => set({ ...data, triggers: replace(data.triggers, index, { ...trigger, publicReplies: event.target.value.split("\n") }) })}
                    />
                  </Field>
                )}
              </Item>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            radius="md"
            iconStart={<PlusIcon />}
            disabled={data.triggers.length >= MAX.triggers}
            onClick={() => set({ ...data, triggers: [...data.triggers, { id: newFlowId(), kind: "ig-comment", value: "", publicReplies: [] }] })}
          >
            Adicionar gatilho
          </Button>
        </Section>
      );
    case "message": {
      const { message } = data;
      const setMessage = (next: Partial<typeof message>) => set({ ...data, message: { ...message, ...next } });
      return (
        <>
          <Field label="Canal">
            <Select size="sm" label="Canal" options={channelOptions} value={message.channel} onChange={(channel) => setMessage({ channel, buttons: channel === "email" ? [] : message.buttons, waitReply: channel === "email" ? false : message.waitReply, subject: channel === "email" ? (message.subject ?? "Uma novidade do estúdio") : undefined })} />
          </Field>
          {message.channel === "email" && (
            <Field label="Assunto">
              <Input size="sm" value={message.subject ?? ""} maxLength={LIMITS.short} onChange={(event) => setMessage({ subject: event.target.value })} />
            </Field>
          )}
          <Section
            title="Balões"
            action={
              <DropdownMenu
                label="Inserir variável"
                triggerLabel="Inserir variável no último balão"
                icon={<BracketsCurlyIcon />}
                size="sm"
                searchable={false}
                sections={[
                  {
                    id: "variaveis",
                    label: "Variáveis",
                    items: flowVariables.map((variable) => ({
                      id: variable.key,
                      label: variable.label,
                      onSelect: () => setMessage({ texts: message.texts.length === 0 ? [`{{${variable.key}}}`] : replace(message.texts, message.texts.length - 1, `${message.texts.at(-1) ?? ""} {{${variable.key}}}`.trimStart()) }),
                    })),
                  },
                ]}
              />
            }
          >
            <ul className={styles.items}>
              {message.texts.map((text, index) => (
                <Item key={index} removeLabel={`Remover o balão ${index + 1}`} onRemove={message.texts.length > 1 ? () => setMessage({ texts: message.texts.filter((_, position) => position !== index) }) : undefined}>
                  <Textarea size="sm" rows={3} aria-label={`Balão ${index + 1}`} value={text} maxLength={LIMITS.text} onChange={(event) => setMessage({ texts: replace(message.texts, index, event.target.value) })} />
                </Item>
              ))}
            </ul>
            <Button variant="outline" size="sm" radius="md" iconStart={<PlusIcon />} disabled={message.texts.length >= MAX.texts} onClick={() => setMessage({ texts: [...message.texts, ""] })}>
              Adicionar balão
            </Button>
          </Section>
          {message.channel !== "email" && (
            <>
              <Section title="Botões">
                {message.buttons.length > 0 && (
                  <ul className={styles.items}>
                    {message.buttons.map((button, index) => (
                      <Item key={button.id} removeLabel={`Remover o botão ${button.label || index + 1}`} onRemove={() => setMessage({ buttons: message.buttons.filter((item) => item.id !== button.id) })}>
                        <Input size="sm" aria-label={`Rótulo do botão ${index + 1}`} value={button.label} maxLength={LIMITS.button} placeholder="Quero um orçamento" onChange={(event) => setMessage({ buttons: replace(message.buttons, index, { ...button, label: event.target.value }) })} />
                      </Item>
                    ))}
                  </ul>
                )}
                <Button variant="outline" size="sm" radius="md" iconStart={<PlusIcon />} disabled={message.buttons.length >= MAX.buttons} onClick={() => setMessage({ buttons: [...message.buttons, { id: newFlowId(), label: "" }] })}>
                  Adicionar botão
                </Button>
              </Section>
              <Switch size="sm" checked={message.waitReply} onChange={(event) => setMessage({ waitReply: event.target.checked })}>
                <span className={styles.switchLabel}>Esperar a resposta do contato</span>
              </Switch>
            </>
          )}
        </>
      );
    }
    case "input":
      return (
        <>
          <Field label="Pergunta">
            <Textarea size="sm" rows={3} value={data.question} maxLength={LIMITS.text} onChange={(event) => set({ ...data, question: event.target.value })} />
          </Field>
          <div className={styles.pair}>
            <Field label="Tipo de dado">
              <Select size="sm" label="Tipo de dado" options={inputOptions} value={data.field} onChange={(field) => set({ ...data, field })} />
            </Field>
            <Field label="Guardar em">
              <Input size="sm" value={data.saveAs} maxLength={LIMITS.title} onChange={(event) => set({ ...data, saveAs: event.target.value })} />
            </Field>
          </div>
          <Field label="Se a resposta não servir">
            <Textarea size="sm" rows={2} value={data.retry} maxLength={LIMITS.text} onChange={(event) => set({ ...data, retry: event.target.value })} />
          </Field>
        </>
      );
    case "ai":
      return (
        <>
          <Field label="Objetivo da conversa">
            <Textarea size="sm" rows={4} value={data.goal} maxLength={LIMITS.text} onChange={(event) => set({ ...data, goal: event.target.value })} />
          </Field>
          <Field label="Passa para a equipe quando">
            <Input size="sm" value={data.handoff} maxLength={LIMITS.short} onChange={(event) => set({ ...data, handoff: event.target.value })} />
          </Field>
        </>
      );
    case "actions":
      return (
        <Section title="Ações, em ordem">
          <ul className={styles.items}>
            {data.actions.map((action, index) => (
              <Item key={action.id} removeLabel={`Remover a ação ${flowActions[action.kind].label}`} onRemove={data.actions.length > 1 ? () => set({ ...data, actions: data.actions.filter((item) => item.id !== action.id) }) : undefined}>
                <Select size="sm" label="Tipo de ação" options={actionOptions} value={action.kind} onChange={(kind) => set({ ...data, actions: replace(data.actions, index, { ...action, kind }) })} />
                <Input size="sm" aria-label="Valor da ação" value={action.value} maxLength={LIMITS.short} placeholder={flowActions[action.kind].placeholder} onChange={(event) => set({ ...data, actions: replace(data.actions, index, { ...action, value: event.target.value }) })} />
              </Item>
            ))}
          </ul>
          <Button variant="outline" size="sm" radius="md" iconStart={<PlusIcon />} disabled={data.actions.length >= MAX.actions} onClick={() => set({ ...data, actions: [...data.actions, { id: newFlowId(), kind: "add-tag", value: "" }] })}>
            Adicionar ação
          </Button>
        </Section>
      );
    case "condition":
      return (
        <Section title="Regras">
          <Select size="sm" label="Como combinar as regras" options={matchOptions} value={data.match}
            onChange={(match) => set({ ...data, match })}
          />
          <ul className={styles.items}>
            {data.rules.map((rule, index) => (
              <Item key={rule.id} removeLabel={`Remover a regra ${index + 1}`} onRemove={data.rules.length > 1 ? () => set({ ...data, rules: data.rules.filter((item) => item.id !== rule.id) }) : undefined}>
                <Select size="sm" label="Campo" options={fieldOptions} value={rule.field} onChange={(field) => set({ ...data, rules: replace(data.rules, index, { ...rule, field }) })} />
                <div className={styles.pair}>
                  <Select size="sm" label="Operador" options={operatorOptions} value={rule.operator} onChange={(operator) => set({ ...data, rules: replace(data.rules, index, { ...rule, operator }) })} />
                  <Input size="sm" aria-label="Valor da regra" value={rule.value} maxLength={LIMITS.short} placeholder="Valor" onChange={(event) => set({ ...data, rules: replace(data.rules, index, { ...rule, value: event.target.value }) })} />
                </div>
              </Item>
            ))}
          </ul>
          <Button variant="outline" size="sm" radius="md" iconStart={<PlusIcon />} disabled={data.rules.length >= MAX.rules} onClick={() => set({ ...data, rules: [...data.rules, { id: newFlowId(), field: "Etiqueta", operator: "has-tag", value: "" }] })}>
            Adicionar regra
          </Button>
        </Section>
      );
    case "randomizer": {
      const total = data.variants.reduce((sum, variant) => sum + variant.weight, 0);
      return (
        <Section title="Variantes">
          <ul className={styles.items}>
            {data.variants.map((variant, index) => (
              <Item key={variant.id} removeLabel={`Remover a variante ${variant.label}`} onRemove={data.variants.length > 2 ? () => set({ ...data, variants: data.variants.filter((item) => item.id !== variant.id) }) : undefined}>
                <div className={styles.pair}>
                  <Input size="sm" aria-label={`Nome da variante ${index + 1}`} value={variant.label} maxLength={8} onChange={(event) => set({ ...data, variants: replace(data.variants, index, { ...variant, label: event.target.value }) })} />
                  <Input
                    size="sm"
                    aria-label={`Peso da variante ${variant.label}, em porcentagem`}
                    mask="integerPercent"
                    value={variant.weight}
                    onChange={(event) => set({ ...data, variants: replace(data.variants, index, { ...variant, weight: Math.min(100, Number(event.target.value.replace(/\D/g, "")) || 0) }) })}
                  />
                </div>
              </Item>
            ))}
          </ul>
          <Text variant="caption1" tone={total === 100 ? "tertiary" : "warning"} role={total === 100 ? undefined : "alert"}>
            {total === 100 ? "Os pesos somam 100%." : `Os pesos somam ${total}%. Ajuste para fechar 100%.`}
          </Text>
          <Button
            variant="outline"
            size="sm"
            radius="md"
            iconStart={<PlusIcon />}
            disabled={data.variants.length >= MAX.variants}
            onClick={() => set({ ...data, variants: [...data.variants, { id: newFlowId(), label: String.fromCharCode(65 + data.variants.length), weight: 0 }] })}
          >
            Adicionar variante
          </Button>
        </Section>
      );
    }
    case "delay": {
      const { delay } = data;
      return (
        <>
          <Field label="Esperar">
            <Select
              size="sm"
              label="Esperar"
              options={delayModeOptions}
              value={delay.mode}
              onChange={(mode) => set({ ...data, delay: mode === "for" ? { mode: "for", amount: 1, unit: "horas" } : { mode: "until", time: "09:00" } })}
            />
          </Field>
          {delay.mode === "for" ? (
            <div className={styles.pair}>
              <Field label="Quanto">
                <Input size="sm" mask="integer" value={delay.amount} onChange={(event) => set({ ...data, delay: { ...delay, amount: Math.max(1, Math.min(365, Number(event.target.value.replace(/\D/g, "")) || 1)) } })} />
              </Field>
              <Field label="Unidade">
                <Select size="sm" label="Unidade" options={unitOptions} value={delay.unit} onChange={(unit) => set({ ...data, delay: { ...delay, unit } })} />
              </Field>
            </div>
          ) : (
            <Field label="Horário">
              <Select size="sm" label="Horário" options={hourOptions} value={delay.time} onChange={(time) => set({ ...data, delay: { ...delay, time } })} />
            </Field>
          )}
        </>
      );
    }
    case "jump":
      return (
        <Field label="Fluxo de destino">
          <Select size="sm" label="Fluxo de destino" options={flows.map((flow) => ({ value: flow.id, label: flow.name }))} value={data.flowId || undefined} placeholder="Escolha o fluxo" onChange={(flowId) => set({ ...data, flowId })} searchable={flows.length > 5} />
        </Field>
      );
  }
}
