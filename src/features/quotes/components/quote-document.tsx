import { CalendarBlankIcon, EnvelopeSimpleIcon, MapPinIcon, PhoneIcon, SealCheckIcon } from "@phosphor-icons/react/ssr";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { CSSProperties, ReactNode } from "react";
import { AnimatedMoney } from "@/components/ui/animated-number";
import { Avatar, avatarHue } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Text } from "@/components/ui/text";
import { CatalogArtwork } from "@/features/catalog/components/catalog-artwork";
import { catalogHueFor } from "@/features/catalog/list-options";
import type { CatalogUnit } from "@/features/catalog/summary";
import { squircle } from "@/lib/corners";
import { applyPattern } from "@/lib/masks";
import { siteConfig } from "@/lib/metadata";
import { cx } from "@/lib/utils/cx";
import { formatMoney } from "@/lib/utils/format";
import { paymentBrandLogos, paymentMethods } from "../labels";
import type { Quote, QuoteLine } from "../summary";
import { isCourtesy, lineTotal, quoteTotals } from "../totals";
import { QuoteSignature } from "./quote-signature";
import styles from "./quote-document.module.css";

export type QuoteDocumentProps = {
  quote: Quote;
  /** `page` é o documento público, no tamanho de folha; `preview` é a folha reduzida do editor. */
  variant?: "page" | "preview";
  /** O que fecha o documento no público: os botões de aprovar e recusar. No editor não há. */
  actions?: ReactNode;
  className?: string;
};

const longDate = (iso: string) => format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR });

/* A unidade encurtada para caber ao lado do valor, como a pessoa fala: "R$ 2.500,00 /prj". */
const unitShort: Record<CatalogUnit, string> = {
  project: "/prj",
  hour: "/h",
  month: "/mês",
  unit: "/un",
};

const countFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/* A arte do item na linha: a mesma do catálogo, porque o matiz nasce do nome em `catalogHueFor`, então o
   mesmo item desenha igual nas duas telas. A linha do orçamento não guarda foto, então vale a arte gerada.
   Exportada porque a tabela da lista mostra as mesmas artes na coluna de itens (2026-09-10). */
export const lineArtwork = (line: QuoteLine) => ({
  id: line.catalogItemId ?? line.id,
  name: line.name,
  imageUrl: null,
  hue: catalogHueFor(line.name),
});

// O documento do orçamento, o que o cliente recebe pelo link e o que o editor mostra em prévia (2026-09-09,
// sobre uma referência de fatura do usuário). É um só componente nas duas telas, para o que a pessoa vê ao
// montar ser exatamente o que o cliente recebe. Uma folha no fundo da casa, com a aura de cor nas quatro
// quinas no matiz da equipe, a logo dela, e tudo o que um orçamento diz: número, emissão e validade; para
// quem e quem vende; as linhas em tabela compacta, com a arte do item, quantidade, unitário com a unidade e
// total, e a etiqueta de cortesia no que é brinde; formas de pagamento, parcelas e a oferta de à vista, ao
// lado dos totais; observações; o espaço centralizado para o vendedor assinar; e o selo discreto de que a
// Specular gerou o documento, com o endereço onde conferir e as marcas dos meios de pagamento. Sem `use client`: o público monta no servidor e o
// editor o embute pronto. A folha é uma ilha de tema claro (`data-scheme="light"`), porque papel é branco em
// qualquer tema, e a impressão vira uma folha A4 de verdade.
export function QuoteDocument({ quote, variant = "page", actions, className }: QuoteDocumentProps) {
  const totals = quoteTotals(quote);
  const hue = avatarHue(quote.issuer.name);
  const methods = quote.paymentMethods.length > 0 ? quote.paymentMethods : (["pix"] as const);
  /* O endereço de conferência sai curto, sem o token: a frase do selo fica numa linha só, e quem está com o
     documento na mão já tem o link inteiro na barra do navegador. */
  const verifyUrl = `${siteConfig.url.replace(/^https?:\/\//i, "")}/orcamento`;

  /* A oferta de quem paga de uma vez, na linha miúda embaixo do total. */
  const cashLine = quote.cashDiscount > 0 ? `À vista com ${quote.cashDiscount}% de desconto, por ${formatMoney(totals.cash)}` : null;

  return (
    <article
      className={cx(styles.sheet, className)}
      data-scheme="light"
      data-variant={variant}
      style={{ "--doc-hue": `var(--sys-${hue})` } as CSSProperties}
      {...squircle("lg", { clip: true })}
    >
      {/* A aura: quatro bolas de cor sangrando pelas quinas da folha, na receita do painel de planos. */}
      <div className={styles.aura} aria-hidden="true" />

      <header className={styles.masthead}>
        <div className={styles.brand}>
          <Avatar name={quote.issuer.name} src={quote.issuer.logoUrl ?? undefined} size="lg" shape="squircle" className={styles.logo} />
          <div className={styles.brandCopy}>
            <Text as="p" variant="title3" weight="semibold" truncate>
              {quote.issuer.name}
            </Text>
            {/* Só e-mail e telefone (a pedido, 2026-09-09): é por onde o cliente responde, e o site já está
                no rodapé do documento. */}
            <ul className={styles.contacts} aria-label="Contatos da equipe">
              {quote.issuer.email && (
                <li>
                  <EnvelopeSimpleIcon aria-hidden="true" />
                  <span>{quote.issuer.email}</span>
                </li>
              )}
              {quote.issuer.phone && (
                <li>
                  <PhoneIcon aria-hidden="true" />
                  <span>{applyPattern("phone", quote.issuer.phone)}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className={styles.kicker}>
          <Text as="span" variant="caption1" weight="semibold" tone="secondary" className={styles.eyebrow}>
            Orçamento
          </Text>
          {/* A situação do orçamento não entra no documento (a pedido, 2026-09-10): rascunho, enviado ou
              visto é régua de dentro da casa, e para quem recebe não quer dizer nada. Ela vive na tabela e
              na ficha, que são telas de quem vende. */}
          <Text as="p" variant="title2" weight="semibold" className={styles.number}>
            {quote.number}
          </Text>
        </div>
      </header>

      <section className={styles.intro} aria-labelledby={`${quote.id}-title`}>
        <Text as="h1" id={`${quote.id}-title`} variant="title1" weight="semibold" className={styles.title}>
          {quote.title}
        </Text>
        {/* Emissão e validade; quem vende fica só no cartão de vendedor, para não repetir (2026-09-09). */}
        <dl className={styles.facts}>
          <div>
            <dt>
              <CalendarBlankIcon aria-hidden="true" />
              Emitido em
            </dt>
            <dd>{longDate(quote.issuedAt)}</dd>
          </div>
          <div>
            <dt>
              <CalendarBlankIcon aria-hidden="true" />
              Válido até
            </dt>
            <dd>{quote.validUntil ? longDate(quote.validUntil) : "Sem prazo"}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.parties} aria-label="Partes">
        <div className={styles.party}>
          <Text as="h2" variant="caption1" weight="semibold" tone="secondary" className={styles.eyebrow}>
            Cliente
          </Text>
          <div className={styles.person}>
            <Avatar name={quote.client.name} src={quote.client.avatarUrl ?? undefined} size="sm" shape="squircle" />
            <div className={styles.personCopy}>
              <Text as="p" variant="headline" weight="semibold" truncate>
                {quote.client.company ?? quote.client.name}
              </Text>
              {quote.client.company && (
                <Text as="p" variant="footnote" tone="secondary" truncate>
                  {quote.client.name}
                </Text>
              )}
            </div>
          </div>
          <ul className={styles.details}>
            {quote.client.email && (
              <li>
                <EnvelopeSimpleIcon aria-hidden="true" />
                {quote.client.email}
              </li>
            )}
            {quote.client.phone && (
              <li>
                <PhoneIcon aria-hidden="true" />
                {applyPattern("phone", quote.client.phone)}
              </li>
            )}
            {quote.client.city && (
              <li>
                <MapPinIcon aria-hidden="true" />
                {quote.client.city}
              </li>
            )}
          </ul>
        </div>
        <div className={styles.party}>
          <Text as="h2" variant="caption1" weight="semibold" tone="secondary" className={styles.eyebrow}>
            Vendedor
          </Text>
          <div className={styles.person}>
            <Avatar name={quote.owner.name} src={quote.owner.avatarUrl ?? undefined} size="sm" shape="squircle" />
            <div className={styles.personCopy}>
              <Text as="p" variant="headline" weight="semibold" truncate>
                {quote.owner.name}
              </Text>
              <Text as="p" variant="footnote" tone="secondary" truncate>
                {quote.issuer.name}
              </Text>
            </div>
          </div>
          <ul className={styles.details}>
            {quote.issuer.email && (
              <li>
                <EnvelopeSimpleIcon aria-hidden="true" />
                {quote.issuer.email}
              </li>
            )}
            {quote.issuer.phone && (
              <li>
                <PhoneIcon aria-hidden="true" />
                {applyPattern("phone", quote.issuer.phone)}
              </li>
            )}
            {quote.issuer.city && (
              <li>
                <MapPinIcon aria-hidden="true" />
                {quote.issuer.city}
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* A tabela é a parte mais compacta do documento (pedido de 2026-09-09): a arte do item, o nome em
          medium com a descrição embaixo em legenda, a quantidade só no número e o unitário com a unidade. */}
      <section className={styles.items} aria-labelledby={`${quote.id}-items`}>
        <Text as="h2" id={`${quote.id}-items`} variant="caption1" weight="semibold" tone="secondary" className={styles.eyebrow}>
          Itens do orçamento
        </Text>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" className={styles.end}>
                Qtd.
              </th>
              <th scope="col" className={styles.end}>
                Unitário
              </th>
              <th scope="col" className={styles.end}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <span className={styles.line}>
                    <CatalogArtwork item={lineArtwork(line)} size="sm" className={styles.lineArt} />
                    <span className={styles.lineCopy}>
                      <span className={styles.lineName}>
                        {line.name}
                        {/* Cortesia comum em verde; a que vale só hoje em vermelho, porque ela é um prazo
                            correndo (pedido de 2026-09-09). */}
                        {isCourtesy(line) && (
                          <Badge tone={line.courtesy === "today" ? "danger" : "success"} size="sm" className={styles.courtesy}>
                            {line.courtesy === "today" ? "Cortesia hoje" : "Cortesia"}
                          </Badge>
                        )}
                      </span>
                      {line.description && <span className={styles.lineDescription}>{line.description}</span>}
                    </span>
                  </span>
                </td>
                <td className={styles.end}>{countFormat.format(line.quantity)}</td>
                <td className={styles.end}>
                  <span className={isCourtesy(line) ? styles.struck : undefined}>{formatMoney(line.unitPrice)}</span>
                  <span className={styles.per}>{unitShort[line.unit]}</span>
                </td>
                <td className={cx(styles.end, styles.strong)}>{isCourtesy(line) ? "Grátis" : <AnimatedMoney cents={lineTotal(line)} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.summary} aria-label="Pagamento e totais">
        <div className={styles.payment}>
          <Text as="h2" variant="caption1" weight="semibold" tone="secondary" className={styles.eyebrow}>
            Pagamento
          </Text>
          <dl className={styles.paymentFacts}>
            <div>
              <dt>{methods.length > 1 ? "Formas" : "Forma"}</dt>
              <dd>
                <span className={styles.methods}>{methods.map((value) => paymentMethods[value].label).join(", ")}</span>
              </dd>
            </div>
            <div>
              <dt>Parcelas</dt>
              <dd>
                {quote.installments > 1 ? (
                  <>
                    {quote.installments}x de <AnimatedMoney cents={totals.installment} />
                  </>
                ) : (
                  "À vista, em uma parcela"
                )}
              </dd>
            </div>
            {/* A oferta de à vista não muda o total: ela diz quanto sai pagando de uma vez. */}
            {quote.cashDiscount > 0 && (
              <div>
                <dt>À vista</dt>
                <dd>
                  {quote.cashDiscount}% de desconto, <AnimatedMoney cents={totals.cash} />
                </dd>
              </div>
            )}
          </dl>
        </div>
        <dl className={styles.totals}>
          <div>
            <dt>Subtotal</dt>
            <dd>
              <AnimatedMoney cents={totals.subtotal} />
            </dd>
          </div>
          {totals.courtesy > 0 && (
            <div>
              <dt>Cortesia inclusa</dt>
              <dd className={styles.negative}>
                <AnimatedMoney cents={totals.courtesy} />
              </dd>
            </div>
          )}
          {totals.discount > 0 && (
            <div>
              <dt>Desconto{quote.discount?.kind === "percent" ? ` de ${quote.discount.value}%` : ""}</dt>
              <dd className={styles.negative}>
                -<AnimatedMoney cents={totals.discount} />
              </dd>
            </div>
          )}
          {/* O total em destaque (pedido de 2026-09-09): parcelando, o número de vezes vem miúdo antes do
              valor da parcela, que é o número grande; à vista, o grande é o total. */}
          <div className={styles.grand}>
            <dt>Total</dt>
            <dd>
              {quote.installments > 1 && <span className={styles.times}>{quote.installments}x</span>}
              <AnimatedMoney cents={quote.installments > 1 ? totals.installment : totals.total} />
            </dd>
          </div>
          {cashLine && <span className={styles.terms}>{cashLine}</span>}
        </dl>
      </section>

      {quote.notes && (
        <section className={styles.notes} aria-label="Observações">
          <Text as="h2" variant="caption1" weight="semibold" tone="secondary" className={styles.eyebrow}>
            Observações
          </Text>
          <Text as="p" variant="footnote" tone="secondary">
            {quote.notes}
          </Text>
        </section>
      )}

      {/* A assinatura de quem responde pelo orçamento fecha o documento (2026-09-10, a pedido, no lugar da
          linha em branco que existia para assinar à mão): o rosto de quem vendeu com o registro ao lado. A
          data é a do envio, que é quando o documento saiu assinado; num rascunho ainda não há envio, então o
          registro não aparece. */}
      <QuoteSignature owner={quote.owner} signedAt={quote.sentAt} host={siteConfig.hosts.app} />

      {actions && <div className={styles.actions}>{actions}</div>}

      {/* O selo do rodapé (pedido de 2026-09-09): diz quem gerou o documento e onde conferir se ele é o
          original, discreto, no fim de tudo. O endereço é o do próprio link do cliente; num orçamento que
          ainda não tem link, fica o endereço da casa. */}
      <footer>
        <div className={styles.seal}>
          <SealCheckIcon aria-hidden="true" />
          <Text as="p" variant="caption2" tone="tertiary">
            Documento gerado pela Specular. Confira a autenticidade em {verifyUrl}
          </Text>
        </div>
        {/* As marcas dos meios de pagamento, em máscara monocromática e apagadas: nome sem arquivo em
            `public/brands` simplesmente não desenha, então a fila cresce conforme as marcas entram. */}
        <div className={styles.brands} aria-hidden="true">
          {paymentBrandLogos.map((brand) => (
            <BrandIcon key={brand} name={brand} className={styles.paymentBrand} />
          ))}
        </div>
      </footer>
    </article>
  );
}
