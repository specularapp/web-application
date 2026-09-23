"use client";

import { useCrmStages } from "./stage-context";

import { callAction } from "@/lib/action";

import { CaretDownIcon, CaretUpIcon, CheckIcon, XIcon } from "@phosphor-icons/react";
import { useId, useMemo, useState } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TagPicker } from "@/components/ui/tag-picker";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { onlyDigits } from "@/lib/masks";
import { saveOpportunityAction } from "../actions";
import { sourceLabels, temperatureLabels } from "../labels";
import { MAX_TAGS, opportunityLimits, temperatureValues } from "../schemas";
import { type CrmStage } from "../stages";
import { opportunityTagCatalog } from "../tags";
import type { CrmFunnel } from "../tree";
import { opportunitySourceValues, type CrmClientOption, type CrmPerson, type Opportunity, type OpportunityAttribution, type OpportunitySource, type OpportunityTemperature } from "../summary";
import styles from "./new-opportunity-dialog.module.css";
import { SourceMark } from "./source-mark";

export type NewOpportunityDialogProps = {
  open: boolean;
  onClose: () => void;
  stages: CrmStage[];
  stage: CrmStage;
  funnelId?: string | null;
  funnels: CrmFunnel[];
  clients: CrmClientOption[];
  team: CrmPerson[];
  opportunity?: Opportunity;
  onSaved: (opportunity: Opportunity) => void;
};

const sourceOptions = opportunitySourceValues.map((value) => ({
  value,
  label: sourceLabels[value],
  media: <SourceMark source={value} />,
}));
const temperatureOptions = temperatureValues.map((value) => ({ value, label: temperatureLabels[value] }));
const NONE = "__none";
const NEW_LEAD = "__new";
const toDate = (value?: string) => (value ? new Date(`${value}T12:00:00`) : undefined);
const toDay = (value?: Date) => value ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}` : "";
const emptyAttribution = (): Required<OpportunityAttribution> => ({
  campaign: "", adSet: "", ad: "", gclid: "", ctwaclid: "", fbclid: "", sourceId: "", metaLeadId: "", sourceUrl: "",
  utm: { source: "", medium: "", campaign: "", content: "", term: "" },
});

type Values = {
  title: string; description: string; clientId: string | null; clientName: string; clientCompany: string;
  contactName: string; contactEmail: string; contactPhone: string; funnelId: string | null; stage: CrmStage;
  value: string; temperature: OpportunityTemperature; probability: string; city: string; state: string;
  expectedAt: string; ownerId: string | null; peopleIds: string[]; tags: string[]; source: OpportunitySource;
  partnerCode: string; lastTouchAt: string; nextStepLabel: string; nextStepAt: string;
  firstResponseMinutes: string; averageResponseMinutes: string; attribution: Required<OpportunityAttribution>;
};

function initialValues(props: NewOpportunityDialogProps): Values {
  const item = props.opportunity;
  const funnel = item?.funnel ? props.funnels.find((entry) => entry.reference === item.funnel?.reference) : undefined;
  const attribution = emptyAttribution();
  if (item?.attribution) Object.assign(attribution, item.attribution, { utm: { ...attribution.utm, ...item.attribution.utm } });
  return {
    title: item?.title ?? "", description: item?.description ?? "", clientId: item?.client.reference ? item.client.id : null,
    clientName: item?.client.name ?? "", clientCompany: item?.client.company ?? "", contactName: item?.contact?.name ?? "",
    contactEmail: item?.contact?.email ?? "", contactPhone: onlyDigits(item?.contact?.phone ?? ""),
    funnelId: funnel?.reference === null ? null : funnel?.id ?? props.funnelId ?? null, stage: item?.stage ?? props.stage,
    value: item ? String(item.value) : "", temperature: item?.temperature ?? "warm", probability: String(item?.probability ?? 50),
    city: item?.city ?? "", state: item?.state ?? "", expectedAt: item?.expectedAt ?? "", ownerId: item?.owner.id || null,
    peopleIds: item?.people.map((person) => person.id).filter(Boolean) ?? [], tags: item?.tags ?? [], source: item?.source ?? "whatsapp",
    partnerCode: item?.partnerCode ?? "", lastTouchAt: item?.lastTouchAt ?? "", nextStepLabel: item?.nextStep?.label ?? "",
    nextStepAt: item?.nextStep?.at ?? "", firstResponseMinutes: item?.firstResponseMinutes === undefined ? "" : String(item.firstResponseMinutes),
    averageResponseMinutes: item?.averageResponseMinutes === undefined ? "" : String(item.averageResponseMinutes), attribution,
  };
}

export function NewOpportunityDialog(props: NewOpportunityDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const editing = Boolean(props.opportunity);
  return (
    <Dialog open={props.open} onClose={props.onClose} label={editing ? "Editar oportunidade" : "Nova oportunidade"} size="lg" placement="end" surface="glass" scrim={mobile} focusOnOpen={!mobile}>
      <OpportunityForm key={`${props.opportunity?.id ?? "new"}-${props.open ? "open" : "closed"}`} {...props} />
    </Dialog>
  );
}

function OpportunityForm(props: NewOpportunityDialogProps) {
  const crmStageMeta = useCrmStages();
  const { toast } = useToast();
  const titleId = useId();
  const editing = Boolean(props.opportunity);
  const [values, setValues] = useState(() => initialValues(props));
  const [details, setDetails] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));
  const selectedFunnel = props.funnels.find((entry) => entry.id === values.funnelId);
  const availableStages = selectedFunnel?.stages ?? props.stages;
  const filled = values.title.trim().length >= 2 && values.clientName.trim().length >= 2;
  const errorOf = (field: string) => error?.field === field ? error.message : undefined;

  const clientOptions = useMemo(() => [
    { value: NEW_LEAD, label: "Novo lead (sem cadastro)" },
    ...props.clients.map((client) => ({
      value: client.id,
      label: client.company ? `${client.name}, ${client.company}` : client.name,
      media: <Avatar name={client.name} src={client.avatarUrl ?? undefined} size="xs" shape="rounded" />,
    })),
  ], [props.clients]);
  const funnelOptions = [{ value: NONE, label: "Sem funil" }, ...props.funnels.filter((funnel) => funnel.reference !== null).map((funnel) => ({ value: funnel.id, label: funnel.name }))];
  const ownerOptions = [{ value: NONE, label: "Sem responsável" }, ...props.team.map((person) => ({
    value: person.id,
    label: person.name,
    media: <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" shape="rounded" />,
  }))];
  const peopleSections: DropdownSection[] = [{ id: "people", items: props.team.map((person) => ({
    id: person.id, label: person.name, selected: values.peopleIds.includes(person.id), keepOpen: true,
    media: <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" shape="rounded" />,
    onSelect: () => set("peopleIds", values.peopleIds.includes(person.id) ? values.peopleIds.filter((id) => id !== person.id) : [...values.peopleIds, person.id]),
  })) }];

  const chooseClient = (id: string) => {
    if (id === NEW_LEAD) { setValues((current) => ({ ...current, clientId: null, clientName: "", clientCompany: "", contactName: "", contactEmail: "", contactPhone: "", city: "" })); return; }
    const client = props.clients.find((entry) => entry.id === id);
    if (!client) return;
    setValues((current) => ({ ...current, clientId: client.id, clientName: client.name, clientCompany: client.company ?? "", contactName: client.name, contactEmail: client.email ?? "", contactPhone: onlyDigits(client.phone ?? ""), city: client.city ?? "" }));
  };
  const chooseFunnel = (id: string) => {
    const funnel = props.funnels.find((entry) => entry.id === id);
    setValues((current) => ({ ...current, funnelId: id === NONE || funnel?.reference === null ? null : funnel?.id ?? null, stage: funnel?.stages[0] ?? props.stages[0] ?? "lead" }));
  };

  const save = async () => {
    if (saving || !filled) return;
    setSaving(true); setError(null);
    const result = await callAction(saveOpportunityAction({
      id: props.opportunity?.id, funnelId: values.funnelId, title: values.title, description: values.description,
      clientId: values.clientId, clientName: values.clientName, clientCompany: values.clientCompany,
      contactName: values.contactName, contactEmail: values.contactEmail, contactPhone: onlyDigits(values.contactPhone),
      stage: values.stage, value: Number(onlyDigits(values.value) || 0), temperature: values.temperature,
      probability: Number(onlyDigits(values.probability) || 0), city: values.city, state: values.state.toUpperCase(),
      expectedAt: values.expectedAt, ownerId: values.ownerId, peopleIds: values.peopleIds, tags: values.tags,
      source: values.source, partnerCode: values.partnerCode, lastTouchAt: values.lastTouchAt,
      nextStepLabel: values.nextStepLabel, nextStepAt: values.nextStepAt,
      firstResponseMinutes: values.firstResponseMinutes === "" ? null : Number(onlyDigits(values.firstResponseMinutes)),
      averageResponseMinutes: values.averageResponseMinutes === "" ? null : Number(onlyDigits(values.averageResponseMinutes)),
      attribution: values.attribution,
    }));
    setSaving(false);
    if (!result.ok) { setError({ field: result.field, message: result.error }); toast({ title: "Não deu para salvar", description: result.error, tone: "danger" }); return; }
    toast({
      title: editing ? "Oportunidade atualizada" : "Oportunidade criada",
      description: editing ? "As mudanças já aparecem na ficha." : `Ela entrou em ${crmStageMeta[result.opportunity.stage].label}.`,
      tone: "success",
      feedback: {
        visual: <Avatar name={result.opportunity.client.name} src={result.opportunity.client.avatarUrl ?? undefined} size="lg" shape="rounded" />,
        confetti: !editing,
      },
    });
    props.onSaved(result.opportunity);
  };

  useFloatingActionsRegistration({ primary: { label: saving ? "Salvando" : editing ? "Salvar alterações" : "Criar oportunidade", loading: saving, disabled: !filled, onClick: () => void save() }, cancel: { label: "Cancelar", onClick: props.onClose } });

  return <div className={styles.dialog} aria-labelledby={titleId}>
    <header className={styles.head}><div><Text as="h2" id={titleId} variant="headline" weight="semibold">{editing ? "Editar oportunidade" : "Nova oportunidade"}</Text><Text as="p" variant="caption1" tone="secondary">{editing ? props.opportunity?.reference : "Registre a venda e complete o acompanhamento quando precisar."}</Text></div><IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={props.onClose}><XIcon /></IconButton></header>
    <div className={styles.body}>
      <section className={styles.section}><Text as="h3" variant="subheadline" weight="semibold">Oportunidade</Text>
        <Field label="Título" error={errorOf("title")} required><Input value={values.title} maxLength={opportunityLimits.title} disabled={saving} invalid={Boolean(errorOf("title"))} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Descrição" error={errorOf("description")}><Textarea value={values.description} maxLength={opportunityLimits.description} disabled={saving} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className={styles.pair}><Field label="Valor"><Input mask="currency" value={values.value} disabled={saving} onChange={(e) => set("value", e.target.value)} /></Field><Field label="Chance"><Input mask="integerPercent" value={values.probability} disabled={saving} onChange={(e) => set("probability", onlyDigits(e.target.value).slice(0, 3))} /></Field></div>
        <div className={styles.pair}><Field label="Temperatura"><Select label="Temperatura" options={temperatureOptions} value={values.temperature} disabled={saving} onChange={(value) => set("temperature", value)} /></Field><Field label="Previsão de fechamento"><DatePicker value={toDate(values.expectedAt)} disabled={saving} onChange={(date) => set("expectedAt", toDay(date))} /></Field></div>
      </section>
      <section className={styles.section}><Text as="h3" variant="subheadline" weight="semibold">Cliente</Text>
        <Field label="Cadastro"><Select label="Cliente" options={clientOptions} value={values.clientId ?? NEW_LEAD} searchable visibleLimit={8} disabled={saving} onChange={chooseClient} /></Field>
        <div className={styles.pair}><Field label="Nome" error={errorOf("clientName")} required><Input value={values.clientName} maxLength={opportunityLimits.clientName} disabled={saving || Boolean(values.clientId)} onChange={(e) => set("clientName", e.target.value)} /></Field><Field label="Empresa"><Input value={values.clientCompany} maxLength={opportunityLimits.company} disabled={saving || Boolean(values.clientId)} onChange={(e) => set("clientCompany", e.target.value)} /></Field></div>
        <div className={styles.pair}><Field label="E-mail" error={errorOf("contactEmail")}><Input type="email" value={values.contactEmail} maxLength={opportunityLimits.email} disabled={saving} onChange={(e) => set("contactEmail", e.target.value)} /></Field></div>
        <div className={styles.pair}><Field label="Telefone"><Input mask="phone" value={values.contactPhone} disabled={saving} onChange={(e) => set("contactPhone", e.target.value)} /></Field><Field label="Cidade"><Input value={values.city} maxLength={opportunityLimits.city} disabled={saving} onChange={(e) => set("city", e.target.value)} /></Field></div>
        <Field label="Estado"><Input value={values.state} maxLength={2} disabled={saving} onChange={(e) => set("state", e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} /></Field>
      </section>
      <section className={styles.section}><Text as="h3" variant="subheadline" weight="semibold">Funil e equipe</Text>
        <div className={styles.pair}><Field label="Funil"><Select label="Funil" options={funnelOptions} value={values.funnelId ?? NONE} disabled={saving} onChange={chooseFunnel} /></Field><Field label="Etapa"><Select label="Etapa" options={availableStages.map((id) => ({ value: id, label: crmStageMeta[id].label }))} value={values.stage} disabled={saving} onChange={(value) => set("stage", value)} /></Field></div>
        <div className={styles.pair}><Field label="Responsável"><Select label="Responsável" options={ownerOptions} value={values.ownerId ?? NONE} disabled={saving} onChange={(id) => set("ownerId", id === NONE ? null : id)} /></Field><Field label="Envolvidos"><DropdownMenu label="Envolvidos na oportunidade" triggerLabel={values.peopleIds.length ? `${values.peopleIds.length} selecionado(s)` : "Escolher pessoas"} trigger={{ variant: "outline", radius: "md", disabled: saving }} sections={peopleSections} surface="glass" /></Field></div>
        <Field label="Etiquetas"><TagPicker catalog={opportunityTagCatalog} label="Etiquetas da oportunidade" value={values.tags} max={MAX_TAGS} disabled={saving} onChange={(tags) => set("tags", tags)} /></Field>
      </section>
      <section className={styles.section}><Text as="h3" variant="subheadline" weight="semibold">Acompanhamento</Text>
        <div className={styles.pair}><Field label="Último contato"><DatePicker value={toDate(values.lastTouchAt)} disabled={saving} onChange={(date) => set("lastTouchAt", toDay(date))} /></Field><Field label="Próximo passo" error={errorOf("nextStepLabel")}><Input value={values.nextStepLabel} maxLength={opportunityLimits.nextStep} disabled={saving} onChange={(e) => set("nextStepLabel", e.target.value)} /></Field></div>
        <Field label="Data do próximo passo" error={errorOf("nextStepAt")}><DatePicker value={toDate(values.nextStepAt)} disabled={saving} invalid={Boolean(errorOf("nextStepAt"))} onChange={(date) => set("nextStepAt", toDay(date))} /></Field>
      </section>
      <Button variant="ghost" size="sm" iconEnd={details ? <CaretUpIcon /> : <CaretDownIcon />} onClick={() => setDetails((open) => !open)}>{details ? "Ocultar dados avançados" : "Mostrar origem e campanha"}</Button>
      {details && <>
        <section className={styles.section}><Text as="h3" variant="subheadline" weight="semibold">Origem e campanha</Text>
          <div className={styles.pair}><Field label="Origem"><Select label="Origem" options={sourceOptions} value={values.source} disabled={saving} onChange={(value) => set("source", value)} /></Field></div>
          {(["campaign", "adSet", "ad", "gclid", "ctwaclid", "fbclid", "sourceId", "metaLeadId", "sourceUrl"] as const).map((key) => <Field key={key} label={({ campaign: "Campanha", adSet: "Conjunto de anúncios", ad: "Anúncio", gclid: "GCLID", ctwaclid: "CTWACLID", fbclid: "FBCLID", sourceId: "Source ID", metaLeadId: "Meta lead ID", sourceUrl: "URL de origem" })[key]}><Input value={values.attribution[key]} maxLength={key === "sourceUrl" ? opportunityLimits.sourceUrl : opportunityLimits.attribution} disabled={saving} onChange={(e) => set("attribution", { ...values.attribution, [key]: e.target.value })} /></Field>)}
          <div className={styles.pair}>{(["source", "medium", "campaign", "content", "term"] as const).map((key) => <Field key={key} label={`UTM ${key}`}><Input value={values.attribution.utm[key]} maxLength={opportunityLimits.attribution} disabled={saving} onChange={(e) => set("attribution", { ...values.attribution, utm: { ...values.attribution.utm, [key]: e.target.value } })} /></Field>)}</div>
        </section>
      </>}
      {error && !error.field && <Text as="p" variant="footnote" tone="danger">{error.message}</Text>}
    </div>
    <footer className={styles.foot}><Button variant="secondary" disabled={saving} onClick={props.onClose}>Cancelar</Button><Button loading={saving} disabled={!filled} iconStart={!saving ? <CheckIcon /> : undefined} onClick={() => void save()}>{editing ? "Salvar alterações" : "Criar oportunidade"}</Button></footer>
  </div>;
}
