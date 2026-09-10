/* A imagem do react-pdf entra como `Picture`: com o nome `Image` a regra de acessibilidade a confunde com a
   imagem do Next e pede texto alternativo, que não existe no desenho de PDF. */
import { Document, Defs, Image as Picture, Page, Path, RadialGradient, Rect, Stop, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { ComponentProps, ReactNode } from "react";
import { avatarHue } from "@/components/ui/avatar";
import type { BadgeTone } from "@/components/ui/badge";
import { catalogHueFor } from "@/features/catalog/list-options";
import type { CatalogUnit } from "@/features/catalog/summary";
import { cornerRadius } from "@/lib/corners";
import { applyPattern } from "@/lib/masks";
import { siteConfig } from "@/lib/metadata";
import { auraCorners, sysHues, withAlpha, type SysHue } from "@/lib/palette";
import { formatMoney } from "@/lib/utils/format";
import { paymentBrandLogos, paymentMethods } from "./labels";
import { pdfBrands, pdfIcons } from "./pdf-glyphs";
import { LOGO_RING, SIGNATURE_SEAL, type QuotePdfImages } from "./pdf-images";
import { signatureStamp } from "./signature";
import { badgeTone, brandOpacity, CONTENT_WIDTH, glyphInk, glyphOpacity, hairline, ink, leading, oneLine, PAGE_HEIGHT, PAGE_WIDTH, pt, space, text, tracking, type, weight } from "./pdf-theme";
import type { Quote, QuoteLine } from "./summary";
import { isCourtesy, lineTotal, quoteTotals } from "./totals";

/**
 * O documento do orçamento em PDF: a mesma folha de `quote-document.tsx`, desenhada onde não há CSS.
 *
 * Existe porque o cliente clica uma vez e o arquivo desce, sem a janela de impressão do navegador no meio.
 * É a escolha registrada em `docs/libs.md` para exportar PDF, e o desenho é o mesmo por construção: as
 * medidas saem dos tokens da casa reduzidas pela razão entre a folha da tela e o A4 (`pdf-theme.ts`), os
 * rostos e as artes são os mesmos que a tela desenha, rasterizados em `pdf-images.ts`, e os glifos e as
 * marcas são os mesmos arquivos, traçados em `pdf-glyphs.ts`.
 *
 * O que o papel não tem: a animação de contagem dos totais, que aqui é o número parado, e o canto macio da
 * folha, que a impressão do navegador também descarta. O resto é a folha.
 */

export type QuotePdfDocumentProps = { quote: Quote; images: QuotePdfImages };

/** O estilo como o react-pdf o aceita, tirado do próprio componente para não depender do pacote de tipos dele. */
type PdfStyle = ComponentProps<typeof View>["style"];

const longDate = (iso: string) => format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR });

/* A unidade encurtada ao lado do valor, como na tela: "R$ 2.500,00 /prj". */
const unitShort: Record<CatalogUnit, string> = { project: "/prj", hour: "/h", month: "/mês", unit: "/un" };

const countFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/* As colunas de número, em pixels, as mesmas que `quote-document.module.css` declara na tabela da tela.
   Declaradas, e não medidas pelo conteúdo (acerto de 2026-09-10): na tela a tabela dá a cada coluna a
   largura do que há dentro dela, o que muda de orçamento para orçamento e nunca bate com uma largura fixa
   no PDF, e num valor mais largo a unidade caía para a linha de baixo. Com o mesmo número dos dois lados,
   as colunas ficam no mesmo lugar em qualquer orçamento. A folga cabe "R$ 120.000,00 /mês" sem quebrar; a
   primeira coluna fica com o que sobrar, que é o que o nome do item pede. */
const COLUMN = { count: pt(56), unit: pt(136), total: pt(104) };

/* As larguras dos blocos, todas tiradas da largura útil da folha, como o CSS faz: a coluna do nome é o que
   sobra das de número; a caixa do nome e da descrição é a coluna menos o azulejo, o vão e o recuo da célula;
   os cartões das partes dividem a folha ao meio com o vão entre eles; o pagamento é o que sobra da coluna de
   totais; e o número do orçamento tem a sua, para o nome da equipe ficar com o resto. */
const NAME_COLUMN = pt(CONTENT_WIDTH - 56 - 136 - 104);
const LINE_COPY = pt(CONTENT_WIDTH - 56 - 136 - 104 - 32 - 8 - 12);
const PARTY = pt((CONTENT_WIDTH - 16) / 2);
const TOTALS = pt(288);
const PAYMENT = pt(CONTENT_WIDTH - 24 - 288);
const KICKER = pt(176);
const BRAND = pt(CONTENT_WIDTH - 20 - 176);

/* Quanto o glifo sobe ao lado de um rótulo, em fração do tamanho da letra: é o que faz o meio do desenho
   cair no meio das maiúsculas em vez de no meio da linha. Medido com as duas folhas lado a lado. */
const GLYPH_RISE = 0.075;

/** A entrelinha da etiqueta compacta, a mesma do CSS da linha do item. */
const BADGE_LEADING = 1.4;

const styles = StyleSheet.create({
  page: { backgroundColor: ink.sheet, color: ink.label, fontFamily: "Inter", ...text(type.footnote) },
  /* O recuo soma o fio da moldura da tela: na prévia a folha tem borda, e o conteúdo dela começa um fio
     depois do recuo. Somando aqui, o PDF sai sem moldura (como na impressão) e com o conteúdo no mesmo
     lugar, então a caixa de texto é a mesma nos dois e nada desloca de um para o outro. */
  sheet: { flexGrow: 1, padding: space.s8 + hairline, gap: space.s5 },

  masthead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.s5 },
  brand: { width: BRAND, flexDirection: "row", alignItems: "center", gap: space.s4, minWidth: 0 },
  /* A logo tem o anel do fundo da folha desenhado no próprio arquivo, então a margem negativa devolve o
     espaço dele: na tela o anel é sombra e não ocupa lugar. */
  logo: { width: pt(52 + LOGO_RING * 2), height: pt(52 + LOGO_RING * 2), margin: pt(-LOGO_RING) },
  brandCopy: { flexShrink: 1, minWidth: 0, gap: space.s1 },
  issuerName: { ...text(type.title3, leading.tight), fontWeight: weight.semibold, letterSpacing: type.title3 * tracking.tighter, ...oneLine },
  contacts: { flexDirection: "row", columnGap: space.s3, minWidth: 0 },
  kicker: { width: KICKER, alignItems: "flex-end", gap: space.s1 },
  eyebrow: { ...text(type.caption1), fontWeight: weight.semibold, color: ink.secondary, letterSpacing: type.caption1 * tracking.wide, textTransform: "uppercase" },
  number: { ...text(type.title2, leading.tight), fontWeight: weight.semibold, letterSpacing: type.title2 * tracking.tight },

  intro: { gap: space.s4 },
  title: { maxWidth: pt(576), ...text(type.title1, leading.tight), fontWeight: weight.semibold, letterSpacing: type.title1 * tracking.tightest },
  facts: { flexDirection: "row", flexWrap: "wrap", rowGap: space.s3, columnGap: space.s8 },
  fact: { gap: space.half },
  factValue: { ...text(type.subheadline), fontWeight: weight.medium },

  parties: { flexDirection: "row", gap: space.s4 },
  party: { width: PARTY, gap: space.s3, padding: space.s4, backgroundColor: ink.card, borderRadius: pt(cornerRadius.lg) },
  person: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  personAvatar: { width: pt(36), height: pt(36) },
  personCopy: { flexShrink: 1, minWidth: 0 },
  personName: { ...text(type.headline), fontWeight: weight.semibold, letterSpacing: type.headline * tracking.tighter, ...oneLine },
  personMeta: { ...text(type.footnote), color: ink.secondary, letterSpacing: type.footnote * tracking.tight, ...oneLine },
  details: { flexDirection: "row", flexWrap: "wrap", rowGap: space.s1, columnGap: space.s3 },
  detail: { flexDirection: "row", alignItems: "center", gap: space.s1, minWidth: 0 },

  items: { gap: space.s2 },
  head: { flexDirection: "row", alignItems: "flex-end", borderBottomWidth: hairline, borderBottomColor: ink.border },
  headCell: { paddingVertical: space.s1, paddingHorizontal: space.s3, ...text(type.caption1), fontWeight: weight.medium, color: ink.secondary },
  row: { flexDirection: "row", alignItems: "flex-start", borderBottomWidth: hairline, borderBottomColor: ink.border },
  cell: { paddingVertical: space.s1 + space.half, paddingHorizontal: space.s3, ...text(type.footnote) },
  first: { width: NAME_COLUMN, paddingLeft: 0 },
  last: { paddingRight: 0 },
  end: { textAlign: "right" },
  line: { flexDirection: "row", alignItems: "center", gap: space.s2, minWidth: 0 },
  lineArt: { width: pt(32), height: pt(32), alignItems: "center", justifyContent: "center", borderRadius: pt(cornerRadius.sm) },
  lineArtImage: { width: pt(22), height: pt(22) },
  lineCopy: { width: LINE_COPY },
  lineName: { flexDirection: "row", alignItems: "center", gap: space.s2, minWidth: 0 },
  lineTitle: { flexShrink: 1, minWidth: 0, ...text(type.footnote), fontWeight: weight.medium, ...oneLine },
  lineDescription: { ...text(type.caption1), color: ink.secondary, ...oneLine },
  per: { fontSize: type.caption2, color: ink.tertiary },
  strong: { fontWeight: weight.semibold },
  struck: { textDecoration: "line-through", textDecorationColor: ink.tertiary },

  summary: { flexDirection: "row", gap: space.s6, alignItems: "flex-start" },
  payment: { width: PAYMENT, gap: space.s2 },
  paymentFacts: { gap: space.s1 },
  paymentFact: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  /* Rótulo e valor no mesmo trilho, o que na tela é a grade compartilhada por subgrid, com a largura que a
     tela resolve para o rótulo mais largo. */
  paymentLabel: { width: pt(48.56), ...text(type.caption1), color: ink.secondary },
  paymentValue: { flexShrink: 1, minWidth: 0, ...text(type.subheadline), fontWeight: weight.medium },
  totals: { width: TOTALS, gap: space.s2 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", gap: space.s4 },
  totalLabel: { ...text(type.subheadline), color: ink.secondary },
  totalValue: { ...text(type.subheadline), fontWeight: weight.medium },
  negative: { color: ink.secondary },
  grand: { paddingTop: space.s2, borderTopWidth: hairline, borderTopColor: ink.border },
  grandLabel: { ...text(type.subheadline), fontWeight: weight.semibold, color: ink.label },
  /* O total é um texto só, com o número de vezes miúdo dentro dele: em texto encaixado o react-pdf assenta
     os dois na mesma linha de base, que é o que a tela faz com alinhamento pela base. Em caixas lado a lado
     o miúdo subia para o topo do valor (relato de 2026-09-09). */
  grandValue: { ...text(type.title3), fontWeight: weight.semibold, letterSpacing: type.title3 * tracking.tight, textAlign: "right" },
  times: { ...text(type.footnote), fontWeight: weight.medium, color: ink.secondary, letterSpacing: type.footnote * tracking.tight },
  terms: { ...text(type.caption1), color: ink.secondary, textAlign: "right" },

  notes: { gap: space.s1, paddingTop: space.s4, borderTopWidth: hairline, borderTopColor: ink.border },
  notesBody: { ...text(type.footnote), color: ink.secondary, letterSpacing: type.footnote * tracking.tight },

  /* A assinatura de quem responde (2026-09-10): o selo em círculo e o registro ao lado, centrados na folha,
     com 4px até o fio que vem depois. A linha em branco para assinar à mão saiu com ela, e a versão escrita
     na Sacramento durou uma rodada e saiu no mesmo dia. */
  signature: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s4, paddingTop: space.s6, paddingBottom: space.s1, marginTop: "auto" },
  signatureRegistry: { gap: space.half, flexShrink: 1 },
  signatureSeal: { width: pt(SIGNATURE_SEAL), height: pt(SIGNATURE_SEAL) },
  signatureNote: { ...text(type.subheadline), color: ink.secondary, letterSpacing: type.subheadline * tracking.tight },
  /* A emissora se separa das três linhas de cima: elas dizem quem assinou, ela diz de onde o documento saiu. */
  signatureHost: { marginTop: space.s2 },
  /* O nome do registro em caixa alta: o react-pdf não tem `text-transform`, então quem escreve o texto o
     entrega já maiúsculo. */
  signatureName: { ...text(type.title3), fontWeight: weight.semibold, letterSpacing: type.title3 * 0.02 },

  seal: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s1, paddingTop: space.s4 },
  sealText: { ...text(type.caption2), color: ink.tertiary, letterSpacing: type.caption2 * tracking.tight },
  brands: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s3, paddingTop: space.s3 },
});

/** Um glifo do Phosphor traçado no tamanho e na cor pedidos: é o que substitui o componente de ícone. */
function Glyph({ paths, size, color = glyphInk, opacity = glyphOpacity.tertiary, box = 256, style }: { paths: readonly string[]; size: number; color?: string; opacity?: number; box?: number; style?: PdfStyle }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${box} ${box}`} style={style}>
      {paths.map((d) => (
        <Path key={d} d={d} fill={color} fillOpacity={opacity} />
      ))}
    </Svg>
  );
}

/**
 * A etiqueta da casa na variante suave, na medida compacta que a linha do item usa: a caixa é a altura de
 * linha da legenda mais o fio de um pixel de cada lado, que na tela vem da moldura transparente da etiqueta.
 * É a única etiqueta do documento, e essa medida é o que a mantém do mesmo tamanho na tela e no papel, sem
 * esticar a altura da linha do item (relato de 2026-09-10, sobre a de altura fixa, que era três pixels mais
 * alta que a da prévia).
 */
function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  const { ink: color, tint } = badgeTone(tone);
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        height: type.caption2 * BADGE_LEADING + pt(2),
        paddingHorizontal: space.s1,
        backgroundColor: tint,
        borderRadius: pt(cornerRadius.sm),
      }}
    >
      <Text style={{ ...text(type.caption2, BADGE_LEADING), fontWeight: weight.semibold, letterSpacing: type.caption2 * tracking.tight, color }}>{children}</Text>
    </View>
  );
}

/**
 * Rótulo com glifo à frente, o par que a tela repete nos contatos e nos fatos da emissão.
 *
 * O glifo sobe um tico: alinhado pelo centro da linha ele fica com o desenho inteiro abaixo da altura das
 * maiúsculas, o que se lê como desalinhado (relato de 2026-09-10). `GLYPH_RISE` é o quanto ele volta, em
 * fração do tamanho da letra, para o meio do desenho cair no meio das maiúsculas do rótulo. Vai em posição
 * relativa, e não em margem: margem entra na conta de quem centraliza e o empurrão sairia pela metade.
 */
function WithGlyph({ glyph, size = type.footnote, style, children }: { glyph: readonly string[]; size?: number; style?: PdfStyle; children: ReactNode }) {
  return (
    <View style={[styles.detail, style]}>
      <Glyph paths={glyph} size={pt(14)} style={{ position: "relative", top: -size * GLYPH_RISE }} />
      <Text style={{ flexShrink: 1, ...text(size), color: ink.secondary }}>{children}</Text>
    </View>
  );
}

/**
 * A aura: as quatro bolas de cor sangrando pelas quinas, na mesma receita do CSS. O quadro da aura passa 32
 * pontos de cada lado da folha, como o `inset` negativo do CSS, e o que sobra é cortado pela página, então
 * o centro de cada gradiente fica fora do papel e a cor entra pela quina em vez de virar mancha redonda.
 *
 * O gradiente do CSS é uma elipse de 60% por 40% do quadro; em SVG o gradiente é sempre circular, e a
 * `gradientTransform` achata o círculo até a elipse. A opacidade da camada (0,22) já vem multiplicada em
 * cada parada, porque aqui não há camada para receber opacidade.
 */
function Aura({ hue }: { hue: SysHue }) {
  const pad = space.s8;
  const width = PAGE_WIDTH + pad * 2;
  const height = PAGE_HEIGHT + pad * 2;
  const corners = auraCorners[hue];
  const spots = [
    { color: corners[0], cx: -pad, cy: -pad, rx: width * 0.6, ry: height * 0.4, alpha: 0.62 },
    { color: corners[1], cx: PAGE_WIDTH + pad, cy: -pad, rx: width * 0.52, ry: height * 0.34, alpha: 0.5 },
    { color: corners[2], cx: -pad, cy: PAGE_HEIGHT + pad, rx: width * 0.52, ry: height * 0.34, alpha: 0.4 },
    { color: corners[3], cx: PAGE_WIDTH + pad, cy: PAGE_HEIGHT + pad, rx: width * 0.6, ry: height * 0.4, alpha: 0.48 },
  ];

  return (
    <View fixed style={{ position: "absolute", top: 0, left: 0 }}>
      <Svg width={PAGE_WIDTH} height={PAGE_HEIGHT} viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}>
        <Defs>
          {spots.map((spot, index) => (
            <RadialGradient
              key={index}
              id={`aura-${index}`}
              gradientUnits="userSpaceOnUse"
              cx={spot.cx}
              cy={spot.cy}
              r={spot.rx}
              gradientTransform={`translate(0 ${spot.cy}) scale(1 ${spot.ry / spot.rx}) translate(0 ${-spot.cy})`}
            >
              <Stop offset="0" stopColor={spot.color} stopOpacity={spot.alpha * 0.22} />
              <Stop offset="0.64" stopColor={spot.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {spots.map((spot, index) => (
          <Rect key={index} x={0} y={0} width={PAGE_WIDTH} height={PAGE_HEIGHT} fill={`url(#aura-${index})`} />
        ))}
      </Svg>
    </View>
  );
}

/** O azulejo da linha do item: a arte solta sobre o véu do matiz do item, como no catálogo. */
function LineArt({ line, image }: { line: QuoteLine; image: QuotePdfImages["lines"][string] }) {
  const hue = catalogHueFor(line.name) as SysHue;
  return (
    <View style={[styles.lineArt, { backgroundColor: withAlpha(sysHues[hue], 0.12) }]}>{image && <Picture src={image} style={styles.lineArtImage} />}</View>
  );
}

export function QuotePdfDocument({ quote, images }: QuotePdfDocumentProps) {
  const totals = quoteTotals(quote);
  const hue = avatarHue(quote.issuer.name) as SysHue;
  const methods = quote.paymentMethods.length > 0 ? quote.paymentMethods : (["pix"] as const);
  const verifyUrl = `${siteConfig.url.replace(/^https?:\/\//i, "")}/orcamento`;
  const cashLine = quote.cashDiscount > 0 ? `À vista com ${quote.cashDiscount}% de desconto, por ${formatMoney(totals.cash)}` : null;
  /* O registro da assinatura é a data do envio: num rascunho ainda não houve envio, então ele não aparece. */
  const signedAt = quote.sentAt ? signatureStamp(quote.sentAt) : null;

  return (
    <Document title={`Orçamento ${quote.number}`} author={quote.issuer.name} subject={quote.title} creator="Specular" producer="Specular">
      <Page size="A4" style={styles.page}>
        <Aura hue={hue} />

        <View style={styles.sheet}>
          <View style={styles.masthead}>
            <View style={styles.brand}>
              <Picture src={images.issuer} style={styles.logo} />
              <View style={styles.brandCopy}>
                <Text style={styles.issuerName}>
                  {quote.issuer.name}
                </Text>
                <View style={styles.contacts}>
                  {quote.issuer.email && <WithGlyph glyph={pdfIcons.envelope}>{quote.issuer.email}</WithGlyph>}
                  {quote.issuer.phone && <WithGlyph glyph={pdfIcons.phone}>{applyPattern("phone", quote.issuer.phone)}</WithGlyph>}
                </View>
              </View>
            </View>
            <View style={styles.kicker}>
              <Text style={styles.eyebrow}>Orçamento</Text>
              <Text style={styles.number}>{quote.number}</Text>
            </View>
          </View>

          <View style={styles.intro}>
            <Text style={styles.title}>{quote.title}</Text>
            <View style={styles.facts}>
              <View style={styles.fact}>
                <WithGlyph glyph={pdfIcons.calendar} size={type.caption1}>
                  Emitido em
                </WithGlyph>
                <Text style={styles.factValue}>{longDate(quote.issuedAt)}</Text>
              </View>
              <View style={styles.fact}>
                <WithGlyph glyph={pdfIcons.calendar} size={type.caption1}>
                  Válido até
                </WithGlyph>
                <Text style={styles.factValue}>{quote.validUntil ? longDate(quote.validUntil) : "Sem prazo"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.parties}>
            <View style={styles.party}>
              <Text style={styles.eyebrow}>Cliente</Text>
              <View style={styles.person}>
                <Picture src={images.client} style={styles.personAvatar} />
                <View style={styles.personCopy}>
                  <Text style={styles.personName}>
                    {quote.client.company ?? quote.client.name}
                  </Text>
                  {quote.client.company && (
                    <Text style={styles.personMeta}>
                      {quote.client.name}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.details}>
                {quote.client.email && <WithGlyph glyph={pdfIcons.envelope}>{quote.client.email}</WithGlyph>}
                {quote.client.phone && <WithGlyph glyph={pdfIcons.phone}>{applyPattern("phone", quote.client.phone)}</WithGlyph>}
                {quote.client.city && <WithGlyph glyph={pdfIcons.pin}>{quote.client.city}</WithGlyph>}
              </View>
            </View>
            <View style={styles.party}>
              <Text style={styles.eyebrow}>Vendedor</Text>
              <View style={styles.person}>
                <Picture src={images.owner} style={styles.personAvatar} />
                <View style={styles.personCopy}>
                  <Text style={styles.personName}>
                    {quote.owner.name}
                  </Text>
                  <Text style={styles.personMeta}>
                    {quote.issuer.name}
                  </Text>
                </View>
              </View>
              <View style={styles.details}>
                {quote.issuer.email && <WithGlyph glyph={pdfIcons.envelope}>{quote.issuer.email}</WithGlyph>}
                {quote.issuer.phone && <WithGlyph glyph={pdfIcons.phone}>{applyPattern("phone", quote.issuer.phone)}</WithGlyph>}
                {quote.issuer.city && <WithGlyph glyph={pdfIcons.pin}>{quote.issuer.city}</WithGlyph>}
              </View>
            </View>
          </View>

          <View style={styles.items}>
            <Text style={styles.eyebrow}>Itens do orçamento</Text>
            <View>
              <View style={styles.head}>
                <Text style={[styles.headCell, styles.first]}>Item</Text>
                <Text style={[styles.headCell, styles.end, { width: COLUMN.count }]}>Qtd.</Text>
                <Text style={[styles.headCell, styles.end, { width: COLUMN.unit }]}>Unitário</Text>
                <Text style={[styles.headCell, styles.end, styles.last, { width: COLUMN.total }]}>Total</Text>
              </View>
              {quote.lines.map((line) => (
                <View key={line.id} style={styles.row} wrap={false}>
                  <View style={[styles.cell, styles.first]}>
                    <View style={styles.line}>
                      <LineArt line={line} image={images.lines[line.id]} />
                      <View style={styles.lineCopy}>
                        <View style={styles.lineName}>
                          <Text style={styles.lineTitle}>
                            {line.name}
                          </Text>
                          {isCourtesy(line) && <Badge tone={line.courtesy === "today" ? "danger" : "success"}>{line.courtesy === "today" ? "Cortesia hoje" : "Cortesia"}</Badge>}
                        </View>
                        {line.description && (
                          <Text style={styles.lineDescription}>
                            {line.description}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.cell, styles.end, { width: COLUMN.count }]}>{countFormat.format(line.quantity)}</Text>
                  <Text style={[styles.cell, styles.end, { width: COLUMN.unit }]}>
                    <Text style={isCourtesy(line) ? styles.struck : undefined}>{formatMoney(line.unitPrice)}</Text>
                    <Text style={styles.per}>&nbsp;{unitShort[line.unit]}</Text>
                  </Text>
                  <Text style={[styles.cell, styles.end, styles.strong, styles.last, { width: COLUMN.total }]}>
                    {isCourtesy(line) ? "Grátis" : formatMoney(lineTotal(line))}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.summary}>
            <View style={styles.payment}>
              <Text style={styles.eyebrow}>Pagamento</Text>
              <View style={styles.paymentFacts}>
                <View style={styles.paymentFact}>
                  <Text style={styles.paymentLabel}>{methods.length > 1 ? "Formas" : "Forma"}</Text>
                  <Text style={styles.paymentValue}>{methods.map((value) => paymentMethods[value].label).join(", ")}</Text>
                </View>
                <View style={styles.paymentFact}>
                  <Text style={styles.paymentLabel}>Parcelas</Text>
                  <Text style={styles.paymentValue}>{quote.installments > 1 ? `${quote.installments}x de ${formatMoney(totals.installment)}` : "À vista, em uma parcela"}</Text>
                </View>
                {quote.cashDiscount > 0 && (
                  <View style={styles.paymentFact}>
                    <Text style={styles.paymentLabel}>À vista</Text>
                    <Text style={styles.paymentValue}>
                      {quote.cashDiscount}% de desconto, {formatMoney(totals.cash)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatMoney(totals.subtotal)}</Text>
              </View>
              {totals.courtesy > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Cortesia inclusa</Text>
                  <Text style={[styles.totalValue, styles.negative]}>{formatMoney(totals.courtesy)}</Text>
                </View>
              )}
              {totals.discount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Desconto{quote.discount?.kind === "percent" ? ` de ${quote.discount.value}%` : ""}</Text>
                  <Text style={[styles.totalValue, styles.negative]}>-{formatMoney(totals.discount)}</Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.grand]}>
                <Text style={styles.grandLabel}>Total</Text>
                <Text style={styles.grandValue}>
                  {quote.installments > 1 && <Text style={styles.times}>{quote.installments}x&nbsp;</Text>}
                  {formatMoney(quote.installments > 1 ? totals.installment : totals.total)}
                </Text>
              </View>
              {cashLine && <Text style={styles.terms}>{cashLine}</Text>}
            </View>
          </View>

          {quote.notes && (
            <View style={styles.notes}>
              <Text style={styles.eyebrow}>Observações</Text>
              <Text style={styles.notesBody}>{quote.notes}</Text>
            </View>
          )}

          {/* A assinatura, a mesma peça da tela: o selo de quem vendeu em círculo (ou a marca da Specular,
              quando não há foto) e, ao lado, o registro do documento assinado. */}
          <View style={styles.signature}>
            <Picture src={images.signature} style={styles.signatureSeal} />
            <View style={styles.signatureRegistry}>
              <Text style={styles.signatureNote}>Documento assinado digitalmente</Text>
              <Text style={styles.signatureName}>{quote.owner.name.toLocaleUpperCase("pt-BR")}</Text>
              {signedAt && <Text style={styles.signatureNote}>Data: {signedAt}</Text>}
              <Text style={[styles.signatureNote, styles.signatureHost]}>Emitido pelo {siteConfig.hosts.app}</Text>
            </View>
          </View>

          <View>
            <View style={styles.seal}>
              <Glyph paths={pdfIcons.seal} size={pt(14)} style={{ position: "relative", top: -type.caption2 * GLYPH_RISE }} />
              <Text style={styles.sealText}>Documento gerado pela Specular. Confira a autenticidade em {verifyUrl}</Text>
            </View>
            <View style={styles.brands}>
              {paymentBrandLogos.map((brand) => {
                const mark = pdfBrands[brand];
                return (
                  <Svg key={brand} width={pt(24)} height={pt(24)} viewBox={mark.viewBox}>
                    {mark.paths.map((d) => (
                      <Path key={d} d={d} fill={glyphInk} fillOpacity={brandOpacity} />
                    ))}
                  </Svg>
                );
              })}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
