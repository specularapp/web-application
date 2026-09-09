"use client";

import {
  ArrowsClockwiseIcon,
  BellRingingIcon,
  CoinsIcon,
  PackageIcon,
  PercentIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  TagIcon,
  TimerIcon,
  TrendUpIcon,
  WalletIcon,
  XIcon,
} from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { TextLink } from "@/components/ui/link";
import { ProfileFact, ProfileFacts, ProfileList, ProfileRow, ProfileSection, ProfileTags } from "@/components/ui/profile";
import { Text, type TextTone } from "@/components/ui/text";
import { quoteStatuses } from "@/features/quotes/labels";
import { formatMoney } from "@/lib/utils/format";
import { kindLabels, kindTones, readStock, unitLabels } from "../list-options";
import type { CatalogItem } from "../summary";
import { CatalogArtwork } from "./catalog-artwork";
import { CatalogMenu } from "./catalog-menu";
import styles from "./catalog-drawer.module.css";

export type CatalogDrawerProps = {
  /** O item aberto; nulo mantém a gaveta montada e fechada, para a saída animar. */
  item: CatalogItem | null;
  active: boolean;
  onActiveChange: (active: boolean) => void;
  onClose: () => void;
  /** Abre a gaveta de edição no lugar da ficha. */
  onEdit: () => void;
};

const longDate = (iso: string) => format(parseISO(iso), "d 'de' MMM. 'de' yyyy", { locale: ptBR });
const shortDate = (iso: string) => format(parseISO(iso), "d MMM. yyyy", { locale: ptBR });

const durationLabel = ({ min, max }: { min: number; max: number }) => (min === max ? `${min} dias` : `${min} a ${max} dias`);

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const units = (count: number) => (count === 1 ? "1 unidade" : `${count} unidades`);

// A ficha do item na gaveta lateral, na moldura da ficha do cliente: o cabeçalho preso com o nome, o leque e
// o fechar; a identidade com a arte, o nome com as etiquetas e a categoria (sem ação na ponta: gerar orçamento
// vive no leque, a pedido); e as seções empilhadas nos primitivos do perfil. O centro é a grade de preço e condições, em duas colunas com
// rótulo em cima e valor embaixo, cada fato numa linha só e em poucas palavras: é a tela que faz o orçamento
// sair certo, então o que importa se lê de uma vez, sem azulejo, sem lista de escopo e sem pular linha.
export function CatalogDrawer({ item, active, onActiveChange, onClose, onEdit }: CatalogDrawerProps) {
  const stock = item ? readStock(item) : null;

  return (
    <Dialog
      open={Boolean(item)}
      onClose={onClose}
      label={item ? `Ficha de ${item.name}` : "Ficha do item"}
      size="lg"
      placement="end"
      surface="page"
      scrim={false}
      focusOnOpen={false}
    >
      {item && (
        <>
          <header className={styles.head}>
            <div className={styles.heading}>
              <Text as="h2" variant="title3" weight="semibold" truncate>
                {item.name}
              </Text>
              <Text variant="caption1" tone="secondary" truncate className={styles.since}>
                {item.reference}, por {item.createdBy} desde {longDate(item.createdAt)}
              </Text>
            </div>
            <div className={styles.headActions}>
              <CatalogMenu item={item} active={active} onActiveChange={onActiveChange} onEdit={onEdit} />
              <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
                <XIcon />
              </IconButton>
            </div>
          </header>

          <div className={styles.body}>
            <section className={styles.identity}>
              <CatalogArtwork item={item} size="lg" />
              <div className={styles.who}>
                <div className={styles.naming}>
                  <Text as="p" variant="headline" weight="semibold" truncate>
                    {item.name}
                  </Text>
                  <Badge tone={active ? "success" : "neutral"} size="sm">
                    {active ? "Ativo" : "Inativo"}
                  </Badge>
                  <Badge tone={kindTones[item.kind]} size="sm">
                    {kindLabels[item.kind]}
                  </Badge>
                </div>
                <Text variant="footnote" tone="secondary" truncate>
                  {item.category}
                </Text>
              </div>
            </section>

            <div className={styles.sections}>
              <ProfileSection title="Sobre">
                <Text variant="callout" tone="secondary">
                  {item.description}
                </Text>
              </ProfileSection>

              {/* A grade 2x: rótulo curto em cima, valor curto embaixo, oito fatos em quatro linhas. Produto
                  troca prazo e revisões por estoque e aviso; o resto é igual para os dois. */}
              <ProfileSection title="Preço e condições">
                <div className={styles.grid}>
                  <ProfileFacts>
                    <Fact icon={TagIcon} label="Preço">
                      {formatMoney(item.price)}
                    </Fact>
                    <Fact icon={WalletIcon} label="Cobrança">
                      {unitLabels[item.unit]}
                    </Fact>
                    <Fact icon={CoinsIcon} label="Custo">
                      {item.cost === null ? "Não medido" : formatMoney(item.cost)}
                    </Fact>
                    <Fact icon={TrendUpIcon} label="Margem">
                      {item.cost === null ? "Sem custo" : `${percent(item.price - item.cost, item.price)}%`}
                    </Fact>
                    <Fact icon={PercentIcon} label="Desconto">
                      até {item.maxDiscount}%
                    </Fact>
                    <Fact icon={ShieldCheckIcon} label="Garantia">
                      {item.supportDays === null ? "Não há" : `${item.supportDays} dias`}
                    </Fact>
                    {stock ? (
                      <>
                        <Fact icon={PackageIcon} label="Estoque" tone={stock.tone === "neutral" ? "default" : stock.tone}>
                          {stock.quantity === null || !item.stock ? "Sob demanda" : `${stock.quantity} de ${units(item.stock.capacity)}`}
                        </Fact>
                        <Fact icon={BellRingingIcon} label="Aviso">
                          {item.stock ? `abaixo de ${units(item.stock.minimum)}` : "Não há"}
                        </Fact>
                      </>
                    ) : (
                      <>
                        <Fact icon={TimerIcon} label="Prazo">
                          {item.duration ? durationLabel(item.duration) : "A combinar"}
                        </Fact>
                        <Fact icon={ArrowsClockwiseIcon} label="Revisões">
                          {item.revisions === undefined ? "Não há" : item.revisions === 1 ? "1 rodada" : `${item.revisions} rodadas`}
                        </Fact>
                      </>
                    )}
                  </ProfileFacts>
                </div>
              </ProfileSection>

              <ProfileSection
                title="Orçamentos recentes"
                aside={
                  item.quotes.length > 0 ? (
                    <span className={styles.aside}>
                      <Text as="span" variant="caption1" tone="tertiary">
                        {item.stats.quotes} no total, {percent(item.stats.approved, item.stats.quotes)}% aprovados
                      </Text>
                      <TextLink href={`/orcamentos?item=${item.id}` as Route} className={styles.more}>
                        Ver todos
                      </TextLink>
                    </span>
                  ) : undefined
                }
              >
                {item.quotes.length === 0 ? (
                  <Text variant="footnote" tone="secondary">
                    Este item ainda não entrou em nenhum orçamento
                  </Text>
                ) : (
                  <ProfileList>
                    {item.quotes.map((quote) => {
                      const status = quoteStatuses[quote.status];
                      return (
                        <ProfileRow
                          key={quote.id}
                          href={`/orcamentos/${quote.id}` as Route}
                          icon={ReceiptIcon}
                          title={quote.client}
                          caption={`${quote.number}, ${shortDate(quote.date)}`}
                          end={
                            <>
                              <Text as="span" variant="subheadline" weight="semibold">
                                {formatMoney(quote.amount)}
                              </Text>
                              <Badge tone={status.tone} size="sm" icon={<status.icon />}>
                                {status.label}
                              </Badge>
                            </>
                          }
                        />
                      );
                    })}
                  </ProfileList>
                )}
              </ProfileSection>

              {item.tags.length > 0 && (
                <ProfileSection title="Etiquetas">
                  <ProfileTags>
                    {item.tags.map((tag) => (
                      <Badge key={tag} size="md">
                        {tag}
                      </Badge>
                    ))}
                  </ProfileTags>
                </ProfileSection>
              )}

              {item.notes && (
                <ProfileSection
                  title="Anotações da equipe"
                  aside={
                    <Text as="span" variant="caption1" tone="tertiary">
                      Atualizado em {shortDate(item.updatedAt)}
                    </Text>
                  }
                >
                  <Text variant="callout" tone="secondary">
                    {item.notes}
                  </Text>
                </ProfileSection>
              )}
            </div>
          </div>
        </>
      )}
    </Dialog>
  );
}

/* Um fato da grade: o valor numa linha só, em subheadline medium e algarismos tabulares. O tom entra só
   quando o valor é um estado, como o estoque baixo em laranja. */
function Fact({ icon, label, tone = "default", children }: { icon: typeof TagIcon; label: string; tone?: TextTone; children: ReactNode }) {
  return (
    <ProfileFact icon={icon} label={label}>
      <Text as="span" variant="subheadline" weight="medium" tone={tone} truncate>
        {children}
      </Text>
    </ProfileFact>
  );
}
