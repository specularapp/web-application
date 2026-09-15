import "server-only";
/* A imagem do react-pdf entra como `Picture`: com o nome `Image` a regra de acessibilidade a confunde com a
   imagem do Next e pede texto alternativo, que não existe no desenho de PDF. */
import { Document, Image as Picture, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ReactNode } from "react";
import { PAGE_HEIGHT, PAGE_WIDTH, ink, leading, pt, space, type, weight } from "@/features/quotes/pdf-theme";
import { signatureStamp } from "@/features/quotes/signature";
import { registerInterFonts } from "@/lib/pdf/fonts";
import { siteConfig } from "@/lib/metadata";
import { partyRoles } from "./document";
import type { Contract, ContractParty, ContractTheme, DocNode } from "./summary";

/**
 * O contrato em PDF, pelos dois caminhos que ele tem:
 *
 * - **Escrito no editor**: a mesma folha de `document.tsx`, desenhada no react-pdf onde não há CSS, com os
 *   nós do documento mapeados um a um e o bloco de assinaturas no fim, com o traço de quem já assinou. A
 *   mancha é a da norma brasileira para documentos: margens de 3 cm em cima e à esquerda e 2 cm embaixo e à
 *   direita, corpo de 12 pontos, entrelinha de 1,5 e texto justificado (decisão de 2026-09-14).
 * - **PDF anexado**: o arquivo original, com o traço de cada parte carimbado onde ela marcou o campo
 *   (`pdf-lib`, que escreve dentro de um PDF existente sem redesenhá-lo) e uma página de registro no fim,
 *   com nome, e-mail, data e hora de cada assinatura. É o que faz o arquivo baixado valer como o documento
 *   assinado, e não como uma cópia sem prova.
 */

/* O acento do tema, resolvido para o PDF: a tela usa os tokens da paleta; aqui vai o valor. */
const accents: Record<ContractTheme, string> = {
  plain: ink.label,
  blue: "#007aff",
  green: "#248a3d",
  yellow: "#a07a00",
  purple: "#af52de",
};

/* A mancha da norma brasileira em pontos: 3 cm em cima e à esquerda, 2 cm embaixo e à direita (1 cm são
   28,35 pontos), e a coluna do texto tirada delas. */
const MARGIN = { top: 85, left: 85, right: 57, bottom: 57 };
const COLUMN = PAGE_WIDTH - MARGIN.left - MARGIN.right;
/* O corpo em 12 pontos com entrelinha de 1,5, como a norma pede; o título e as cláusulas no mesmo corpo,
   em caixa alta. */
const BODY = 11.5;
const LEADING = 1.5;

const styles = StyleSheet.create({
  page: { fontFamily: "Inter", paddingTop: MARGIN.top, paddingBottom: MARGIN.bottom + space.s4, paddingLeft: MARGIN.left, paddingRight: MARGIN.right, color: ink.label },
  h1: { fontSize: BODY + 1, fontWeight: weight.semibold, lineHeight: leading.tight, marginBottom: space.s8, letterSpacing: 0.6, textTransform: "uppercase", textAlign: "center" },
  h2: { fontSize: BODY, fontWeight: weight.semibold, lineHeight: leading.tight, marginTop: space.s6, marginBottom: space.s2, letterSpacing: 0.6, textTransform: "uppercase" },
  h3: { fontSize: BODY, fontWeight: weight.semibold, lineHeight: leading.tight, marginTop: space.s4, marginBottom: space.s1 },
  paragraph: { fontSize: BODY, lineHeight: LEADING, marginBottom: space.s3, textAlign: "justify" },
  listItem: { flexDirection: "row", marginBottom: space.s1 },
  marker: { width: space.s5, fontSize: BODY, lineHeight: LEADING },
  listBody: { flex: 1 },
  quote: { paddingLeft: space.s4, marginVertical: space.s3, borderLeftWidth: pt(3), color: ink.secondary },
  rule: { height: pt(0.6), backgroundColor: ink.border, marginVertical: space.s6 },
  signatures: { flexDirection: "row", gap: space.s8, marginTop: space.s8, paddingTop: space.s4 },
  signer: { flex: 1 },
  stroke: { height: pt(56), justifyContent: "flex-end" },
  trace: { maxHeight: pt(56), objectFit: "contain", objectPositionX: 0, objectPositionY: "100%" },
  line: { height: pt(1), backgroundColor: ink.label, marginTop: space.s1, marginBottom: space.s1 },
  signerName: { fontSize: type.footnote, fontWeight: weight.semibold, letterSpacing: 0.6, textTransform: "uppercase" },
  small: { fontSize: type.caption2, color: ink.secondary, lineHeight: leading.normal },
  faint: { fontSize: type.caption2, color: ink.tertiary, lineHeight: leading.normal },
  footer: { position: "absolute", left: MARGIN.left, right: MARGIN.right, bottom: space.s6, flexDirection: "row", justifyContent: "space-between", fontSize: type.caption2, color: ink.tertiary },
});

const alignOf = (node: DocNode) => {
  const align = node.attrs?.textAlign;
  return typeof align === "string" ? { textAlign: align as "left" | "center" | "right" | "justify" } : undefined;
};

/* As marcas viram estilo do trecho. O itálico fica sem inclinação de propósito: a casa registra a Inter em
   três pesos e nenhum itálico, e o react-pdf não inclina fonte por conta própria. */
function textStyle(node: DocNode, accent: string) {
  const marks = new Set((node.marks ?? []).map((mark) => mark.type));
  return {
    ...(marks.has("bold") && { fontWeight: weight.semibold }),
    ...(marks.has("underline") && { textDecoration: "underline" as const }),
    ...(marks.has("strike") && { textDecoration: "line-through" as const }),
    ...(marks.has("link") && { color: accent, textDecoration: "underline" as const }),
  };
}

function inline(node: DocNode, accent: string, key: number): ReactNode {
  if (node.type === "text") {
    return (
      <Text key={key} style={textStyle(node, accent)}>
        {node.text ?? ""}
      </Text>
    );
  }
  if (node.type === "hardBreak") return <Text key={key}>{"\n"}</Text>;
  return null;
}

const inlines = (node: DocNode, accent: string) => node.content?.map((child, index) => inline(child, accent, index)) ?? null;

function block(node: DocNode, accent: string, key: number, ordered = false, position = 0): ReactNode {
  switch (node.type) {
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const style = level <= 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3;
      return (
        <Text key={key} style={[style, alignOf(node) ?? {}].flat()}>
          {inlines(node, accent)}
        </Text>
      );
    }
    case "paragraph":
      return (
        <Text key={key} style={[styles.paragraph, alignOf(node) ?? {}]}>
          {node.content?.length ? inlines(node, accent) : " "}
        </Text>
      );
    case "bulletList":
    case "orderedList":
      return <View key={key}>{node.content?.map((item, index) => block(item, accent, index, node.type === "orderedList", index + 1))}</View>;
    case "listItem":
      return (
        <View key={key} style={styles.listItem} wrap={false}>
          <Text style={styles.marker}>{ordered ? `${position}.` : "•"}</Text>
          <View style={styles.listBody}>{node.content?.map((child, index) => block(child, accent, index))}</View>
        </View>
      );
    case "blockquote":
      return (
        <View key={key} style={[styles.quote, { borderLeftColor: accent }]}>
          {node.content?.map((child, index) => block(child, accent, index))}
        </View>
      );
    case "horizontalRule":
      return <View key={key} style={styles.rule} />;
    default:
      return null;
  }
}

/* O bloco de assinaturas do arquivo, a mesma peça de `document.tsx`: o traço sobre a linha, o nome em caixa
   alta, o papel e o e-mail, e o registro com data e hora. */
function Signatures({ parties }: { parties: ContractParty[] }) {
  return (
    <View style={styles.signatures} wrap={false}>
      {parties.map((party) => (
        <View key={party.id} style={styles.signer}>
          <View style={styles.stroke}>{party.signatureUrl ? <Picture src={party.signatureUrl} style={styles.trace} /> : null}</View>
          <View style={styles.line} />
          <Text style={styles.signerName}>{party.name}</Text>
          <Text style={styles.small}>
            {partyRoles[party.role]}, {party.email}
          </Text>
          <Text style={party.signedAt ? styles.small : styles.faint}>{party.signedAt ? `Assinado digitalmente em ${signatureStamp(party.signedAt)}` : "Aguardando assinatura"}</Text>
        </View>
      ))}
    </View>
  );
}

function ContractPdfDocument({ contract }: { contract: Contract }) {
  const accent = accents[contract.theme];
  const issuer = contract.parties.find((party) => party.role === "issuer");

  return (
    <Document title={`Contrato ${contract.reference}`} author={issuer?.name ?? contract.owner.name} language="pt-BR">
      <Page size={[PAGE_WIDTH, PAGE_HEIGHT]} style={styles.page}>
        <View style={{ width: COLUMN }}>{contract.body?.content?.map((node, index) => block(node, accent, index))}</View>
        <Signatures parties={contract.parties} />
        <View style={styles.footer} fixed>
          <Text>{`Contrato ${contract.reference}, emitido pelo ${siteConfig.url.replace(/^https?:\/\//, "")}`}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/* Um traço em PNG embutido vira bytes para o `pdf-lib` embutir. */
function pngBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

/**
 * O PDF anexado com as assinaturas carimbadas nos campos que a pessoa marcou e a página de registro no fim.
 * As frações do campo viram pontos da página em que ele mora; a origem do PDF é o canto de baixo, então o
 * `y` vira de cabeça para baixo. O traço entra contido na caixa, sem esticar, assentado na base dela, e a
 * legenda com o nome e a data vai logo abaixo, miúda.
 */
async function stampPdf(original: Uint8Array, contract: Contract) {
  const pdf = await PDFDocument.load(original, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0, 0, 0);
  const grey = rgb(0.43, 0.43, 0.45);

  for (const field of contract.fields) {
    const party = contract.parties.find((entry) => entry.id === field.partyId);
    const page = pdf.getPages()[field.page - 1];
    if (!party?.signedAt || !page) continue;
    const { width, height } = page.getSize();
    const box = { x: field.x * width, y: height - (field.y + field.height) * height, width: field.width * width, height: field.height * height };

    if (party.signatureUrl) {
      const png = await pdf.embedPng(pngBytes(party.signatureUrl));
      const scale = Math.min(box.width / png.width, (box.height * 0.8) / png.height);
      const drawn = { width: png.width * scale, height: png.height * scale };
      page.drawImage(png, { x: box.x, y: box.y + box.height * 0.2, width: drawn.width, height: drawn.height });
    }
    page.drawLine({ start: { x: box.x, y: box.y + box.height * 0.18 }, end: { x: box.x + box.width, y: box.y + box.height * 0.18 }, thickness: 0.6, color: dark });
    page.drawText(`${party.name}, ${signatureStamp(party.signedAt)}`, { x: box.x, y: box.y + box.height * 0.04, size: Math.min(7, box.height * 0.16), font, color: grey });
  }

  /* A página de registro: cada parte com o papel, o nome, o e-mail e quando assinou, e o identificador do
     documento embaixo. É o que uma cópia impressa mostra de prova, mesmo sem o traço. */
  const registry = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursor = PAGE_HEIGHT - 72;
  registry.drawText("Registro de assinaturas", { x: 56, y: cursor, size: 18, font: bold, color: dark });
  cursor -= 22;
  registry.drawText(`Contrato ${contract.reference}, ${contract.title}`, { x: 56, y: cursor, size: 10, font, color: grey });
  cursor -= 36;

  for (const party of contract.parties) {
    registry.drawText(partyRoles[party.role], { x: 56, y: cursor, size: 9, font, color: grey });
    cursor -= 14;
    registry.drawText(party.name, { x: 56, y: cursor, size: 12, font: bold, color: dark });
    cursor -= 15;
    registry.drawText(party.email, { x: 56, y: cursor, size: 10, font, color: grey });
    cursor -= 15;
    registry.drawText(party.signedAt ? `Assinado digitalmente em ${signatureStamp(party.signedAt)}` : "Aguardando assinatura", { x: 56, y: cursor, size: 10, font, color: party.signedAt ? dark : grey });
    cursor -= 32;
  }

  registry.drawText(`Documento emitido pelo ${siteConfig.url.replace(/^https?:\/\//, "")}. Cada assinatura foi registrada com data, hora e o endereço pessoal de quem assinou.`, { x: 56, y: 56, size: 8, font, color: grey, maxWidth: PAGE_WIDTH - 112, lineHeight: 11 });

  return pdf.save();
}

/** O contrato em PDF, por qualquer dos dois caminhos: uma chamada, um arquivo. */
export async function renderContractPdf(contract: Contract, file: Uint8Array | null): Promise<Uint8Array> {
  if (contract.file && file) return stampPdf(file, contract);
  registerInterFonts();
  const buffer = await renderToBuffer(<ContractPdfDocument contract={contract} />);
  return new Uint8Array(buffer);
}
