"use client";

import { EnvelopeSimpleIcon, LightningIcon, WhatsappLogoIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { eventLabels, fillSurveyText, serviceLabels, services } from "../labels";
import type { DispatchEvent, DispatchRule, Survey } from "../types";
import { EmailMockup, WhatsAppMockup } from "./message-mockup";
import styles from "./dispatch.module.css";
import { Segmented } from "./segmented";

const delays = [
  { value: 1, label: "1 hora depois" },
  { value: 6, label: "6 horas depois" },
  { value: 24, label: "1 dia depois" },
  { value: 48, label: "2 dias depois" },
  { value: 72, label: "3 dias depois" },
  { value: 168, label: "7 dias depois" },
  { value: 720, label: "30 dias depois" },
  { value: 2160, label: "90 dias depois" },
];

const reminders = [
  { value: 0, label: "Sem lembrete" },
  { value: 24, label: "Depois de 1 dia sem resposta" },
  { value: 48, label: "Depois de 2 dias sem resposta" },
  { value: 72, label: "Depois de 3 dias sem resposta" },
  { value: 96, label: "Depois de 4 dias sem resposta" },
];

const cooldowns = [30, 60, 90, 120, 180].map((days) => ({ value: days, label: `${days} dias` }));
const hours = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`).map((value) => ({ value, label: value }));

const SAMPLE = { name: "Helena Prado", project: "Rebranding Atelier Prado" };

export const delayLabel = (hoursAfter: number) => delays.find((delay) => delay.value === hoursAfter)?.label ?? `${hoursAfter} horas depois`;

export function blankRule(surveys: Survey[], index: number): DispatchRule {
  return {
    id: `d-nova-${index}`,
    name: "",
    active: true,
    surveyId: surveys.find((survey) => survey.status === "active")?.id ?? surveys[0]?.id ?? "",
    services: ["site", "app", "branding", "ecommerce"],
    event: "projectDone",
    delayHours: 48,
    channel: "email",
    message: "Como foi o {projeto}? Sua opinião leva um minuto",
    reminderHours: 72,
    quietFrom: "21:00",
    quietTo: "08:00",
    cooldownDays: 90,
  };
}

/** O problema que impede salvar a regra, dito em uma frase. */
function ruleProblem(rule: DispatchRule) {
  if (rule.name.trim().length < 3) return "Dê um nome de pelo menos 3 letras à regra.";
  if (!rule.surveyId) return "Escolha a pesquisa que a regra envia.";
  if (rule.services.length === 0) return "Escolha pelo menos um tipo de projeto.";
  if (rule.message.trim().length < 6) return rule.channel === "email" ? "Escreva o assunto do e-mail." : "Escreva a mensagem do WhatsApp.";
  return null;
}

/**
 * A regra de disparo numa janela com a prévia ao lado: quando dispara, por onde, o texto, o lembrete e a
 * janela de silêncio; à direita a mensagem como chega ao cliente, no canal escolhido.
 */
export function RuleDialog({ open, rule: initial, surveys, onClose, onSave }: { open: boolean; rule: DispatchRule; surveys: Survey[]; onClose: () => void; onSave: (rule: DispatchRule) => void }) {
  const [rule, setRule] = useState(initial);
  const [error, setError] = useState("");
  const set = <K extends keyof DispatchRule>(key: K, value: DispatchRule[K]) => {
    setError("");
    setRule((current) => ({ ...current, [key]: value }));
  };
  const usable = surveys.filter((survey) => survey.status !== "archived");
  const message = fillSurveyText(rule.message, SAMPLE);
  const save = () => {
    const problem = ruleProblem(rule);
    if (problem) return setError(problem);
    onSave(rule);
  };

  return (
    <Dialog open={open} onClose={onClose} label={initial.name ? `Editar ${initial.name}` : "Nova regra de disparo"} size="xl" surface="solid">
      <DialogHeader title={initial.name ? "Editar regra" : "Nova regra de disparo"} description="Quando a pesquisa sai sozinha para o cliente" before={<LightningIcon weight="duotone" aria-hidden="true" />} onClose={onClose} />
      <div className={styles.ruleBody}>
        <div className={styles.ruleForm}>
          <Field label="Nome da regra" required error={error && rule.name.trim().length < 3 ? error : undefined} revealError={Boolean(error)}>
            <Input value={rule.name} maxLength={60} placeholder="Pós-entrega por e-mail" onChange={(event) => set("name", event.target.value)} />
          </Field>
          <div className={styles.twoCols}>
            <Field label="Pesquisa">
              <Select label="Pesquisa" value={rule.surveyId} options={usable.map((survey) => ({ value: survey.id, label: survey.name }))} onChange={(surveyId) => set("surveyId", surveyId)} />
            </Field>
            <Field label="Quando acontece">
              <Select<DispatchEvent> label="Quando acontece" value={rule.event} options={(Object.keys(eventLabels) as DispatchEvent[]).map((event) => ({ value: event, label: eventLabels[event].label }))} onChange={(event) => set("event", event)} />
            </Field>
            <Field label="Envia">
              <Select<number> label="Envia" value={rule.delayHours} options={delays} onChange={(delayHours) => set("delayHours", delayHours)} />
            </Field>
            <Field label="Lembrete">
              <Select<number> label="Lembrete" value={rule.reminderHours ?? 0} options={reminders} onChange={(value) => set("reminderHours", value === 0 ? null : value)} />
            </Field>
          </div>
          <div className={styles.channelRow}>
            <Text as="span" variant="footnote" weight="medium">
              Canal
            </Text>
            <Segmented
              as="radio"
              label="Canal"
              value={rule.channel}
              onChange={(channel) => set("channel", channel)}
              options={[
                { value: "email", label: "E-mail", icon: <EnvelopeSimpleIcon aria-hidden="true" /> },
                { value: "whatsapp", label: "WhatsApp", icon: <WhatsappLogoIcon aria-hidden="true" /> },
              ]}
            />
          </div>
          <Field label={rule.channel === "email" ? "Assunto do e-mail" : "Mensagem"} required>
            <Input value={rule.message} maxLength={160} onChange={(event) => set("message", event.target.value)} />
          </Field>
          <Text variant="caption1" tone="secondary">
            Use {"{nome}"} para o primeiro nome do cliente e {"{projeto}"} para o nome do projeto.
          </Text>
          <div className={styles.twoCols}>
            <Field label="Não envia a partir de">
              <Select label="Não envia a partir de" value={rule.quietFrom} options={hours} onChange={(quietFrom) => set("quietFrom", quietFrom)} />
            </Field>
            <Field label="Volta a enviar às">
              <Select label="Volta a enviar às" value={rule.quietTo} options={hours} onChange={(quietTo) => set("quietTo", quietTo)} />
            </Field>
            <Field label="Não pergunta de novo por">
              <Select<number> label="Não pergunta de novo por" value={rule.cooldownDays} options={cooldowns} onChange={(cooldownDays) => set("cooldownDays", cooldownDays)} />
            </Field>
          </div>
          <fieldset className={styles.checks}>
            <legend>Tipos de projeto</legend>
            {services.map((service) => (
              <Checkbox key={service} checked={rule.services.includes(service)} onChange={(event) => set("services", event.target.checked ? [...rule.services, service] : rule.services.filter((item) => item !== service))}>
                {serviceLabels[service].label}
              </Checkbox>
            ))}
          </fieldset>
          <Switch checked={rule.active} onChange={(event) => set("active", event.target.checked)}>
            Regra ligada
          </Switch>
          {error && rule.name.trim().length >= 3 && (
            <Text variant="footnote" tone="danger" role="alert">
              {error}
            </Text>
          )}
        </div>

        <aside className={styles.rulePreview} aria-label="Prévia da mensagem">
          <Text variant="footnote" tone="secondary" className={styles.ruleSentence}>
            {delayLabel(rule.delayHours)} {eventLabels[rule.event].after}, fora da janela das {rule.quietFrom} às {rule.quietTo}
            {rule.reminderHours ? `, com lembrete ${rule.reminderHours / 24 === 1 ? "um dia" : `${rule.reminderHours / 24} dias`} depois sem resposta` : ", sem lembrete"}.
          </Text>
          {rule.channel === "whatsapp" ? (
            <WhatsAppMockup
              button="Responder a pesquisa"
              messages={[
                { day: "Hoje", time: "10:12", text: message || "Mensagem sem texto" },
                ...(rule.reminderHours ? [{ day: rule.reminderHours <= 24 ? "Amanhã" : `Em ${rule.reminderHours / 24} dias`, time: "10:12", text: `Oi, ${SAMPLE.name.split(" ")[0]}! Ainda dá tempo de responder, leva um minuto.`, note: "Lembrete" }] : []),
              ]}
            />
          ) : (
            <EmailMockup subject={message || "Assunto do e-mail"} greeting={`Oi, ${SAMPLE.name.split(" ")[0]}! O ${SAMPLE.project} foi entregue. Conta para a gente como foi trabalhar conosco?`} time="10:12" button="Responder em um minuto" />
          )}
        </aside>
      </div>
      <DialogFooter mobile="always">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={save}>{initial.name ? "Salvar regra" : "Criar regra"}</Button>
      </DialogFooter>
    </Dialog>
  );
}
