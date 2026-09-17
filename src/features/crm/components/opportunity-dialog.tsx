"use client";

import {
  AddressBookIcon,
  ArrowRightIcon,
  CalendarBlankIcon,
  CalendarCheckIcon,
  CheckIcon,
  ClockCountdownIcon,
  ClockCounterClockwiseIcon,
  ClockIcon,
  CopySimpleIcon,
  CurrencyCircleDollarIcon,
  CursorClickIcon,
  EnvelopeSimpleIcon,
  FunnelSimpleIcon,
  GlobeSimpleIcon,
  HashIcon,
  HourglassIcon,
  IdentificationCardIcon,
  ImageSquareIcon,
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
  XIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { ProfileFact, ProfileFacts, ProfileList, ProfileRow, ProfileSection, ProfileTags } from "@/components/ui/profile";
import { Progress } from "@/components/ui/progress";
import { SheetSwitcher } from "@/components/ui/sheet-switcher";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import { compactMoney, formatMoney } from "@/lib/utils/format";
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
  stepDate,
  temperatureLabels,
  temperatureTones,
  touchLabel,
} from "../labels";
import { crmStageMeta, type CrmStage } from "../stages";
import type { CrmPerson, Opportunity } from "../summary";
import { OpportunityMenu } from "./opportunity-menu";
import styles from "./opportunity-dialog.module.css";

export type OpportunityDialogProps = {
  /** A oportunidade aberta; nulo mantém a janela montada e fechada, para a saída animar. */
  opportunity: Opportunity | null;
  open: boolean;
  onClose: () => void;
  /** As etapas do funil onde ela está: são elas que o caminho desenha e que o "Mover para" oferece. */
  stages: CrmStage[];
  team?: CrmPerson[];
  onStageChange?: (stage: CrmStage) => void;
};

/** Qual metade da janela está à vista no celular, onde as duas não cabem lado a lado. */
type OpportunityTab = "details" | "stage";

const opportunityTabs = [
  { id: "details", label: "Informações" },
  { id: "stage", label: "Caminho" },
] as const satisfies readonly { id: OpportunityTab; label: string }[];

// A ficha da oportunidade (2026-09-15): é aqui que o funil se separa do quadro de tarefas. A tarefa aberta
// pergunta "o que falta fazer"; a venda aberta pergunta **"quanto vale, qual a chance e qual é o próximo
// passo"**, então a ficha abre pelo dinheiro em vez de abrir pela lista de trabalho.
//
// A moldura é a de trabalho da casa, a `Dialog` `xl` centrada, a mesma do editor de orçamento, da ficha da
// tarefa e da janela do projeto. À esquerda a informação: quem está do outro lado, os três números da venda,
// o próximo passo, o que foi combinado e os detalhes. À direita o **caminho no funil**, que é a lista das
// etapas deste funil com a atual marcada, e onde se anda de etapa com um clique, mais a equipe.
//
// No celular a janela segue a ficha da tarefa e a do projeto: a bandeja mostra uma metade por vez, trocadas
// pelo seletor que flutua acima dela, e toda abertura começa em Informações, porque a janela é uma só para o
// quadro inteiro.
export function OpportunityDialog({ opportunity, open, onClose, stages, team, onStageChange }: OpportunityDialogProps) {
  const [tab, setTab] = useState<OpportunityTab>("details");
  const [seen, setSeen] = useState(opportunity?.id);
  if (opportunity && opportunity.id !== seen) {
    setSeen(opportunity.id);
    setTab("details");
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      label={opportunity ? `Oportunidade ${opportunity.title}` : "Oportunidade"}
      size="xl"
      focusOnOpen={false}
      above={opportunity && <SheetSwitcher label="O que ver da oportunidade" options={opportunityTabs} value={tab} onChange={setTab} />}
    >
      {opportunity && (
        <OpportunityDetail
          key={opportunity.id}
          opportunity={opportunity}
          tab={tab}
          stages={stages}
          team={team}
          onClose={onClose}
          onStageChange={onStageChange}
        />
      )}
    </Dialog>
  );
}

/**
 * O valor de um fato que pode não existir: o travessão no lugar dele, na tinta apagada. Vazio some seria o
 * padrão da casa numa ficha curta; aqui não, porque numa venda o campo em branco é o que falta preencher.
 *
 * `mono` para identificador de clique e de anúncio, que é código de máquina: em fonte proporcional, um
 * `Cj0KCQjw` é impossível de conferir contra o que está na plataforma.
 */
function Value({ children, mono }: { children?: ReactNode; mono?: boolean }) {
  if (children === undefined || children === null || children === "" || children === false) {
    return (
      <Text as="span" variant="subheadline" tone="tertiary">
        —
      </Text>
    );
  }

  return (
    <Text as="span" variant="subheadline" font={mono ? "code" : undefined} className={mono ? styles.mono : undefined}>
      {children}
    </Text>
  );
}

function OpportunityDetail({
  opportunity,
  tab,
  stages,
  team,
  onClose,
  onStageChange,
}: {
  opportunity: Opportunity;
  tab: OpportunityTab;
  stages: CrmStage[];
  team?: CrmPerson[];
  onClose: () => void;
  onStageChange?: (stage: CrmStage) => void;
}) {
  const status = statusOf(opportunity);
  const stage = crmStageMeta[opportunity.stage];
  const Glyph = stage.icon;
  /* O previsto ponderado: o valor vezes a chance. É o número que o funil responde de verdade, porque somar o
     valor cheio conta como certo o que ainda é conversa. */
  const weighted = Math.round((opportunity.value * opportunity.probability) / 100);
  const at = stages.indexOf(opportunity.stage);
  /* A próxima etapa do caminho deste funil, pulando os dois desfechos: avançar é andar na venda, e fechar
     ganhando ou perdendo é decisão à parte, que mora no leque. */
  const ahead = stages.filter((id) => crmStageMeta[id].kind === "open");
  const next = ahead[ahead.indexOf(opportunity.stage) + 1];
  const people = opportunity.people.length > 0 ? opportunity.people : team ?? [opportunity.owner];
  const link = opportunityLink(opportunity);
  const { toast } = useToast();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${link}`);
      toast({ title: "Link copiado", description: "Mande para quem precisa abrir esta oportunidade.", tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: link, tone: "warning" });
    }
  };

  useFloatingActionsRegistration({
    primary: next && onStageChange ? { label: `Avançar para ${crmStageMeta[next].label}`, icon: <ArrowRightIcon weight="bold" />, onClick: () => onStageChange(next) } : undefined,
    cancel: { label: "Fechar oportunidade", onClick: onClose },
  });

  return (
    <div className={styles.dialog} data-tab={tab}>
      <header className={styles.head}>
        <div className={styles.route}>
          <FunnelSimpleIcon aria-hidden="true" />
          <Text as="span" variant="caption1" tone="secondary" truncate>
            {opportunity.funnel?.name ?? "Sem funil"}
          </Text>
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          <Text as="span" variant="caption1" tone="tertiary" numeric>
            {opportunity.reference}
          </Text>
        </div>
        <div className={styles.headTools}>
          <OpportunityMenu opportunity={opportunity} stages={stages} onMove={onStageChange} />
          <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
            <XIcon />
          </IconButton>
        </div>
      </header>

      <div className={styles.body}>
        {/* A metade da informação: quem, quanto, e o que fazer a seguir. */}
        <section className={styles.main} aria-label="Informações da oportunidade">
          <div className={styles.identity}>
            <Avatar name={opportunity.client.name} src={opportunity.client.avatarUrl ?? undefined} size="lg" />
            <div className={styles.naming}>
              <Text as="h2" variant="title2" weight="semibold" className={styles.title}>
                {opportunity.title}
              </Text>
              <div className={styles.badges}>
                <Badge tone={crmStatusTones[status]} size="md" icon={<Glyph />}>
                  {stage.label}
                </Badge>
                <Badge tone={temperatureTones[opportunity.temperature]} size="md" icon={<ThermometerIcon />}>
                  {temperatureLabels[opportunity.temperature]}
                </Badge>
                <Badge tone="neutral" size="md">
                  {crmStatusLabels[status]}
                </Badge>
              </div>
              <Text as="p" variant="footnote" tone="secondary" className={styles.who}>
                {opportunity.client.name}
                {opportunity.client.company ? `, ${opportunity.client.company}` : ""}
              </Text>
            </div>
          </div>

          {/* Os três números da venda, que é o que a ficha existe para responder: quanto vale, qual a chance
              e quanto disso é previsto de verdade. A barra fica embaixo dos três, no matiz da temperatura. */}
          <div className={styles.numbers}>
            <div className={styles.number} {...squircle("lg")}>
              <Text as="p" variant="caption1" tone="secondary">
                Valor
              </Text>
              <Text as="p" variant="title3" weight="semibold" numeric title={formatMoney(opportunity.value)}>
                {compactMoney(opportunity.value)}
              </Text>
            </div>
            <div className={styles.number} {...squircle("lg")}>
              <Text as="p" variant="caption1" tone="secondary">
                Chance
              </Text>
              <Text as="p" variant="title3" weight="semibold" numeric>
                {opportunity.probability}%
              </Text>
            </div>
            <div className={styles.number} {...squircle("lg")}>
              <Text as="p" variant="caption1" tone="secondary">
                Previsto
              </Text>
              <Text as="p" variant="title3" weight="semibold" numeric title={formatMoney(weighted)}>
                {compactMoney(weighted)}
              </Text>
            </div>
          </div>

          <Progress
            value={opportunity.probability}
            max={100}
            /* Dez degraus, um por dez por cento, como a régua de uso da IA. */
            segments={10}
            size="sm"
            tone={opportunity.temperature === "hot" ? "success" : "accent"}
            aria-label={`Chance de fechar: ${opportunity.probability}%`}
          />

          {/* O próximo passo em destaque, antes de tudo: é a única coisa da ficha que tira a venda do lugar,
              e numa lista de fatos ele viraria mais uma linha. */}
          {opportunity.nextStep && (
            <div className={styles.step} {...squircle("lg")}>
              <span className={styles.stepGlyph} aria-hidden="true">
                <SignpostIcon weight="bold" />
              </span>
              <div className={styles.stepText}>
                <Text as="p" variant="caption1" tone="secondary">
                  Próximo passo
                </Text>
                <Text as="p" variant="subheadline" weight="medium">
                  {opportunity.nextStep.label}
                </Text>
              </div>
              <Badge tone="accent" size="sm" icon={<CalendarBlankIcon />}>
                {stepDate(opportunity.nextStep.at)}
              </Badge>
            </div>
          )}

          <Text as="p" variant="subheadline" className={styles.description}>
            {opportunity.description}
          </Text>

          {/**
           * Os campos vêm da ficha do CRM que o usuário usa hoje (2026-09-15, a pedido de ter "todas essas
           * informações" para fazer a gestão), mas o **desenho é o da casa**: os fatos de perfil, rótulo com
           * glifo à esquerda e valor à direita, os mesmos da ficha do cliente, do membro e do projeto. Copiar
           * a grade de células com fio daquela ficha traria um segundo jeito de mostrar dado para dentro da
           * aplicação, e é justamente o que o sistema de componentes existe para evitar.
           *
           * Campo vazio mostra o travessão em vez de sumir: numa venda de anúncio, o que falta preencher é o
           * que o marketing precisa corrigir, e um campo que some não avisa nada.
           */}
          <ProfileSection title="Informações">
            <ProfileFacts columns>
              <ProfileFact icon={UserIcon} label="Responsável">
                {opportunity.owner.name}
              </ProfileFact>
              <ProfileFact icon={AddressBookIcon} label="Cliente">
                {opportunity.client.company ?? opportunity.client.name}
              </ProfileFact>
              <ProfileFact icon={UserCircleIcon} label="Contato">
                <Value>{opportunity.contact?.name}</Value>
              </ProfileFact>
              <ProfileFact icon={EnvelopeSimpleIcon} label="E-mail">
                <Value>{opportunity.contact?.email}</Value>
              </ProfileFact>
              <ProfileFact icon={PhoneIcon} label="Telefone">
                <Value>{opportunity.contact?.phone}</Value>
              </ProfileFact>
              <ProfileFact icon={HashIcon} label="Código">
                {opportunity.reference}
              </ProfileFact>
              <ProfileFact icon={IdentificationCardIcon} label="Código PN">
                <Value>{opportunity.partnerCode}</Value>
              </ProfileFact>
              <ProfileFact icon={SignpostIcon} label="Origem">
                <Badge size="sm" hue={sourceHues[opportunity.source]}>
                  {sourceLabels[opportunity.source]}
                </Badge>
              </ProfileFact>
              <ProfileFact icon={FunnelSimpleIcon} label="Funil">
                {opportunity.funnel?.name ?? "Sem funil"}
              </ProfileFact>
              <ProfileFact icon={CurrencyCircleDollarIcon} label="Valor">
                {formatMoney(opportunity.value)}
              </ProfileFact>
              <ProfileFact icon={MapPinIcon} label="Cidade e estado">
                <Value>{[opportunity.city, opportunity.state].filter(Boolean).join(", ")}</Value>
              </ProfileFact>
              <ProfileFact icon={HourglassIcon} label="Tempo na etapa">
                {durationLabel(stageMinutes(opportunity))}
              </ProfileFact>
              <ProfileFact icon={ClockIcon} label="1ª resposta">
                <Value>{opportunity.firstResponseMinutes && durationLabel(opportunity.firstResponseMinutes)}</Value>
              </ProfileFact>
              <ProfileFact icon={ClockCountdownIcon} label="Resposta média">
                <Value>{opportunity.averageResponseMinutes && durationLabel(opportunity.averageResponseMinutes)}</Value>
              </ProfileFact>
              <ProfileFact icon={CalendarBlankIcon} label="Entrada">
                {dateTimeLabel(opportunity.enteredAt)}
              </ProfileFact>
              <ProfileFact icon={CalendarCheckIcon} label="Fechamento">
                <Value>{opportunity.closedAt && dateTimeLabel(opportunity.closedAt)}</Value>
              </ProfileFact>
              <ProfileFact icon={ThermometerIcon} label="Último contato">
                {touchLabel(opportunity)}
              </ProfileFact>
            </ProfileFacts>
          </ProfileSection>

          {/* O rastro da campanha em seção própria: é o que fecha a conta do marketing, dizendo qual anúncio
              trouxe qual venda, e venda de indicação não tem nenhum destes campos. Misturado com quem a venda
              é, ele empurraria o que importa todo dia para o fim da ficha. */}
          <ProfileSection title="Origem e campanha">
            <ProfileFacts columns>
              <ProfileFact icon={MegaphoneIcon} label="Campanha">
                <Value>{opportunity.attribution?.campaign}</Value>
              </ProfileFact>
              <ProfileFact icon={TargetIcon} label="Conjunto de anúncios">
                <Value>{opportunity.attribution?.adSet}</Value>
              </ProfileFact>
              <ProfileFact icon={ImageSquareIcon} label="Anúncio">
                <Value>{opportunity.attribution?.ad}</Value>
              </ProfileFact>
              <ProfileFact icon={CursorClickIcon} label="GCLID">
                <Value mono>{opportunity.attribution?.gclid}</Value>
              </ProfileFact>
              <ProfileFact icon={CursorClickIcon} label="CTWACLID">
                <Value mono>{opportunity.attribution?.ctwaclid}</Value>
              </ProfileFact>
              <ProfileFact icon={CursorClickIcon} label="FBCLID">
                <Value mono>{opportunity.attribution?.fbclid}</Value>
              </ProfileFact>
              <ProfileFact icon={HashIcon} label="Source ID">
                <Value mono>{opportunity.attribution?.sourceId}</Value>
              </ProfileFact>
              <ProfileFact icon={HashIcon} label="Meta lead ID">
                <Value mono>{opportunity.attribution?.metaLeadId}</Value>
              </ProfileFact>
              <ProfileFact icon={LinkSimpleIcon} label="UTM source">
                <Value>{opportunity.attribution?.utm?.source}</Value>
              </ProfileFact>
              <ProfileFact icon={LinkSimpleIcon} label="UTM medium">
                <Value>{opportunity.attribution?.utm?.medium}</Value>
              </ProfileFact>
              <ProfileFact icon={LinkSimpleIcon} label="UTM campaign">
                <Value>{opportunity.attribution?.utm?.campaign}</Value>
              </ProfileFact>
              <ProfileFact icon={LinkSimpleIcon} label="UTM content">
                <Value>{opportunity.attribution?.utm?.content}</Value>
              </ProfileFact>
              <ProfileFact icon={LinkSimpleIcon} label="UTM term">
                <Value>{opportunity.attribution?.utm?.term}</Value>
              </ProfileFact>
              <ProfileFact icon={GlobeSimpleIcon} label="URL de origem">
                {opportunity.attribution?.sourceUrl ? (
                  <a className={styles.external} href={opportunity.attribution.sourceUrl} target="_blank" rel="noreferrer">
                    {opportunity.attribution.sourceUrl}
                  </a>
                ) : (
                  <Value />
                )}
              </ProfileFact>
              {/* O endereço desta venda na aplicação, com o botão que copia: é o que se manda para alguém
                  abrir o mesmo cartão, e digitar à mão um endereço com parâmetro é pedir erro. */}
              <ProfileFact icon={LinkSimpleIcon} label="Link deste card">
                <span className={styles.link}>
                  <span className={styles.linkText}>{link}</span>
                  <IconButton label="Copiar o link deste card" variant="ghost" size="sm" onClick={() => void copyLink()}>
                    <CopySimpleIcon />
                  </IconButton>
                </span>
              </ProfileFact>
            </ProfileFacts>
          </ProfileSection>

          {opportunity.tags.length > 0 && (
            <ProfileSection title="Etiquetas">
              <ProfileTags>
                {opportunity.tags.map((tag) => (
                  <Badge key={tag} size="md" variant="outline">
                    {tag}
                  </Badge>
                ))}
              </ProfileTags>
            </ProfileSection>
          )}

          {/* O orçamento que saiu daqui, quando já saiu: é o vínculo que liga a venda ao resto do sistema, e
              o caminho de volta para o documento sem procurar na lista. */}
          <ProfileSection title="Orçamento">
            {opportunity.quote ? (
              <ProfileList>
                <ProfileRow
                  href={`/orcamentos/${opportunity.quote.id}` as Route}
                  icon={ReceiptIcon}
                  title={opportunity.quote.reference}
                  caption={formatMoney(opportunity.value)}
                />
              </ProfileList>
            ) : (
              <Text as="p" variant="footnote" tone="tertiary">
                Nenhum orçamento saiu desta oportunidade ainda.
              </Text>
            )}
          </ProfileSection>
        </section>

        {/* A metade do caminho: onde a venda está no funil e quem cuida dela. */}
        <aside className={styles.side} aria-label="Caminho no funil">
          <ProfileSection title="Caminho no funil" aside={<Text as="span" variant="caption1" tone="tertiary">{at + 1} de {stages.length}</Text>}>
            <ol className={styles.path}>
              {stages.map((id, index) => {
                const meta = crmStageMeta[id];
                const StepGlyph = meta.icon;
                const done = index < at;
                const current = id === opportunity.stage;
                return (
                  <li key={id} className={styles.pathItem} style={{ "--stage-hue": meta.hue } as CSSProperties}>
                    <button
                      type="button"
                      className={styles.pathStep}
                      data-done={done || undefined}
                      data-current={current || undefined}
                      aria-current={current ? "step" : undefined}
                      onClick={() => onStageChange?.(id)}
                      {...squircle("md")}
                    >
                      <span className={styles.pathGlyph} aria-hidden="true">
                        {done ? <CheckIcon weight="bold" /> : <StepGlyph weight="bold" />}
                      </span>
                      <Text as="span" variant="subheadline" weight={current ? "semibold" : "regular"} truncate>
                        {meta.label}
                      </Text>
                    </button>
                  </li>
                );
              })}
            </ol>
          </ProfileSection>

          <ProfileSection title="Equipe">
            <ProfileList>
              {people.map((person) => (
                <li key={person.name} className={styles.person}>
                  <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="sm" />
                  <div className={styles.personText}>
                    <Text as="p" variant="subheadline" weight="medium" truncate>
                      {person.name}
                    </Text>
                    <Text as="p" variant="caption1" tone="tertiary">
                      {person.name === opportunity.owner.name ? "Responsável" : "Envolvido"}
                    </Text>
                  </div>
                </li>
              ))}
            </ProfileList>
          </ProfileSection>

          <ProfileSection title="Venda">
            <ProfileFacts columns>
              <ProfileFact icon={CurrencyCircleDollarIcon} label="Valor cheio">
                {formatMoney(opportunity.value)}
              </ProfileFact>
              <ProfileFact icon={ClockCounterClockwiseIcon} label="Histórico">
                {opportunity.activity === 1 ? "1 registro" : `${opportunity.activity} registros`}
              </ProfileFact>
              <ProfileFact icon={PaperclipIcon} label="Anexos">
                {opportunity.attachments === 1 ? "1 arquivo" : `${opportunity.attachments} arquivos`}
              </ProfileFact>
            </ProfileFacts>
          </ProfileSection>
        </aside>
      </div>
    </div>
  );
}
