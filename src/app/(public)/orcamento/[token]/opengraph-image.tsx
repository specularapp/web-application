import { ImageResponse } from "next/og";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { sysHues, type SysHue } from "@/lib/palette";
import { hashString } from "@/lib/utils/hash";
import { findQuoteByToken } from "@/features/quotes/list";
import { previewQuotes } from "@/features/quotes/list-preview";
import { quoteTotals } from "@/features/quotes/totals";
import { formatMoney } from "@/lib/utils/format";

export const alt = "Orçamento";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Os doze matizes da paleta do sistema em `lib/palette.ts`, no valor do tema claro: a imagem não tem tema, e
   a cor cheia sobre o fundo escuro é o que o WhatsApp mostra melhor. É o mesmo matiz que a folha usa na aura
   e que o PDF do orçamento desenha, para a prévia e o documento serem a mesma coisa. */
const hueNames = Object.keys(sysHues) as SysHue[];

/* O mesmo sorteio do `Avatar`, pelo mesmo `hashString` e na mesma ordem de matizes. Reescrito aqui, e não
   importado do `Avatar`, porque a rota da imagem não carrega CSS Module. */
const hueFor = (seed: string) => hueNames[hashString(seed) % hueNames.length];

/* A cor vizinha no círculo, para a segunda mancha: gira a lista dos matizes, que já está em ordem de matiz. */
const neighbor = (hue: SysHue) => sysHues[hueNames[(hueNames.indexOf(hue) + 3) % hueNames.length]];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

// A imagem que o WhatsApp mostra ao lado do link, em 1200 por 630: o mesmo desenho do documento, a aura de
// cor da equipe sobre o fundo escuro, a logo (ou as iniciais) com o nome, "Orçamento" e o número, o título
// grande, o total e até quando vale, e para quem é. Satori não tem `filter: blur`, então a aura são gradientes
// radiais que já nascem esfumados. Fonte do sistema, como a imagem da raiz.
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = findQuoteByToken(previewQuotes, token);

  const hue = sysHues[hueFor(quote?.issuer.name ?? "Specular")];
  const second = neighbor(hueFor(quote?.issuer.name ?? "Specular"));
  const total = quote ? formatMoney(quoteTotals(quote).total) : "";
  const validity = quote?.validUntil ? `Válido até ${format(parseISO(quote.validUntil), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}` : "Sem prazo de validade";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: `radial-gradient(520px 420px at 92% -10%, ${hue}cc 0%, ${hue}55 35%, transparent 70%), radial-gradient(460px 380px at -6% 8%, ${second}99 0%, ${second}33 40%, transparent 72%), #0b0b0f`,
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {quote?.issuer.logoUrl ? (
              <img src={quote.issuer.logoUrl} width={88} height={88} alt="" style={{ borderRadius: 28, objectFit: "cover" }} />
            ) : (
              <div
                style={{
                  width: 88,
                  height: 88,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 28,
                  background: hue,
                  color: "#0b0b0f",
                  fontSize: 36,
                  fontWeight: 700,
                }}
              >
                {initialsOf(quote?.issuer.name ?? "Specular")}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{quote?.issuer.name ?? "Specular"}</div>
              <div style={{ fontSize: 22, color: "#a1a1aa" }}>{quote ? `Para ${quote.client.company ?? quote.client.name}` : "Orçamento"}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{ fontSize: 20, letterSpacing: 3, color: "#a1a1aa" }}>ORÇAMENTO</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{quote?.number ?? ""}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 1000 }}>{quote?.title ?? "Este orçamento não está mais disponível"}</div>
          {quote && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
              <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>{total}</div>
              <div style={{ fontSize: 24, color: "#a1a1aa" }}>
                {quote.installments > 1 ? `em ${quote.installments} parcelas` : "à vista"}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 22, color: "#a1a1aa" }}>
          <div>{validity}</div>
          <div>{quote ? `Preparado por ${quote.owner.name}` : ""}</div>
        </div>
      </div>
    ),
    size,
  );
}
