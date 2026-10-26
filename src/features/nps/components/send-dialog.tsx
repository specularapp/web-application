"use client";

import { CopyIcon, EnvelopeSimpleIcon, LinkIcon, PaperPlaneTiltIcon, WhatsappLogoIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { fillSurveyText, serviceLabels } from "../labels";
import type { NpsChannel, NpsClient, NpsSend, Survey } from "../types";
import styles from "./dispatch.module.css";
import { surveyLink } from "./parts";
import { Segmented } from "./segmented";

/**
 * O envio à mão: o cliente, a pesquisa e o canal. No fim, o link pessoal para copiar ou abrir no WhatsApp,
 * que é o caminho de quem prefere mandar da própria conversa.
 */
export function SendDialog({ open, clients, surveys, now, onClose, onSent }: { open: boolean; clients: NpsClient[]; surveys: Survey[]; now: string; onClose: () => void; onSent: (send: NpsSend) => void }) {
  const { toast } = useToast();
  const active = surveys.filter((survey) => survey.status === "active");
  const [clientId, setClientId] = useState<string | undefined>();
  const [surveyId, setSurveyId] = useState(active[0]?.id ?? "");
  const [channel, setChannel] = useState<NpsChannel>("email");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; message: string; phone: string } | null>(null);
  const client = clients.find((item) => item.id === clientId);

  const close = () => {
    setResult(null);
    setError("");
    setClientId(undefined);
    onClose();
  };

  const submit = () => {
    if (!client) return setError("Escolha o cliente.");
    if (!surveyId) return setError("Nenhuma pesquisa ativa para enviar.");
    const survey = surveys.find((item) => item.id === surveyId);
    const token = `${client.id.replace("c-", "")}${surveyId.length}${client.project.reference.slice(-2)}`;
    const url = surveyLink(token);
    onSent({ id: `n-manual-${token}`, ruleId: null, surveyId, clientId: client.id, channel, scheduledAt: now, sentAt: channel === "link" ? null : now, status: channel === "link" ? "scheduled" : "sent", reminded: false, responseId: null, error: "" });
    setResult({ url, message: `${fillSurveyText(survey?.intro ?? "", { name: client.contact.name, project: client.project.name })} ${url}`, phone: client.contact.phone.replace(/\D/g, "") });
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado", description: "Cole na conversa com o cliente.", tone: "success", feedback: false });
    } catch {
      toast({ title: "Link da pesquisa", description: url, tone: "neutral" });
    }
  };

  return (
    <Dialog open={open} onClose={close} label="Enviar pesquisa" size="md" surface="solid">
      <DialogHeader title={result ? "Link pronto" : "Enviar pesquisa"} description={result ? `Para ${client?.contact.name}` : "Um envio avulso, fora das regras"} before={<PaperPlaneTiltIcon weight="duotone" aria-hidden="true" />} onClose={close} />
      {result ? (
        <>
          <div className={styles.dialogBody}>
            <Text variant="footnote" tone="secondary">
              {channel === "link" ? "Copie e mande por onde quiser. O link é pessoal e aceita uma resposta." : channel === "whatsapp" ? "A mensagem entrou na fila do WhatsApp. Se preferir mandar da sua conversa, use o botão abaixo." : "O e-mail entrou na fila de envio. O link também está aqui, se precisar."}
            </Text>
            <div className={styles.linkBox}>
              <code>{result.url}</code>
              <IconButton label="Copiar link" variant="ghost" size="sm" onClick={() => void copy(result.url)}>
                <CopyIcon />
              </IconButton>
            </div>
          </div>
          <DialogFooter mobile="always">
            {result.phone && (
              <Button variant="outline" iconStart={<WhatsappLogoIcon />} href={`https://wa.me/55${result.phone}?text=${encodeURIComponent(result.message)}`} target="_blank" rel="noreferrer">
                Abrir no WhatsApp
              </Button>
            )}
            <Button onClick={close}>Pronto</Button>
          </DialogFooter>
        </>
      ) : (
        <>
          <div className={styles.dialogBody}>
            <Field label="Cliente" required error={!client && error ? error : undefined} revealError={Boolean(error) && !client}>
              <Select
                label="Cliente"
                searchable
                placeholder="Escolha o cliente"
                value={clientId}
                options={clients.map((item) => ({ value: item.id, label: item.contact.name, caption: `${item.contact.company}, ${item.project.name}`, media: <Avatar name={item.contact.name} seed={item.id} size="xs" /> }))}
                onChange={(value) => {
                  setError("");
                  setClientId(value);
                }}
              />
            </Field>
            {client && (
              <Text variant="caption1" tone="secondary">
                {client.project.reference}, {serviceLabels[client.project.service].label}. {client.contact.email}
              </Text>
            )}
            <Field label="Pesquisa">
              <Select label="Pesquisa" value={surveyId} placeholder="Nenhuma pesquisa ativa" options={active.map((survey) => ({ value: survey.id, label: survey.name }))} onChange={setSurveyId} />
            </Field>
            <div className={styles.channelRow}>
              <Text as="span" variant="footnote" weight="medium">
                Como mandar
              </Text>
              <Segmented
                as="radio"
                label="Como mandar"
                value={channel}
                onChange={setChannel}
                options={[
                  { value: "email", label: "E-mail", icon: <EnvelopeSimpleIcon aria-hidden="true" /> },
                  { value: "whatsapp", label: "WhatsApp", icon: <WhatsappLogoIcon aria-hidden="true" /> },
                  { value: "link", label: "Só o link", icon: <LinkIcon aria-hidden="true" /> },
                ]}
              />
            </div>
            {error && client && (
              <Text variant="footnote" tone="danger" role="alert">
                {error}
              </Text>
            )}
          </div>
          <DialogFooter mobile="always">
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button iconStart={<PaperPlaneTiltIcon />} disabled={!surveyId} onClick={submit}>
              {channel === "link" ? "Gerar link" : "Enviar"}
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}
