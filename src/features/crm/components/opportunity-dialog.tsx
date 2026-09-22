"use client";

import {
  AddressBookIcon,
  ArrowRightIcon,
  CalendarBlankIcon,
  CalendarCheckIcon,
  CheckIcon,
  CopySimpleIcon,
  CurrencyCircleDollarIcon,
  CursorClickIcon,
  EnvelopeSimpleIcon,
  GlobeSimpleIcon,
  HashIcon,
  HourglassIcon,
  ImageSquareIcon,
  KanbanIcon,
  LinkSimpleIcon,
  MapPinIcon,
  MegaphoneIcon,
  PaperclipIcon,
  PhoneIcon,
  ReceiptIcon,
  SignpostIcon,
  TargetIcon,
  ThermometerIcon,
  UserCircleIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import {
  useCallback,
  useEffect,
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
import {
  ProfileFact,
  ProfileFacts,
  ProfileList,
  ProfileRow,
  ProfileSection,
  ProfileTags,
} from "@/components/ui/profile";
import { Progress } from "@/components/ui/progress";
import { SheetSwitcher } from "@/components/ui/sheet-switcher";
import { tagSections } from "@/components/ui/tag-picker";
import { Text } from "@/components/ui/text";
import { callAction } from "@/lib/action";
import { squircle } from "@/lib/corners";
import { onlyDigits } from "@/lib/masks";
import { compactMoney, formatMoney } from "@/lib/utils/format";
import { saveOpportunityAction } from "../actions";
import { opportunityFormValues } from "../form-values";
import {
  crmStatusLabels,
  crmStatusTones,
  dateTimeLabel,
  durationLabel,
  opportunityLink,
  sourceHues,
  sourceLabels,
  stageMinutes,
  statusOf,
  temperatureLabels,
  temperatureTones,
  touchLabel,
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
import { useCrmStages } from "./stage-context";
import styles from "./opportunity-dialog.module.css";

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
  { id: "stage", label: "Caminho" },
] as const;
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

function FactText({ children }: { children: string }) {
  return (
    <Text
      as="span"
      variant="subheadline"
      className={styles.factText}
      title={children}
      truncate
    >
      {children}
    </Text>
  );
}

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
}: {
  value: string;
  display?: string;
  onChange: (value: string) => void;
  label: string;
  as?: "h2" | "p" | "span";
  variant?: "title2" | "title3" | "callout" | "subheadline";
  weight?: "medium" | "semibold";
  tone?: "secondary";
  placeholder?: string;
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const field = useRef<HTMLTextAreaElement>(null);

  if (seen !== value) {
    setSeen(value);
    setDraft(value);
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
    if (next !== value) onChange(next);
    else setDraft(value);
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
          onChange={(event) => {
            setDraft(event.target.value);
            fit(event.target);
          }}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft(value);
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
          {display || value || placeholder}
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
      focusOnOpen={false}
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
  const StageGlyph = stage.icon;
  const view = { ...opportunity, stage: values.stage };
  const status = statusOf(view);
  const weighted = Math.round((values.value * values.probability) / 100);
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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${link}`);
      toast({
        title: "Link copiado",
        description: "O endereço abre esta oportunidade pelo código.",
        tone: "success",
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

  return (
    <div className={styles.dialog} data-tab={tab}>
      <header className={styles.head}>
        <div className={styles.route}>
          <KanbanIcon aria-hidden="true" />
          <Text as="span" variant="caption1" tone="secondary" truncate>
            {funnel?.name ?? opportunity.funnel?.name ?? "Sem funil"}
          </Text>
          <ArrowRightIcon aria-hidden="true" />
          <Badge
            tone="neutral"
            variant="soft"
            size="sm"
            className={styles.reference}
          >
            {opportunity.reference}
          </Badge>
        </div>
        <div className={styles.headTools}>
          <OpportunityMenu
            opportunity={view}
            stages={availableStages}
            onMove={(id) => changeAndSave({ stage: id })}
          />
          <IconButton
            label="Fechar"
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <XIcon />
          </IconButton>
        </div>
      </header>

      <div className={styles.body}>
        <section
          className={styles.main}
          aria-label="Informações da oportunidade"
        >
          <div className={styles.identity}>
            <Avatar
              name={values.clientName}
              src={
                selectedClient?.avatarUrl ??
                opportunity.client.avatarUrl ??
                undefined
              }
              size="lg"
            />
            <div className={styles.naming}>
              <InlineText
                value={values.title}
                onChange={(title) =>
                  change({ title: title || "Nova oportunidade" })
                }
                label="Título da oportunidade"
                as="h2"
                variant="title2"
                weight="semibold"
                placeholder="Nova oportunidade"
                maxLength={opportunityLimits.title}
              />
              <div className={styles.badges}>
                <DropdownMenu
                  label="Etapa da oportunidade"
                  triggerLabel={`Etapa: ${stage.label}. Escolher outra`}
                  sections={stageSections}
                  trigger={{ disabled: saving }}
                  triggerContent={
                    <Badge
                      tone={crmStatusTones[status]}
                      size="md"
                      icon={<StageGlyph />}
                    >
                      {stage.label}
                    </Badge>
                  }
                />
                <DropdownMenu
                  label="Temperatura da oportunidade"
                  triggerLabel={`Temperatura: ${temperatureLabels[values.temperature]}. Escolher outra`}
                  trigger={{ disabled: saving }}
                  triggerContent={
                    <Badge
                      tone={temperatureTones[values.temperature]}
                      size="md"
                      icon={<ThermometerIcon />}
                    >
                      {temperatureLabels[values.temperature]}
                    </Badge>
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
                />
                <Badge tone="neutral" size="md">
                  {crmStatusLabels[status]}
                </Badge>
              </div>
              <InlineText
                value={values.clientName}
                onChange={(clientName) =>
                  change({
                    clientId: null,
                    clientName,
                    contactName: clientName,
                  })
                }
                label="Nome do cliente"
                as="p"
                variant="subheadline"
                tone="secondary"
                placeholder="Novo lead"
                maxLength={opportunityLimits.clientName}
              />
            </div>
          </div>

          <div className={styles.numbers}>
            <div className={styles.number} {...squircle("lg")}>
              <Text as="p" variant="caption1" tone="secondary">
                Valor
              </Text>
              <InlineText
                value={formatMoney(values.value)}
                display={compactMoney(values.value)}
                onChange={(value) =>
                  change({ value: Number(onlyDigits(value) || 0) })
                }
                label="Valor da oportunidade"
                as="p"
                variant="title3"
                weight="semibold"
              />
            </div>
            <div className={styles.number} {...squircle("lg")}>
              <Text as="p" variant="caption1" tone="secondary">
                Chance
              </Text>
              <InlineText
                value={String(values.probability)}
                display={`${values.probability}%`}
                onChange={(value) =>
                  change({
                    probability: Math.min(100, Number(onlyDigits(value) || 0)),
                  })
                }
                label="Chance de fechar"
                as="p"
                variant="title3"
                weight="semibold"
                maxLength={3}
              />
            </div>
            <div className={styles.number} {...squircle("lg")}>
              <Text as="p" variant="caption1" tone="secondary">
                Previsto
              </Text>
              <Text
                as="p"
                variant="title3"
                weight="semibold"
                numeric
                title={formatMoney(weighted)}
                truncate
              >
                {compactMoney(weighted)}
              </Text>
            </div>
          </div>

          <Progress
            value={values.probability}
            max={100}
            segments={10}
            size="sm"
            tone={values.temperature === "hot" ? "success" : "accent"}
            aria-label={`Chance de fechar: ${values.probability}%`}
          />

          <div className={styles.step} {...squircle("lg")}>
            <span className={styles.stepGlyph} aria-hidden="true">
              <SignpostIcon weight="bold" />
            </span>
            <div className={styles.stepText}>
              <Text as="p" variant="caption1" tone="secondary">
                Próximo passo
              </Text>
              <InlineText
                value={values.nextStepLabel}
                onChange={(nextStepLabel) => change({ nextStepLabel })}
                label="Próximo passo"
                as="p"
                variant="subheadline"
                weight="medium"
                placeholder="Adicionar próximo passo"
                maxLength={opportunityLimits.nextStep}
              />
            </div>
            <DatePicker
              plain
              value={toDate(values.nextStepAt)}
              onChange={(date) => change({ nextStepAt: toDay(date) })}
              display="d MMM."
              placeholder="Data"
              className={styles.plainDate}
            />
          </div>

          <InlineText
            value={values.description}
            onChange={(description) => change({ description })}
            label="Descrição da oportunidade"
            as="p"
            variant="subheadline"
            placeholder="Adicionar descrição"
            maxLength={opportunityLimits.description}
          />

          <ProfileSection title="Informações">
            <ProfileFacts columns>
              <ProfileFact icon={UserIcon} label="Responsável">
                <DropdownMenu
                  label="Responsável pela oportunidade"
                  triggerLabel={`Responsável: ${owner?.name ?? "Sem responsável"}. Escolher outro`}
                  sections={ownerSections}
                  trigger={{ disabled: saving }}
                  triggerContent={<Person person={owner} />}
                />
              </ProfileFact>
              <ProfileFact icon={AddressBookIcon} label="Cliente">
                <DropdownMenu
                  label="Cliente da oportunidade"
                  triggerLabel={`Cliente: ${values.clientCompany || values.clientName}. Escolher outro`}
                  searchable
                  sections={[
                    {
                      id: "clients",
                      label: "Cliente",
                      items: [
                        {
                          id: "client-none",
                          label: "Lead sem cadastro",
                          icon: UserCircleIcon,
                          selected: !values.clientId,
                          onSelect: () => chooseClient(NONE),
                        },
                        ...clients.map((client) => ({
                          id: `client-${client.id}`,
                          label: client.name,
                          description: client.company,
                          media: (
                            <Avatar
                              name={client.name}
                              src={client.avatarUrl ?? undefined}
                              size="xs"
                            />
                          ),
                          selected: values.clientId === client.id,
                          onSelect: () => chooseClient(client.id),
                        })),
                      ],
                    },
                  ]}
                  trigger={{ disabled: saving }}
                  triggerContent={
                    <IdentityChoice
                      name={values.clientName}
                      avatarUrl={
                        selectedClient
                          ? selectedClient.avatarUrl
                          : opportunity.client.avatarUrl
                      }
                    />
                  }
                />
              </ProfileFact>
              <ProfileFact icon={EnvelopeSimpleIcon} label="E-mail">
                <InlineText
                  value={values.contactEmail}
                  onChange={(contactEmail) => change({ contactEmail })}
                  label="E-mail"
                  maxLength={opportunityLimits.email}
                />
              </ProfileFact>
              <ProfileFact icon={PhoneIcon} label="Telefone">
                <InlineText
                  value={values.contactPhone}
                  onChange={(contactPhone) => change({ contactPhone })}
                  label="Telefone"
                  maxLength={opportunityLimits.phone}
                />
              </ProfileFact>
              <ProfileFact icon={SignpostIcon} label="Origem">
                <DropdownMenu
                  label="Origem da oportunidade"
                  triggerLabel={`Origem: ${sourceLabels[values.source]}. Escolher outra`}
                  trigger={{ disabled: saving }}
                  triggerContent={
                    <Badge
                      size="sm"
                      hue={sourceHues[values.source]}
                      icon={<SourceMark source={values.source} />}
                    >
                      {sourceLabels[values.source]}
                    </Badge>
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
                />
              </ProfileFact>
              <ProfileFact icon={KanbanIcon} label="Funil">
                <DropdownMenu
                  label="Funil da oportunidade"
                  triggerLabel={`Funil: ${funnel?.name ?? "Sem funil"}. Escolher outro`}
                  searchable
                  trigger={{ disabled: saving }}
                  triggerContent={
                    <Text
                      as="span"
                      variant="subheadline"
                      weight="medium"
                      truncate
                    >
                      {funnel?.name ?? "Sem funil"}
                    </Text>
                  }
                  sections={[
                    {
                      id: "funnel",
                      label: "Funil",
                      items: [
                        {
                          id: "funnel-none",
                          label: "Sem funil",
                          icon: KanbanIcon,
                          selected: !values.funnelId,
                          onSelect: () =>
                            change({
                              funnelId: null,
                              stage: stages[0] ?? "lead",
                            }),
                        },
                        ...funnels
                          .filter((item) => item.reference)
                          .map((item) => ({
                            id: `funnel-${item.id}`,
                            label: item.name,
                            icon: KanbanIcon,
                            selected: values.funnelId === item.id,
                            onSelect: () =>
                              change({
                                funnelId: item.id,
                                stage: item.stages[0] ?? "lead",
                              }),
                          })),
                      ],
                    },
                  ]}
                />
              </ProfileFact>
              <ProfileFact icon={MapPinIcon} label="Cidade">
                <InlineText
                  value={values.city}
                  onChange={(city) => change({ city })}
                  label="Cidade"
                  maxLength={opportunityLimits.city}
                />
              </ProfileFact>
              <ProfileFact icon={MapPinIcon} label="Estado">
                <InlineText
                  value={values.state}
                  onChange={(state) => change({ state: state.toUpperCase() })}
                  label="Estado"
                  maxLength={2}
                />
              </ProfileFact>
              <ProfileFact icon={CalendarBlankIcon} label="Previsão">
                <DatePicker
                  plain
                  value={toDate(values.expectedAt)}
                  onChange={(date) => change({ expectedAt: toDay(date) })}
                  display="d 'de' MMM. 'de' yyyy"
                  placeholder="Vazio"
                  className={styles.plainDate}
                />
              </ProfileFact>
              <ProfileFact icon={CalendarCheckIcon} label="Último contato">
                <DatePicker
                  plain
                  value={toDate(values.lastTouchAt)}
                  onChange={(date) => change({ lastTouchAt: toDay(date) })}
                  display="d 'de' MMM. 'de' yyyy"
                  placeholder="Vazio"
                  className={styles.plainDate}
                />
              </ProfileFact>
              <ProfileFact icon={HourglassIcon} label="Tempo na etapa">
                <FactText>
                  {durationLabel(stageMinutes(opportunity))}
                </FactText>
              </ProfileFact>
              <ProfileFact icon={HashIcon} label="Código">
                <FactText>{opportunity.reference}</FactText>
              </ProfileFact>
              <ProfileFact icon={CalendarBlankIcon} label="Entrada">
                <FactText>{dateTimeLabel(opportunity.enteredAt)}</FactText>
              </ProfileFact>
              {opportunity.closedAt && (
                <ProfileFact icon={CalendarCheckIcon} label="Fechamento">
                  <FactText>{dateTimeLabel(opportunity.closedAt)}</FactText>
                </ProfileFact>
              )}
            </ProfileFacts>
          </ProfileSection>

          <ProfileSection title="Origem e campanha">
            <ProfileFacts columns>
              {(
                [
                  ["campaign", "Campanha", MegaphoneIcon],
                  ["adSet", "Conjunto de anúncios", TargetIcon],
                  ["ad", "Anúncio", ImageSquareIcon],
                  ["gclid", "GCLID", CursorClickIcon],
                  ["ctwaclid", "CTWACLID", CursorClickIcon],
                  ["fbclid", "FBCLID", CursorClickIcon],
                  ["sourceId", "Source ID", HashIcon],
                  ["metaLeadId", "Meta lead ID", HashIcon],
                  ["sourceUrl", "URL de origem", GlobeSimpleIcon],
                ] as const
              ).map(([key, label, Glyph]) => (
                <ProfileFact key={key} icon={Glyph} label={label}>
                  <InlineText
                    value={values.attribution[key]}
                    onChange={(value) =>
                      change({
                        attribution: { ...values.attribution, [key]: value },
                      })
                    }
                    label={label}
                    maxLength={
                      key === "sourceUrl"
                        ? opportunityLimits.sourceUrl
                        : opportunityLimits.attribution
                    }
                  />
                </ProfileFact>
              ))}
              {(
                ["source", "medium", "campaign", "content", "term"] as const
              ).map((key) => (
                <ProfileFact
                  key={key}
                  icon={LinkSimpleIcon}
                  label={`UTM ${key}`}
                >
                  <InlineText
                    value={values.attribution.utm[key]}
                    onChange={(value) =>
                      change({
                        attribution: {
                          ...values.attribution,
                          utm: { ...values.attribution.utm, [key]: value },
                        },
                      })
                    }
                    label={`UTM ${key}`}
                    maxLength={opportunityLimits.attribution}
                  />
                </ProfileFact>
              ))}
            </ProfileFacts>
          </ProfileSection>

          <ProfileSection title="Link deste card">
            <div className={styles.link} {...squircle("md")}>
              <LinkSimpleIcon aria-hidden="true" />
              <span className={styles.linkText}>{link}</span>
              <IconButton
                label="Copiar o link deste card"
                variant="ghost"
                size="sm"
                onClick={() => void copyLink()}
              >
                <CopySimpleIcon />
              </IconButton>
            </div>
          </ProfileSection>

          <ProfileSection title="Etiquetas">
            <DropdownMenu
              label="Etiquetas da oportunidade"
              triggerLabel="Escolher etiquetas"
              sections={tagSections(
                opportunityTagCatalog,
                values.tags,
                (tags) => change({ tags }),
                MAX_TAGS,
              )}
              trigger={{ disabled: saving }}
              triggerContent={
                values.tags.length === 0 ? (
                  <Empty />
                ) : (
                  <ProfileTags>
                    {values.tags.map((tag) => (
                      <Badge
                        key={tag}
                        size="md"
                        hue={opportunityTagCatalog.hueOf(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </ProfileTags>
                )
              }
            />
          </ProfileSection>

          <ProfileSection title="Orçamento">
            {opportunity.quote ? (
              <ProfileList>
                <ProfileRow
                  href={`/orcamentos/${opportunity.quote.id}` as Route}
                  icon={ReceiptIcon}
                  title={opportunity.quote.reference}
                  caption={formatMoney(values.value)}
                />
              </ProfileList>
            ) : (
              <Text as="p" variant="footnote" tone="tertiary">
                Nenhum orçamento saiu desta oportunidade ainda
              </Text>
            )}
          </ProfileSection>
        </section>

        <aside className={styles.side} aria-label="Caminho no funil">
          <ProfileSection
            title="Caminho no funil"
            aside={
              <Text as="span" variant="caption1" tone="tertiary">
                {at + 1} de {availableStages.length}
              </Text>
            }
          >
            <ol className={styles.path}>
              {availableStages.map((id, index) => {
                const item = meta[id];
                const Glyph = item.icon;
                const done = index < at;
                const current = id === values.stage;
                return (
                  <li
                    key={id}
                    className={styles.pathItem}
                    style={{ "--stage-hue": item.hue } as CSSProperties}
                  >
                    <button
                      type="button"
                      className={styles.pathStep}
                      data-done={done || undefined}
                      data-current={current || undefined}
                      aria-current={current ? "step" : undefined}
                      disabled={saving}
                      onClick={() => changeAndSave({ stage: id })}
                      {...squircle("md")}
                    >
                      <span className={styles.pathGlyph} aria-hidden="true">
                        {done ? (
                          <CheckIcon weight="bold" />
                        ) : (
                          <Glyph weight="bold" />
                        )}
                      </span>
                      <Text
                        as="span"
                        variant="subheadline"
                        weight={current ? "semibold" : "regular"}
                        truncate
                      >
                        {item.label}
                      </Text>
                    </button>
                  </li>
                );
              })}
            </ol>
          </ProfileSection>

          <ProfileSection title="Equipe">
            <ProfileFacts>
              <ProfileFact icon={UserIcon} label="Responsável">
                <DropdownMenu
                  label="Responsável pela oportunidade"
                  triggerLabel={`Responsável: ${owner?.name ?? "Sem responsável"}. Escolher outro`}
                  sections={ownerSections}
                  trigger={{ disabled: saving }}
                  triggerContent={<Person person={owner} />}
                />
              </ProfileFact>
              <ProfileFact icon={UsersIcon} label="Envolvidos">
                <DropdownMenu
                  label="Envolvidos na oportunidade"
                  triggerLabel="Escolher envolvidos"
                  sections={peopleSections}
                  trigger={{ disabled: saving }}
                  triggerContent={
                    people.length === 0 ? (
                      <Empty />
                    ) : (
                      <span className={styles.peopleChoice}>
                        <AvatarGroup>
                          {people.slice(0, 4).map((person) => (
                            <Avatar
                              key={person.id}
                              name={person.name}
                              src={person.avatarUrl ?? undefined}
                              size="xs"
                            />
                          ))}
                        </AvatarGroup>
                        <Text
                          as="span"
                          variant="subheadline"
                          weight="medium"
                          truncate
                        >
                          {people
                            .map((person) => person.name.split(" ")[0])
                            .join(", ")}
                        </Text>
                      </span>
                    )
                  }
                />
              </ProfileFact>
            </ProfileFacts>
          </ProfileSection>

          <ProfileSection title="Venda">
            <ProfileFacts>
              <ProfileFact icon={CurrencyCircleDollarIcon} label="Valor cheio">
                <FactText>{formatMoney(values.value)}</FactText>
              </ProfileFact>
              <ProfileFact icon={ThermometerIcon} label="Último contato">
                <FactText>
                  {touchLabel({
                    ...opportunity,
                    lastTouchAt: values.lastTouchAt,
                  })}
                </FactText>
              </ProfileFact>
              <ProfileFact icon={PaperclipIcon} label="Anexos">
                <FactText>
                  {opportunity.attachments === 1
                    ? "1 arquivo"
                    : `${opportunity.attachments} arquivos`}
                </FactText>
              </ProfileFact>
              <ProfileFact icon={HashIcon} label="Histórico">
                <FactText>
                  {opportunity.activity === 1
                    ? "1 registro"
                    : `${opportunity.activity} registros`}
                </FactText>
              </ProfileFact>
            </ProfileFacts>
          </ProfileSection>
        </aside>
      </div>
    </div>
  );
}
