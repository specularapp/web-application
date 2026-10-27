"use client";

import {
  ArrowRightIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CopySimpleIcon,
  CrosshairIcon,
  DotsThreeIcon,
  HourglassIcon,
  IdentificationCardIcon,
  PlusIcon,
  ReceiptIcon,
  SparkleIcon,
  TagSimpleIcon,
  ThermometerIcon,
  UserCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Route } from "next";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  type DropdownSection,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { SheetSwitcher } from "@/components/ui/sheet-switcher";
import { tagSections } from "@/components/ui/tag-picker";
import { Text } from "@/components/ui/text";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTabList } from "@/hooks/use-tab-list";
import { callAction } from "@/lib/action";
import { applyPattern, formatNumeric, onlyDigits } from "@/lib/masks";
import { saveOpportunityAction } from "../actions";
import { opportunityFormValues } from "../form-values";
import {
  dateTimeLabel,
  durationLabel,
  expectedOf,
  isStale,
  opportunityLink,
  sourceHues,
  sourceLabels,
  stageMinutes,
  touchLabel,
  temperatureLabels,
  temperatureTones,
} from "../labels";
import {
  MAX_TAGS,
  opportunityLimits,
  temperatureValues,
  type OpportunityFormInput,
} from "../schemas";
import type { CrmStage } from "../stages";
import {
  opportunitySourceValues,
  type CrmClientOption,
  type CrmPerson,
  type Opportunity,
} from "../summary";
import { opportunityTagCatalog } from "../tags";
import type { CrmFunnel } from "../tree";
import { OpportunityMenu } from "./opportunity-menu";
import { SourceMark } from "./source-mark";
import { WhatsappPreview } from "./whatsapp-preview";
import { useCrmStages } from "./stage-context";
import styles from "./opportunity-dialog.module.css";
import profile from "./opportunity-profile.module.css";

export type OpportunityDialogProps = {
  opportunity: Opportunity | null;
  open: boolean;
  onClose: () => void;
  stages: CrmStage[];
  team: CrmPerson[];
  clients: CrmClientOption[];
  funnels: CrmFunnel[];
  onSaved: (opportunity: Opportunity) => void;
};

type OpportunityTab = "details" | "stage";

const tabs = [
  { id: "details", label: "Informações" },
  { id: "stage", label: "Conversa" },
] as const;
/* As partes da ficha, no desenho da ficha do lead da pousada: os campos, de onde a venda veio e o resumo. */
const profileSections = [
  { id: "principal", label: "Principal", icon: IdentificationCardIcon },
  { id: "rastreio", label: "Rastreio", icon: CrosshairIcon },
  { id: "resumo", label: "Resumo", icon: SparkleIcon },
] as const;
type ProfileSection = (typeof profileSections)[number]["id"];
const profileTabIds = profileSections.map((entry) => entry.id);

/** Há quanto tempo a venda está na etapa, como a ficha da pousada diz ao lado do nome dela. */
function sinceLabel(iso: string) {
  if (!iso) return "Hoje";
  const days = differenceInCalendarDays(new Date(), parseISO(iso));
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  return `há ${days} dias`;
}

const NONE = "__none";
const SAVE_PAUSE = 900;
const toDate = (value: string) =>
  value ? new Date(`${value}T12:00:00`) : undefined;
const toDay = (value?: Date) =>
  value
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
    : "";

function Empty({ children = "Vazio" }: { children?: ReactNode }) {
  return (
    <Text
      as="span"
      variant="subheadline"
      className={styles.empty}
      truncate
    >
      {children}
    </Text>
  );
}

/** O telefone sem o 55 do país, que é o que o padrão de DDD e número espera. */
const localPhone = (value: string) => {
  const digits = onlyDigits(value);
  return digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
};

/**
 * As máscaras dos campos da ficha (2026-10-26, a pedido: "todos os campos com máscara"): o que a pessoa digita
 * já sai no formato, e o valor guardado aparece do mesmo jeito fora da edição. Cada uma devolve o texto
 * formatado; quem grava lê os dígitos de volta.
 */
const fieldMasks = {
  /* O valor da venda é guardado em centavos, que é como a máscara de moeda da casa conta os dígitos. */
  money: (value: string) => {
    const formatted = formatNumeric("currency", onlyDigits(value).slice(0, 12));
    return formatted ? `R$ ${formatted}` : "";
  },
  phone: (value: string) => applyPattern("phone", localPhone(value)),
  state: (value: string) => value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase(),
  email: (value: string) => value.replace(/\s/g, "").toLowerCase(),
} as const;

type FieldMask = keyof typeof fieldMasks;

function InlineText({
  value,
  display,
  onChange,
  label,
  as = "span",
  variant = "subheadline",
  weight,
  tone,
  placeholder = "Vazio",
  maxLength = 2000,
  mask,
}: {
  value: string;
  display?: string;
  onChange: (value: string) => void;
  label: string;
  as?: "h2" | "p" | "span";
  variant?: "title2" | "title3" | "callout" | "subheadline" | "footnote";
  weight?: "medium" | "semibold";
  tone?: "secondary";
  placeholder?: string;
  maxLength?: number;
  mask?: FieldMask;
}) {
  const shape = (text: string) => (mask ? fieldMasks[mask](text) : text);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => shape(value));
  const [seen, setSeen] = useState(value);
  const field = useRef<HTMLTextAreaElement>(null);

  if (seen !== value) {
    setSeen(value);
    setDraft(shape(value));
  }

  const fit = (node: HTMLTextAreaElement) => {
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  };

  useEffect(() => {
    const node = field.current;
    if (!editing || !node) return;
    node.focus({ preventScroll: true });
    node.setSelectionRange(node.value.length, node.value.length);
    fit(node);
  }, [editing]);

  const save = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== shape(value)) onChange(next);
    else setDraft(shape(value));
  };

  return (
    <Text
      as={as}
      variant={variant}
      weight={weight}
      tone={tone}
      className={styles.inline}
    >
      {editing ? (
        <textarea
          ref={field}
          className={styles.inlineField}
          value={draft}
          rows={1}
          maxLength={maxLength}
          aria-label={label}
          inputMode={mask === "money" ? "numeric" : mask === "phone" ? "tel" : mask === "email" ? "email" : undefined}
          onChange={(event) => {
            setDraft(shape(event.target.value));
            fit(event.target);
          }}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft(shape(value));
              setEditing(false);
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      ) : (
        <span
          role="button"
          tabIndex={0}
          className={styles.inlineValue}
          data-empty={!value || undefined}
          aria-label={`${label}. Editar`}
          onClick={() => setEditing(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setEditing(true);
            }
          }}
        >
          {display || shape(value) || placeholder}
        </span>
      )}
    </Text>
  );
}

function IdentityChoice({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  return (
    <span className={styles.personChoice}>
      <Avatar name={name} src={avatarUrl ?? undefined} size="xs" />
      <Text as="span" variant="subheadline" weight="medium" truncate>
        {name}
      </Text>
    </span>
  );
}

function Person({ person }: { person?: CrmPerson }) {
  if (!person) return <Empty>Sem responsável</Empty>;
  return <IdentityChoice name={person.name} avatarUrl={person.avatarUrl} />;
}

export function OpportunityDialog(props: OpportunityDialogProps) {
  const [tab, setTab] = useState<OpportunityTab>("details");
  const [seen, setSeen] = useState(props.opportunity?.id);
  const closingRef = useRef(false);
  const flushRef = useRef<(() => Promise<boolean>) | null>(null);

  if (props.opportunity?.id !== seen) {
    setSeen(props.opportunity?.id);
    setTab("details");
  }

  const close = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    const saved = (await flushRef.current?.()) ?? true;
    closingRef.current = false;
    if (saved) props.onClose();
  };

  return (
    <Dialog
      open={props.open}
      onClose={() => void close()}
      label={
        props.opportunity
          ? `Oportunidade ${props.opportunity.reference}`
          : "Oportunidade"
      }
      size="xl"
      surface="solid"
      focusOnOpen={false}
      className={profile.drawer}
      above={
        props.opportunity && (
          <SheetSwitcher
            label="O que ver da oportunidade"
            options={tabs}
            value={tab}
            onChange={setTab}
          />
        )
      }
    >
      {props.opportunity && (
        <OpportunityDetail
          key={props.opportunity.id}
          {...props}
          opportunity={props.opportunity}
          onClose={() => void close()}
          tab={tab}
          flushRef={flushRef}
        />
      )}
    </Dialog>
  );
}

function OpportunityDetail({
  opportunity,
  stages,
  funnels,
  clients,
  team,
  onClose,
  onSaved,
  tab,
  flushRef,
}: OpportunityDialogProps & {
  opportunity: Opportunity;
  tab: OpportunityTab;
  flushRef: RefObject<(() => Promise<boolean>) | null>;
}) {
  const initial = opportunityFormValues(opportunity, funnels);
  const [values, setValues] = useState<OpportunityFormInput>(initial);
  const valuesRef = useRef(values);
  const savedPayload = useRef(JSON.stringify(initial));
  const saveTimer = useRef<number | undefined>(undefined);
  const saveChain = useRef<Promise<boolean>>(Promise.resolve(true));
  const [saving, setSaving] = useState(false);
  const meta = useCrmStages();
  const { toast } = useToast();
  const wide = useMediaQuery("(min-width: 48rem)");
  const [section, setSection] = useState<ProfileSection>("principal");
  /** A etapa sob o mouse na linha do funil: a linha acende até ela e diz para onde o clique leva. */
  const [hoverStage, setHoverStage] = useState<number | null>(null);
  /* Cada aba começa do topo, como na ficha do lead da pousada: a rolagem é uma só para as três. */
  const bodyRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [section]);

  const persist = useCallback(
    (next: OpportunityFormInput) => {
      const key = JSON.stringify(next);
      const run = async () => {
        if (key === savedPayload.current) return true;
        setSaving(true);
        const result = await callAction(saveOpportunityAction(next));
        setSaving(false);
        if (!result.ok) {
          toast({
            title: "Não deu para salvar",
            description: result.error,
            tone: "danger",
          });
          return false;
        }

        savedPayload.current = key;
        onSaved(result.opportunity);
        if (JSON.stringify(valuesRef.current) === key) {
          const normalized = opportunityFormValues(result.opportunity, funnels);
          valuesRef.current = normalized;
          setValues(normalized);
          savedPayload.current = JSON.stringify(normalized);
        }
        return true;
      };
      saveChain.current = saveChain.current.then(run, run);
      return saveChain.current;
    },
    [funnels, onSaved, toast],
  );

  useEffect(() => {
    const key = JSON.stringify(values);
    if (key === savedPayload.current) return;
    if (Boolean(values.nextStepLabel) !== Boolean(values.nextStepAt)) return;

    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(
      () => void persist(values),
      SAVE_PAUSE,
    );
    return () => window.clearTimeout(saveTimer.current);
  }, [persist, values]);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    flushRef.current = async () => {
      window.clearTimeout(saveTimer.current);
      return persist(valuesRef.current);
    };

    return () => {
      window.clearTimeout(saveTimer.current);
      flushRef.current = null;
    };
  }, [flushRef, persist]);

  const change = (patch: Partial<OpportunityFormInput>) =>
    setValues((current) => {
      const next = { ...current, ...patch };
      valuesRef.current = next;
      return next;
    });
  const changeAndSave = (patch: Partial<OpportunityFormInput>) => {
    const next = { ...valuesRef.current, ...patch };
    valuesRef.current = next;
    setValues(next);
    window.clearTimeout(saveTimer.current);
    void persist(next);
  };

  const funnel = funnels.find((entry) => entry.id === values.funnelId);
  const availableStages = funnel?.stages ?? stages;
  const at = Math.max(0, availableStages.indexOf(values.stage));
  const stage = meta[values.stage];
  const view = { ...opportunity, stage: values.stage };
  const next = availableStages
    .slice(at + 1)
    .find((id) => meta[id]?.kind === "open");
  const selectedClient = clients.find((entry) => entry.id === values.clientId);
  const owner = team.find((person) => person.id === values.ownerId);
  const involved = team.filter((person) =>
    values.peopleIds.includes(person.id),
  );
  const people = [owner, ...involved].filter(
    (person, index, list): person is CrmPerson =>
      Boolean(person) &&
      list.findIndex((entry) => entry?.id === person?.id) === index,
  );
  const link = opportunityLink(opportunity);

  const chooseClient = (id: string) => {
    const client = clients.find((entry) => entry.id === id);
    change(
      client
        ? {
            clientId: client.id,
            clientName: client.name,
            clientCompany: client.company ?? "",
            contactName: client.name,
            contactEmail: client.email ?? "",
            contactPhone: client.phone ?? "",
            city: client.city ?? "",
          }
        : { clientId: null },
    );
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copiado`, description: value, tone: "success", feedback: false });
    } catch {
      toast({ title: "Não deu para copiar", description: value, tone: "warning" });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${link}`);
      toast({
        title: "Link copiado",
        description: "O endereço abre esta oportunidade pelo código.",
        tone: "success",
        feedback: false,
      });
    } catch {
      toast({
        title: "Não deu para copiar",
        description: link,
        tone: "warning",
      });
    }
  };

  const stageSections: DropdownSection[] = [
    {
      id: "stage",
      label: "Etapa",
      items: availableStages.map((id) => {
        const item = meta[id];
        const Glyph = item.icon;
        return {
          id: `stage-${id}`,
          label: item.label,
          media: (
            <Glyph weight="bold" style={{ color: item.hue } as CSSProperties} />
          ),
          selected: values.stage === id,
          onSelect: () => changeAndSave({ stage: id }),
        };
      }),
    },
  ];

  const ownerSections: DropdownSection[] = [
    {
      id: "owner",
      label: "Responsável",
      items: [
        {
          id: "owner-none",
          label: "Sem responsável",
          icon: UserCircleIcon,
          selected: !values.ownerId,
          onSelect: () => change({ ownerId: null }),
        },
        ...team.map((person) => ({
          id: `owner-${person.id}`,
          label: person.name,
          media: (
            <Avatar
              name={person.name}
              src={person.avatarUrl ?? undefined}
              size="xs"
            />
          ),
          selected: values.ownerId === person.id,
          onSelect: () => change({ ownerId: person.id }),
        })),
      ],
    },
  ];

  const peopleSections: DropdownSection[] = [
    {
      id: "people",
      label: "Envolvidos",
      items: team.map((person) => ({
        kind: "toggle" as const,
        id: `person-${person.id}`,
        label: person.name,
        media: (
          <Avatar
            name={person.name}
            src={person.avatarUrl ?? undefined}
            size="xs"
          />
        ),
        checked: values.peopleIds.includes(person.id),
        onChange: (checked: boolean) =>
          change({
            peopleIds: checked
              ? [...values.peopleIds, person.id]
              : values.peopleIds.filter((id) => id !== person.id),
          }),
      })),
    },
  ];

  useFloatingActionsRegistration({
    primary: next
      ? {
          label: `Avançar para ${meta[next].label}`,
          icon: <ArrowRightIcon weight="bold" />,
          loading: saving,
          onClick: () => changeAndSave({ stage: next }),
        }
      : undefined,
    cancel: { label: "Fechar oportunidade", onClick: onClose },
  });

  const stageIndex = availableStages.indexOf(values.stage);
  const stageSince = sinceLabel(opportunity.stageSince || opportunity.enteredAt);
  const profileTabs = useTabList(profileTabIds, section, setSection);
  const attribution = values.attribution;
  const tracked = [
    {
      title: "Campanha",
      items: [
        ["campaign", "Campanha"],
        ["adSet", "Conjunto de anúncios"],
        ["ad", "Anúncio"],
        ["sourceUrl", "URL de origem"],
      ] as const,
    },
    {
      title: "Identificadores de clique",
      items: [
        ["gclid", "GCLID"],
        ["ctwaclid", "CTWACLID"],
        ["fbclid", "FBCLID"],
        ["sourceId", "Source ID"],
        ["metaLeadId", "Meta lead ID"],
      ] as const,
    },
  ];
  const utmKeys = ["source", "medium", "campaign", "content", "term"] as const;

  const field = (label: string, content: ReactNode, muted = false) => (
    <div className={profile.field} data-muted={muted || undefined}>
      <dt title={label}>{label}</dt>
      <dd>{content}</dd>
    </div>
  );

  const card = (
    <div className={profile.profile}>
      <header className={profile.head}>
        <div className={profile.titleRow}>
          <IconButton label="Voltar ao funil" variant="ghost" size="sm" className={profile.headButton} onClick={onClose}>
            <CaretLeftIcon />
          </IconButton>
          <span className={profile.name}>
            <InlineText
              value={values.title}
              onChange={(title) => change({ title: title || "Nova oportunidade" })}
              label="Nome da oportunidade"
              as="h2"
              variant="title3"
              weight="semibold"
              placeholder="Nova oportunidade"
              maxLength={opportunityLimits.title}
            />
          </span>
          <OpportunityMenu opportunity={view} stages={availableStages} onMove={(id) => changeAndSave({ stage: id })} icon={<DotsThreeIcon />} />
        </div>

        <div className={profile.tagRow}>
          <button type="button" className={profile.number} title="Copiar o código da oportunidade" onClick={() => void copy(opportunity.reference, "Código")}>
            #{opportunity.reference}
          </button>
          {values.tags.map((tag) => (
            <span key={tag} className={profile.tag} style={{ "--tag": opportunityTagCatalog.hueOf(tag) } as CSSProperties}>
              <span className={profile.tagIcon} aria-hidden="true">
                <TagSimpleIcon weight="fill" />
              </span>
              {tag}
              <button type="button" aria-label={`Tirar a etiqueta ${tag}`} onClick={() => change({ tags: values.tags.filter((item) => item !== tag) })}>
                <XIcon />
              </button>
            </span>
          ))}
          <DropdownMenu
            label="Etiquetas da oportunidade"
            triggerLabel={values.tags.length === 0 ? "Adicionar etiqueta" : `Escolher etiquetas, ${values.tags.length} de ${MAX_TAGS}`}
            sections={tagSections(opportunityTagCatalog, values.tags, (tags) => change({ tags }), MAX_TAGS)}
            trigger={{ disabled: saving }}
            triggerContent={
              <span className={profile.addTag}>
                <PlusIcon aria-hidden="true" />
                {values.tags.length === 0 ? "Adicionar etiqueta" : `${values.tags.length}/${MAX_TAGS}`}
              </span>
            }
          />
        </div>

        <div className={profile.funnel}>
          <span className={profile.funnelName}>{funnel?.name ?? opportunity.funnel?.name ?? "Sem funil"}</span>
          <DropdownMenu
            label="Mover de etapa"
            triggerLabel={`Etapa: ${stage.label}. Mover de etapa`}
            sections={stageSections}
            trigger={{ disabled: saving }}
            triggerContent={
              <span className={profile.stage}>
                <strong>{stage.label}</strong>
                <span>({stageSince})</span>
                <CaretDownIcon aria-hidden="true" />
              </span>
            }
          />
          {/* A linha das etapas também move: cada pedaço é a etapa, na cor dela; passar o mouse mostra o nome e
              acende até ali, e o clique leva a venda para lá. */}
          <div
            className={profile.progress}
            role="group"
            aria-label={`Etapa ${stageIndex + 1} de ${availableStages.length}. Mover para outra etapa`}
          >
            {availableStages.map((id, index) => (
              <button
                key={id}
                type="button"
                className={profile.step}
                data-on={index <= (hoverStage ?? stageIndex) || undefined}
                data-current={index === stageIndex || undefined}
                style={{ "--tone": meta[id].hue } as CSSProperties}
                aria-label={index === stageIndex ? `${meta[id].label}, etapa atual` : `Mover para ${meta[id].label}`}
                aria-current={index === stageIndex ? "step" : undefined}
                disabled={saving}
                onMouseEnter={() => setHoverStage(index)}
                onMouseLeave={() => setHoverStage(null)}
                onFocus={() => setHoverStage(index)}
                onBlur={() => setHoverStage(null)}
                onClick={() => index !== stageIndex && changeAndSave({ stage: id })}
              />
            ))}
          </div>
          <span className={profile.stepHint} aria-hidden="true" data-visible={(hoverStage !== null && hoverStage !== stageIndex) || undefined}>
            {hoverStage !== null && hoverStage !== stageIndex ? `Mover para ${meta[availableStages[hoverStage]].label}` : " "}
          </span>
        </div>

        <div className={profile.sections} aria-label="Seções da ficha" {...profileTabs.listProps}>
          {profileSections.map(({ id, label, icon: Glyph }) => (
            <button key={id} type="button" className={profile.section} onClick={() => setSection(id)} {...profileTabs.tabProps(id)}>
              <Glyph aria-hidden="true" weight={section === id ? "duotone" : "regular"} />
              {label}
            </button>
          ))}
        </div>
      </header>

      <div ref={bodyRef} className={profile.body} role="tabpanel" aria-label={profileSections.find((entry) => entry.id === section)?.label}>
        {section === "principal" && (
          <dl key="principal" className={profile.fields}>
            {field(
              "Usuário responsável",
              <DropdownMenu
                label="Responsável pela oportunidade"
                triggerLabel={`Responsável: ${owner?.name ?? "Sem responsável"}. Escolher outro`}
                sections={ownerSections}
                trigger={{ disabled: saving }}
                triggerContent={<Person person={owner} />}
              />,
            )}
            {field(
              "Venda",
              <InlineText
                value={values.value ? String(values.value) : ""}
                onChange={(value) => change({ value: Number(onlyDigits(value) || 0) })}
                label="Valor da venda"
                variant="footnote"
                placeholder="R$ 0,00"
                mask="money"
              />,
            )}
            {field(
              "Fechamento previsto",
              <span className={profile.badged}>
                {values.expectedAt && (
                  <Badge tone={expectedOf({ ...view, expectedAt: values.expectedAt }).tone} size="sm" icon={<CalendarBlankIcon />} label={expectedOf({ ...view, expectedAt: values.expectedAt }).label} />
                )}
                <DatePicker
                plain
                value={toDate(values.expectedAt)}
                onChange={(date) => change({ expectedAt: toDay(date) })}
                display="d 'de' MMM. 'de' yyyy"
                placeholder="Selecionar data"
                className={profile.date}
              />
              </span>,
            )}
            {field(
              "Temperatura",
              <DropdownMenu
                label="Temperatura da oportunidade"
                triggerLabel={`Temperatura: ${temperatureLabels[values.temperature]}. Escolher outra`}
                trigger={{ disabled: saving }}
                triggerContent={
                  <span className={profile.select}>
                    <Badge tone={temperatureTones[values.temperature]} size="sm" icon={<ThermometerIcon />}>
                      {temperatureLabels[values.temperature]}
                    </Badge>
                    <CaretDownIcon aria-hidden="true" />
                  </span>
                }
                sections={[
                  {
                    id: "temperature",
                    label: "Temperatura",
                    items: temperatureValues.map((temperature) => ({
                      id: `temperature-${temperature}`,
                      label: temperatureLabels[temperature],
                      icon: ThermometerIcon,
                      selected: values.temperature === temperature,
                      onSelect: () => change({ temperature }),
                    })),
                  },
                ]}
              />,
            )}
            {field(
              "Origem",
              <DropdownMenu
                label="Origem da oportunidade"
                triggerLabel={`Origem: ${sourceLabels[values.source]}. Escolher outra`}
                trigger={{ disabled: saving }}
                triggerContent={
                  <span className={profile.select}>
                    <Badge hue={sourceHues[values.source]} size="sm" icon={<SourceMark source={values.source} />}>
                      {sourceLabels[values.source]}
                    </Badge>
                    <CaretDownIcon aria-hidden="true" />
                  </span>
                }
                sections={[
                  {
                    id: "source",
                    label: "Origem",
                    items: opportunitySourceValues.map((source) => ({
                      id: `source-${source}`,
                      label: sourceLabels[source],
                      media: <SourceMark source={source} />,
                      selected: values.source === source,
                      onSelect: () => change({ source }),
                    })),
                  },
                ]}
              />,
            )}
            {field(
              "Cliente",
              <DropdownMenu
                label="Cliente da oportunidade"
                triggerLabel={`Cliente: ${values.clientCompany || values.clientName}. Escolher outro`}
                searchable
                trigger={{ disabled: saving }}
                triggerContent={
                  selectedClient ? (
                    <IdentityChoice name={selectedClient.name} avatarUrl={selectedClient.avatarUrl} />
                  ) : (
                    <span className={profile.select} data-empty="">
                      Selecione
                      <CaretDownIcon aria-hidden="true" />
                    </span>
                  )
                }
                sections={[
                  {
                    id: "clients",
                    label: "Cliente",
                    items: [
                      { id: "client-none", label: "Lead sem cadastro", icon: UserCircleIcon, selected: !values.clientId, onSelect: () => chooseClient(NONE) },
                      ...clients.map((client) => ({
                        id: `client-${client.id}`,
                        label: client.name,
                        description: client.company,
                        media: <Avatar name={client.name} src={client.avatarUrl ?? undefined} size="xs" />,
                        selected: values.clientId === client.id,
                        onSelect: () => chooseClient(client.id),
                      })),
                    ],
                  },
                ]}
              />,
            )}
            {field(
              "Contato",
              <InlineText
                value={values.clientName}
                onChange={(clientName) => change({ clientId: null, clientName, contactName: clientName })}
                label="Nome do contato"
                variant="footnote"
                placeholder="…"
                maxLength={opportunityLimits.clientName}
              />,
            )}
            {field(
              "Telefone",
              <InlineText value={values.contactPhone} onChange={(contactPhone) => change({ contactPhone: onlyDigits(contactPhone) })} label="Telefone" variant="footnote" placeholder="(00) 00000-0000" mask="phone" />,
            )}
            {field(
              "E-mail",
              <InlineText value={values.contactEmail} onChange={(contactEmail) => change({ contactEmail })} label="E-mail" variant="footnote" placeholder="nome@empresa.com" maxLength={opportunityLimits.email} mask="email" />,
            )}
            {field(
              "Cidade",
              <InlineText value={values.city} onChange={(city) => change({ city })} label="Cidade" variant="footnote" placeholder="…" maxLength={opportunityLimits.city} />,
            )}
            {field(
              "Estado",
              <InlineText value={values.state} onChange={(state) => change({ state })} label="Estado" variant="footnote" placeholder="UF" mask="state" />,
            )}
            {field(
              "Último contato",
              <DatePicker
                plain
                value={toDate(values.lastTouchAt)}
                onChange={(date) => change({ lastTouchAt: toDay(date) })}
                display="d 'de' MMM. 'de' yyyy"
                placeholder="Selecionar data"
                className={profile.date}
              />,
            )}
            {field(
              "Envolvidos",
              <DropdownMenu
                label="Envolvidos na oportunidade"
                triggerLabel="Escolher envolvidos"
                sections={peopleSections}
                trigger={{ disabled: saving }}
                triggerContent={
                  people.length === 0 ? (
                    <span className={profile.select} data-empty="">
                      Selecione
                      <CaretDownIcon aria-hidden="true" />
                    </span>
                  ) : (
                    <span className={styles.peopleChoice}>
                      <AvatarGroup>
                        {people.slice(0, 4).map((person) => (
                          <Avatar key={person.id} name={person.name} src={person.avatarUrl ?? undefined} size="xs" />
                        ))}
                      </AvatarGroup>
                      <Text as="span" variant="footnote" truncate>
                        {people.map((person) => person.name.split(" ")[0]).join(", ")}
                      </Text>
                    </span>
                  )
                }
              />,
            )}
            {field(
              "Descrição",
              <InlineText
                value={values.description}
                onChange={(description) => change({ description })}
                label="Descrição da oportunidade"
                variant="footnote"
                placeholder="…"
                maxLength={opportunityLimits.description}
              />,
            )}
            {field(
              "Orçamento",
              opportunity.quote ? (
                <Link href={`/orcamentos/${opportunity.quote.id}` as Route} className={profile.link}>
                  <Badge tone="info" size="sm" icon={<ReceiptIcon />}>
                    {opportunity.quote.reference}
                  </Badge>
                </Link>
              ) : (
                <span className={profile.static} data-empty="">
                  Nenhum ainda
                </span>
              ),
            )}
            {field(
              "Tempo na etapa",
              <Badge tone={isStale(view) ? "warning" : "neutral"} size="sm" icon={<HourglassIcon />}>
                {durationLabel(stageMinutes(opportunity))}
              </Badge>,
              true,
            )}
            {field("Entrada", <span className={profile.static}>{dateTimeLabel(opportunity.enteredAt)}</span>, true)}
            {opportunity.closedAt && field("Fechamento", <span className={profile.static}>{dateTimeLabel(opportunity.closedAt)}</span>, true)}
          </dl>
        )}

        {section === "rastreio" && (
          <div key="rastreio" className={profile.stats}>
            <p className={profile.source}>
              <strong>Origem</strong>
              <span className={profile.sourceLine}>
                <SourceMark source={values.source} /> {sourceLabels[values.source]} <small>(#{opportunity.reference})</small> /{" "}
                {opportunity.enteredAt ? format(parseISO(opportunity.enteredAt), "dd/MM/yyyy") : "hoje"}
              </span>
            </p>
            {tracked.map((group) => (
              <div key={group.title} className={profile.tracked}>
                <strong>{group.title}</strong>
                <span>
                  {group.items.filter(([key]) => attribution[key]).length} de {group.items.length}
                </span>
                <dl className={profile.counts}>
                  {group.items.map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>
                        <InlineText
                          value={attribution[key]}
                          onChange={(value) => change({ attribution: { ...attribution, [key]: value } })}
                          label={label}
                          variant="footnote"
                          placeholder="Sem dado"
                          maxLength={key === "sourceUrl" ? opportunityLimits.sourceUrl : opportunityLimits.attribution}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
            <div className={profile.tracked}>
              <strong>UTM</strong>
              <span>
                {utmKeys.filter((key) => attribution.utm[key]).length} de {utmKeys.length}
              </span>
              <dl className={profile.counts}>
                {utmKeys.map((key) => (
                  <div key={key}>
                    <dt>utm_{key}</dt>
                    <dd>
                      <InlineText
                        value={attribution.utm[key]}
                        onChange={(value) => change({ attribution: { ...attribution, utm: { ...attribution.utm, [key]: value } } })}
                        label={`UTM ${key}`}
                        variant="footnote"
                        placeholder="Sem dado"
                        maxLength={opportunityLimits.attribution}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className={profile.tracked}>
              <strong>Link deste card</strong>
              <IconButton label="Copiar o link deste card" variant="ghost" size="sm" onClick={() => void copyLink()}>
                <CopySimpleIcon />
              </IconButton>
              <span className={profile.linkLine} title={link}>
                {link}
              </span>
            </div>
          </div>
        )}

        {section === "resumo" && (
          <div key="resumo" className={profile.stats}>
            <div className={profile.tracked}>
              <strong>A venda</strong>
              <span>{stage.label}</span>
              <dl className={profile.counts}>
                <div>
                  <dt>Valor</dt>
                  <dd>{fieldMasks.money(String(values.value)) || "R$ 0,00"}</dd>
                </div>
                <div>
                  <dt>Fechamento previsto</dt>
                  <dd data-empty={!values.expectedAt || undefined}>{values.expectedAt ? format(parseISO(values.expectedAt), "dd/MM/yyyy") : "Sem dado"}</dd>
                </div>
                <div>
                  <dt>Temperatura</dt>
                  <dd>
                    <Badge tone={temperatureTones[values.temperature]} size="sm" icon={<ThermometerIcon />}>
                      {temperatureLabels[values.temperature]}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </div>
            <div className={profile.tracked}>
              <strong>Andamento</strong>
              <span>
                {stageIndex + 1} de {availableStages.length}
              </span>
              <dl className={profile.counts}>
                <div>
                  <dt>Na etapa há</dt>
                  <dd>{durationLabel(stageMinutes(opportunity))}</dd>
                </div>
                <div>
                  <dt>Último contato</dt>
                  <dd>{touchLabel({ ...opportunity, lastTouchAt: values.lastTouchAt })}</dd>
                </div>
                <div>
                  <dt>Anexos</dt>
                  <dd>{opportunity.attachments === 1 ? "1 arquivo" : `${opportunity.attachments} arquivos`}</dd>
                </div>
                <div>
                  <dt>Histórico</dt>
                  <dd>{opportunity.activity === 1 ? "1 registro" : `${opportunity.activity} registros`}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const chat = (
    <WhatsappPreview contact={{ name: values.contactName || values.clientName, phone: values.contactPhone }} title={values.title} sender={owner?.name} />
  );

  /* Com largura, os dois cartões lado a lado, a conversa mais larga, como a gaveta do lead da pousada; na
     bandeja do celular, um de cada vez, trocados pelo seletor acima dela. */
  if (wide) {
    return (
      <>
        {chat}
        {card}
      </>
    );
  }
  return tab === "stage" ? <div className={profile.single}>{chat}</div> : card;
}
