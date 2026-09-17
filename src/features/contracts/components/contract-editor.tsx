"use client";

import {
  ArrowLeftIcon,
  ArrowUUpLeftIcon,
  ArrowUUpRightIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  CopyIcon,
  CurrencyCircleDollarIcon,
  DownloadSimpleIcon,
  LinkIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  ListPlusIcon,
  MinusIcon,
  PaperPlaneTiltIcon,
  PlusCircleIcon,
  QuotesIcon,
  SlidersHorizontalIcon,
  SparkleIcon,
  TextAlignCenterIcon,
  TextAlignJustifyIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextAaIcon,
  TextBIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
  UserCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { TextAlign } from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { FieldAffix } from "@/components/ui/field-shell";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { callAction } from "@/lib/action";
import { onlyDigits } from "@/lib/masks";
import { cx } from "@/lib/utils/cx";
import { formatMoney } from "@/lib/utils/format";
import { rewriteTextAction, saveContractAction, sendContractAction } from "../actions";
import { ContractSignatures } from "../document";
import docStyles from "../document.module.css";
import { contractKinds } from "../labels";
import { contractKindValues, contractLimits, contractThemeValues, expiryLimits, type RewriteMode, type SaveContractInput } from "../schemas";
import type { ContractLookups } from "../service";
import type { Contract, ContractKind, ContractParty, ContractTheme, DocNode, SignatureField } from "../summary";
import { clauseLabel } from "../templates";
import { PdfFieldsEditor, PdfFieldsToolsPanel } from "./pdf-fields-editor";
import styles from "./contract-editor.module.css";

export type ContractEditorProps = {
  contract: Contract;
  lookups: ContractLookups;
  /** Se a reescrita por IA está configurada: sem ela o grupo nem aparece. */
  aiAvailable: boolean;
};

/** Quanto o editor espera a pessoa parar de mexer antes de salvar o rascunho. */
const SAVE_PAUSE = 900;

/** A ficha só cabe ao lado do documento a partir daqui; abaixo ela vira gaveta. */
const PANELS_QUERY = "(min-width: 64rem)";

const themeLabels: Record<ContractTheme, string> = { plain: "Neutro", blue: "Azul", green: "Verde", yellow: "Amarelo", purple: "Roxo" };

const kindOptions = contractKindValues.map((value) => ({ value, label: contractKinds[value].label }));

const rewriteOptions: { mode: RewriteMode; label: string }[] = [
  { mode: "grammar", label: "Corrigir gramática" },
  { mode: "formal", label: "Tom formal" },
  { mode: "direct", label: "Mais direto" },
  { mode: "shorter", label: "Resumir" },
];

type Setup = {
  title: string;
  kind: ContractKind;
  description: string;
  theme: ContractTheme;
  clientId: string | null;
  projectId: string | null;
  quoteId: string | null;
  expiresInDays: string;
  issuerEmail: string;
  clientEmail: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

/** O que o leque "Dados do contrato" escreve no texto, tirado da ficha como está agora. */
type ContractFacts = { contractor: string | null; provider: string; amount: number | null; reference: string };

function setupOf(contract: Contract): Setup {
  return {
    title: contract.title,
    kind: contract.kind,
    description: contract.description,
    theme: contract.theme,
    clientId: contract.client?.id ?? null,
    projectId: contract.project?.id ?? null,
    quoteId: contract.quote?.id ?? null,
    expiresInDays: String(contract.expiresInDays),
    issuerEmail: contract.parties.find((party) => party.role === "issuer")?.email ?? "",
    clientEmail: contract.parties.find((party) => party.role === "client")?.email ?? "",
  };
}

// O editor do contrato (2026-09-14, sobre uma referência de editor de notas do usuário, adaptada aos padrões
// da casa): a ficha à esquerda em três grupos (o contrato, os vínculos, a assinatura) e o documento ao
// centro numa folha na proporção A4, com a barra de ferramentas estreita presa em cima e tudo o que não é
// formato de texto num leque só ("Opções": inserir cláusula, listas, citação, linha, link, os dados do
// contrato e o estilo), porque a pedido do usuário no mesmo dia a coluna da direita saiu e a barra ficou mais
// fluida. No PDF anexado a coluna da direita continua, com os campos de assinatura, porque ali ela é a lista
// do trabalho. Abaixo de 64rem a ficha vira gaveta aberta por glifo na barra. Tudo salva sozinho depois de
// uma pausa, e a barra diz quando; Enviar salva e manda o convite às duas partes.
export function ContractEditor({ contract, lookups, aiAvailable }: ContractEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const panelsInline = useMediaQuery(PANELS_QUERY);
  const [setup, setSetup] = useState<Setup>(() => setupOf(contract));
  const [body, setBody] = useState<DocNode | null>(contract.body);
  const [fields, setFields] = useState<SignatureField[]>(contract.fields);
  const [parties, setParties] = useState<ContractParty[]>(contract.parties);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  // O que mudou desde o último salvamento: cada mexida soma um, e o efeito de salvar espera a pausa.
  const [version, setVersion] = useState(0);
  const touch = useCallback(() => setVersion((current) => current + 1), []);
  const isPdf = contract.source === "pdf";

  const payload = useCallback(
    (): SaveContractInput => ({
      id: contract.id,
      title: setup.title,
      kind: setup.kind,
      description: setup.description,
      theme: setup.theme,
      clientId: setup.clientId,
      projectId: setup.projectId,
      quoteId: setup.quoteId,
      expiresInDays: Math.min(expiryLimits.max, Math.max(expiryLimits.min, Number(setup.expiresInDays || expiryLimits.default))),
      emails: { issuer: setup.issuerEmail, client: setup.clientEmail },
      body: isPdf ? null : body,
      fields,
    }),
    [contract.id, isPdf, setup, body, fields],
  );

  const save = useCallback(async () => {
    setSaveState("saving");
    const result = await callAction(saveContractAction(payload()));
    if (!result.ok) {
      setSaveState("error");
      toast({ title: "Não deu para salvar", description: result.error, tone: "danger" });
      return false;
    }
    setParties(result.contract.parties);
    setSaveState("saved");
    setSavedAt(format(new Date(), "HH:mm"));
    return true;
  }, [payload, toast]);

  useEffect(() => {
    if (version === 0) return;
    const timer = window.setTimeout(() => void save(), SAVE_PAUSE);
    return () => window.clearTimeout(timer);
  }, [version, save]);

  const change = <K extends keyof Setup>(key: K, value: Setup[K]) => {
    setSetup((current) => ({ ...current, [key]: value }));
    touch();
  };

  /* Trocar o cliente puxa o e-mail dele e solta o projeto e o orçamento que eram de outro cliente. */
  const changeClient = (clientId: string | null) => {
    const client = lookups.clients.find((entry) => entry.id === clientId);
    setSetup((current) => ({
      ...current,
      clientId,
      clientEmail: client?.email ?? "",
      projectId: lookups.projects.some((project) => project.id === current.projectId && project.clientId === clientId) ? current.projectId : null,
      quoteId: lookups.quotes.some((quote) => quote.id === current.quoteId && quote.clientId === clientId) ? current.quoteId : null,
    }));
    touch();
  };

  const send = async () => {
    setSending(true);
    const saved = await save();
    if (!saved) {
      setSending(false);
      return;
    }
    const result = await callAction(sendContractAction({ id: contract.id }));
    setSending(false);
    if (!result.ok) {
      toast({ title: "Não deu para enviar", description: result.error, tone: "danger" });
      return;
    }
    toast({
      title: result.emailed ? "Convite enviado" : "Convite registrado",
      description: result.emailed ? "As duas partes receberam o link de assinatura por e-mail." : "O e-mail não saiu neste ambiente. Copie o link de cada parte na ficha do contrato.",
      tone: result.emailed ? "success" : "warning",
    });
    router.push(`/contratos/${contract.id}` as Route);
  };

  useFloatingActionsRegistration(
    mobile
      ? {
          primary: { label: sending ? "Enviando" : "Enviar", icon: <PaperPlaneTiltIcon weight="bold" />, loading: sending, onClick: () => void send() },
          extras: [
            { label: "Ajustes do contrato", icon: <SlidersHorizontalIcon weight="bold" />, onClick: () => setSetupOpen(true) },
            ...(isPdf ? [{ label: "Campos de assinatura", icon: <TextAaIcon weight="bold" />, onClick: () => setToolsOpen(true) }] : []),
          ],
          cancel: { label: "Voltar ao contrato", onClick: () => router.push(`/contratos/${contract.id}` as Route) },
        }
      : null,
  );

  const clientOptions = lookups.clients.map((client) => ({
    value: client.id,
    label: client.company ?? client.name,
    caption: client.company ? client.name : undefined,
    media: <Avatar name={client.name} src={client.avatarUrl ?? undefined} size="xs" shape="squircle" />,
  }));
  const projectOptions = lookups.projects.filter((project) => !setup.clientId || project.clientId === setup.clientId).map((project) => ({ value: project.id, label: project.name }));
  const quoteOptions = lookups.quotes.filter((quote) => !setup.clientId || quote.clientId === setup.clientId).map((quote) => ({ value: quote.id, label: quote.number, caption: `${quote.title}, ${formatMoney(quote.amount)}` }));

  const client = lookups.clients.find((entry) => entry.id === setup.clientId);
  const quote = lookups.quotes.find((entry) => entry.id === setup.quoteId);
  const facts: ContractFacts = {
    contractor: client ? (client.company ?? client.name) : (contract.client?.company ?? contract.client?.name ?? null),
    provider: parties.find((party) => party.role === "issuer")?.name ?? contract.owner.name,
    amount: quote?.amount ?? contract.amount,
    reference: contract.reference,
  };

  /* A ficha, em três grupos com rótulos curtos (acerto de 2026-09-14: os rótulos longos quebravam linha na
     coluna estreita): o contrato, os vínculos e a assinatura. */
  const setupPanel = (
    <div className={styles.panelBody}>
      <section className={styles.setupGroup} aria-label="Contrato">
        <Text as="h3" variant="caption1" weight="semibold" tone="secondary" className={styles.setupTitle}>
          Contrato
        </Text>
        <Field label="Título" required>
          <Input type="text" size="sm" value={setup.title} maxLength={contractLimits.title} placeholder="Nome do contrato" onChange={(event) => change("title", event.target.value)} />
        </Field>
        <Field label="Tipo">
          <Select<ContractKind> label="Tipo de trabalho" size="sm" options={kindOptions} value={setup.kind} onChange={(kind) => change("kind", kind)} />
        </Field>
        <Field label="Descrição" hint={`${setup.description.length} de ${contractLimits.description}`}>
          <Textarea size="sm" rows={2} value={setup.description} maxLength={contractLimits.description} placeholder="A linha que aparece no cartão" onChange={(event) => change("description", event.target.value)} />
        </Field>
      </section>

      <section className={styles.setupGroup} aria-label="Vínculos">
        <Text as="h3" variant="caption1" weight="semibold" tone="secondary" className={styles.setupTitle}>
          Vínculos
        </Text>
        <Field label="Cliente" required>
          <Select<string> label="Quem contrata" size="sm" options={clientOptions} value={setup.clientId ?? undefined} placeholder="Escolha o cliente" searchable searchPlaceholder="Buscar cliente" onChange={changeClient} />
        </Field>
        <Field label="Projeto">
          <Select<string> label="Projeto vinculado" size="sm" options={projectOptions} value={setup.projectId ?? undefined} placeholder="Nenhum" searchable emptyLabel="Nenhum projeto desse cliente" onChange={(projectId) => change("projectId", projectId)} />
        </Field>
        <Field label="Orçamento" hint="Define o valor do contrato">
          <Select<string> label="Orçamento de origem" size="sm" options={quoteOptions} value={setup.quoteId ?? undefined} placeholder="Nenhum" searchable emptyLabel="Nenhum orçamento aprovado desse cliente" onChange={(quoteId) => change("quoteId", quoteId)} />
        </Field>
      </section>

      <section className={styles.setupGroup} aria-label="Assinatura">
        <Text as="h3" variant="caption1" weight="semibold" tone="secondary" className={styles.setupTitle}>
          Assinatura
        </Text>
        <Field label="E-mail do cliente" required hint="Recebe o convite para assinar">
          <Input type="email" size="sm" value={setup.clientEmail} maxLength={contractLimits.email} placeholder="cliente@empresa.com" autoComplete="off" onChange={(event) => change("clientEmail", event.target.value)} />
        </Field>
        <Field label="E-mail da equipe" required hint="Quem assina do nosso lado">
          <Input type="email" size="sm" value={setup.issuerEmail} maxLength={contractLimits.email} autoComplete="off" onChange={(event) => change("issuerEmail", event.target.value)} />
        </Field>
        <Field label="Validade" hint={`De ${expiryLimits.min} a ${expiryLimits.max} dias depois do envio`}>
          <Input type="text" size="sm" mask="integer" inputMode="numeric" value={setup.expiresInDays} maxLength={2} iconEnd={<FieldAffix data-tone="muted">dias</FieldAffix>} onChange={(event) => change("expiresInDays", onlyDigits(event.target.value))} />
        </Field>
      </section>
    </div>
  );

  const pdfTools = isPdf && (
    <PdfFieldsToolsPanel
      contract={contract}
      parties={parties}
      fields={fields}
      selectedId={selectedField}
      onSelect={setSelectedField}
      onChange={(next) => {
        setFields(next);
        touch();
      }}
    />
  );

  const saveLabel = saveState === "saving" ? "Salvando" : saveState === "error" ? "Não salvou" : saveState === "saved" && savedAt ? `Salvo às ${savedAt}` : "Rascunho";

  return (
    <div className={styles.editor}>
      <header className={styles.bar}>
        <IconButton label="Voltar ao contrato" variant="ghost" size="sm" href={`/contratos/${contract.id}`}>
          <ArrowLeftIcon />
        </IconButton>
        <nav className={styles.crumbs} aria-label="Onde o contrato mora">
          <Link href="/contratos" className={styles.crumb}>
            Contratos
          </Link>
          <span className={styles.slash} aria-hidden="true">
            /
          </span>
          <Text as="span" variant="footnote" weight="semibold" truncate>
            {setup.title || "Contrato sem título"}
          </Text>
          <Badge tone="neutral" variant="soft" size="sm" className={styles.reference}>
            {contract.reference}
          </Badge>
        </nav>
        <Text as="span" variant="caption1" tone={saveState === "error" ? "danger" : "secondary"} className={styles.saveState} role="status">
          {saveLabel}
        </Text>
        <div className={styles.barActions}>
          {!panelsInline && (
            <>
              <IconButton label="Ajustes do contrato" variant="outline" size="sm" radius="md" onClick={() => setSetupOpen(true)}>
                <SlidersHorizontalIcon />
              </IconButton>
              {isPdf && (
                <IconButton label="Campos de assinatura" variant="outline" size="sm" radius="md" onClick={() => setToolsOpen(true)}>
                  <TextAaIcon />
                </IconButton>
              )}
            </>
          )}
          <IconButton label="Baixar PDF" variant="outline" size="sm" radius="md" href={`/api/contratos/${contract.id}/pdf`}>
            <DownloadSimpleIcon />
          </IconButton>
          <span className={styles.wide}>
            <Button size="sm" radius="md" iconStart={<PaperPlaneTiltIcon />} loading={sending} onClick={() => void send()}>
              {sending ? "Enviando" : "Enviar para assinatura"}
            </Button>
          </span>
          <span className={styles.narrow}>
            <IconButton label="Enviar para assinatura" size="sm" radius="md" loading={sending} onClick={() => void send()}>
              <PaperPlaneTiltIcon />
            </IconButton>
          </span>
        </div>
      </header>

      <div className={styles.work} data-tools={(isPdf && panelsInline) || undefined}>
        {panelsInline && (
          <aside className={cx(styles.panel, styles.setup)} aria-label="Ajustes do contrato">
            {setupPanel}
          </aside>
        )}

        {isPdf ? (
          <>
            <section className={styles.stage} aria-label="Documento">
              <PdfFieldsEditor
                contract={contract}
                parties={parties}
                fields={fields}
                selectedId={selectedField}
                onSelect={setSelectedField}
                onChange={(next) => {
                  setFields(next);
                  touch();
                }}
              />
            </section>
            {panelsInline && (
              <aside className={cx(styles.panel, styles.tools)} aria-label="Campos de assinatura">
                {pdfTools}
              </aside>
            )}
          </>
        ) : (
          <BodyWorkspace
            contract={contract}
            parties={parties}
            theme={setup.theme}
            facts={facts}
            aiAvailable={aiAvailable}
            onTheme={(theme) => change("theme", theme)}
            onBody={(next) => {
              setBody(next);
              touch();
            }}
          />
        )}
      </div>

      {/* Abaixo de 64rem a ficha é gaveta, e no PDF os campos também. */}
      <Dialog open={!panelsInline && setupOpen} onClose={() => setSetupOpen(false)} label="Ajustes do contrato" size="md" placement="end" scrim={mobile} focusOnOpen={false}>
        <PanelSheet title="O contrato" onClose={() => setSetupOpen(false)}>
          {setupPanel}
        </PanelSheet>
      </Dialog>
      {isPdf && (
        <Dialog open={!panelsInline && toolsOpen} onClose={() => setToolsOpen(false)} label="Campos de assinatura" size="md" placement="end" scrim={mobile} focusOnOpen={false}>
          <PanelSheet title="Campos de assinatura" onClose={() => setToolsOpen(false)}>
            {pdfTools}
          </PanelSheet>
        </Dialog>
      )}
    </div>
  );
}

/* Um painel virado gaveta, no celular e no tablet: o título com o X e o conteúdo rolando. */
function PanelSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useFloatingActionsRegistration({ cancel: { label: "Fechar", onClick: onClose } });
  return (
    <div className={styles.drawer}>
      <header className={styles.drawerHead}>
        <Text as="h2" variant="headline" weight="semibold">
          {title}
        </Text>
        <IconButton label="Fechar" variant="ghost" size="sm" onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>
      <div className={styles.drawerBody}>{children}</div>
    </div>
  );
}

type BodyWorkspaceProps = {
  contract: Contract;
  parties: ContractParty[];
  theme: ContractTheme;
  facts: ContractFacts;
  aiAvailable: boolean;
  onTheme: (theme: ContractTheme) => void;
  onBody: (body: DocNode) => void;
};

type BlockKind = "p" | "h1" | "h2" | "h3";

type Alignment = "left" | "center" | "right" | "justify";

const blockOptions: { value: BlockKind; label: string }[] = [
  { value: "h1", label: "Título" },
  { value: "h2", label: "Cláusula" },
  { value: "h3", label: "Subtítulo" },
  { value: "p", label: "Texto" },
];

const alignments: { value: Alignment; label: string; icon: typeof TextAlignLeftIcon }[] = [
  { value: "justify", label: "Justificado", icon: TextAlignJustifyIcon },
  { value: "left", label: "À esquerda", icon: TextAlignLeftIcon },
  { value: "center", label: "Centralizado", icon: TextAlignCenterIcon },
  { value: "right", label: "À direita", icon: TextAlignRightIcon },
];

/** O que fica selecionado no título da cláusula nova, para a pessoa digitar o assunto por cima. */
const CLAUSE_SUBJECT = "[assunto]";

const longDate = (date: Date) => format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });

/* O documento escrito: a barra de ferramentas estreita por cima da folha, a folha em proporção A4 com o
   Tiptap dentro e as assinaturas no pé. Vive aqui, e não no pai, porque tudo precisa do editor. */
function BodyWorkspace({ contract, parties, theme, facts, aiAvailable, onTheme, onBody }: BodyWorkspaceProps) {
  const { toast } = useToast();
  const [rewriting, setRewriting] = useState<RewriteMode | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, code: false, link: { openOnClick: false, autolink: true } }),
      TextAlign.configure({ types: ["heading", "paragraph"], defaultAlignment: "justify" }),
      Placeholder.configure({ placeholder: "Escreva o contrato aqui" }),
    ],
    content: contract.body ?? undefined,
    editorProps: { attributes: { class: docStyles.body, "aria-label": "Texto do contrato" } },
    onUpdate: ({ editor: instance }) => onBody(instance.getJSON() as unknown as DocNode),
  });

  const editorState = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance?.isActive("bold") ?? false,
      italic: instance?.isActive("italic") ?? false,
      underline: instance?.isActive("underline") ?? false,
      strike: instance?.isActive("strike") ?? false,
      bullet: instance?.isActive("bulletList") ?? false,
      ordered: instance?.isActive("orderedList") ?? false,
      quote: instance?.isActive("blockquote") ?? false,
      link: instance?.isActive("link") ?? false,
      block: (instance?.isActive("heading", { level: 1 }) ? "h1" : instance?.isActive("heading", { level: 2 }) ? "h2" : instance?.isActive("heading", { level: 3 }) ? "h3" : "p") as BlockKind,
      align: (alignments.map((entry) => entry.value).find((value) => instance?.isActive({ textAlign: value })) ?? "justify") as Alignment,
      canUndo: instance?.can().undo() ?? false,
      canRedo: instance?.can().redo() ?? false,
    }),
  });
  /* Antes de o editor existir, o estado das ferramentas é o de nada marcado. */
  const state = editorState ?? { bold: false, italic: false, underline: false, strike: false, bullet: false, ordered: false, quote: false, link: false, block: "p" as BlockKind, align: "justify" as Alignment, canUndo: false, canRedo: false };

  useEffect(() => {
    if (linking) linkInput.current?.focus();
  }, [linking]);

  const setBlock = (block: BlockKind) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (block === "p") chain.setParagraph().run();
    else chain.toggleHeading({ level: block === "h1" ? 1 : block === "h2" ? 2 : 3 }).run();
  };

  /* O link abre uma linha embaixo da barra, já com o endereço do link em que o cursor está. */
  const openLink = () => {
    if (!editor) return;
    const href = editor.getAttributes("link").href;
    setLinkUrl(typeof href === "string" ? href : "");
    setLinking(true);
  };

  const applyLink = () => {
    if (!editor) return;
    const href = linkUrl.trim();
    if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: /^https?:\/\//i.test(href) ? href : `https://${href}` }).run();
    setLinking(false);
    setLinkUrl("");
  };

  const insertText = (value: string) => editor?.chain().focus().insertContent(value).run();

  /* A cláusula nova entra depois do bloco em que o cursor está, já com o número seguinte na forma da norma
     ("CLÁUSULA QUINTA: [ASSUNTO]") e o primeiro item ("5.1. "), e o assunto fica selecionado para digitar
     por cima. O número é contado nas cláusulas que já existem, então inserir no meio não renumera as de baixo:
     isso é da pessoa, que sabe o que quer. */
  const insertClause = () => {
    if (!editor) return;
    let count = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "heading" && node.attrs.level === 2 && /^CLÁUSULA\b/i.test(node.textContent)) count += 1;
    });
    const number = count + 1;
    const label = clauseLabel(number, CLAUSE_SUBJECT);
    const { $to } = editor.state.selection;
    const at = $to.depth === 0 ? $to.pos : $to.after(1);
    const labelEnd = at + 1 + label.length;
    editor
      .chain()
      .focus()
      .insertContentAt(at, [
        { type: "heading", attrs: { level: 2, textAlign: "left" }, content: [{ type: "text", text: label }] },
        { type: "paragraph", attrs: { textAlign: "justify" }, content: [{ type: "text", text: `${number}.1. ` }] },
      ])
      .setTextSelection({ from: labelEnd - CLAUSE_SUBJECT.length, to: labelEnd })
      .run();
  };

  const selectedText = () => {
    if (!editor) return "";
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, "\n");
  };

  const copySelection = async () => {
    const text = selectedText();
    if (!text.trim()) {
      toast({ title: "Selecione um trecho", description: "Marque o texto que quer copiar.", tone: "info" });
      return;
    }
    await navigator.clipboard.writeText(text).catch(() => undefined);
    toast({ title: "Trecho copiado", description: "O texto selecionado está na área de transferência.", tone: "success" });
  };

  /* O trecho selecionado vai para a IA e volta no lugar, com a seleção mantida sobre o texto novo. */
  const rewrite = async (mode: RewriteMode) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, "\n");
    if (!text.trim()) {
      toast({ title: "Selecione um trecho", description: "Marque o texto que quer reescrever antes de pedir à IA.", tone: "info" });
      return;
    }
    setRewriting(mode);
    const result = await callAction(rewriteTextAction({ text, mode }));
    setRewriting(null);
    if (!result.ok) {
      toast({ title: "Não deu para reescrever", description: result.error, tone: "danger" });
      return;
    }
    editor.chain().focus().insertContentAt({ from, to }, result.text).setTextSelection({ from, to: from + result.text.length }).run();
  };

  /* O leque da IA, um botão só, no desenho do menu de contexto da referência: as ações sobre o trecho e, com a
     OpenAI configurada, a reescrita. Sem trecho marcado, cada opção avisa em vez de sumir. */
  const aiSections: DropdownSection[] = [
    {
      id: "actions",
      label: "Ações",
      items: [{ id: "copy", label: "Copiar trecho", icon: CopyIcon, onSelect: () => void copySelection() }],
    },
    ...(aiAvailable
      ? [
          {
            id: "rewrite",
            label: "Reescrever com IA",
            items: rewriteOptions.map((option) => ({ id: option.mode, label: option.label, icon: SparkleIcon, onSelect: () => void rewrite(option.mode) })),
          },
        ]
      : []),
  ];

  const aiMenu = (compact: boolean) => (
    <DropdownMenu
      label="Ações sobre o trecho"
      triggerLabel={rewriting ? "Reescrevendo o trecho" : "Ações e reescrita por IA"}
      sections={aiSections}
      surface="solid"
      icon={compact ? <SparkleIcon /> : undefined}
      triggerContent={
        compact ? undefined : (
          <span className={styles.menuTrigger} data-busy={rewriting !== null || undefined}>
            <SparkleIcon weight="bold" aria-hidden="true" />
            IA
            <CaretDownIcon weight="bold" aria-hidden="true" className={styles.menuCaret} />
          </span>
        )
      }
    />
  );

  /* O leque das opções (acerto de 2026-09-14: tudo o que era a coluna da direita, num botão só): inserir a
     cláusula seguinte e os blocos, os dados do contrato no cursor e o estilo do documento. */
  const optionSections: DropdownSection[] = editor
    ? [
        {
          id: "insert",
          label: "Inserir",
          items: [
            { id: "clause", label: "Nova cláusula", icon: ListPlusIcon, onSelect: insertClause },
            { kind: "toggle", id: "bullet", label: "Lista", icon: ListBulletsIcon, checked: state.bullet, onChange: () => editor.chain().focus().toggleBulletList().run() },
            { kind: "toggle", id: "ordered", label: "Lista numerada", icon: ListNumbersIcon, checked: state.ordered, onChange: () => editor.chain().focus().toggleOrderedList().run() },
            { kind: "toggle", id: "quote", label: "Citação", icon: QuotesIcon, checked: state.quote, onChange: () => editor.chain().focus().toggleBlockquote().run() },
            { id: "rule", label: "Linha divisória", icon: MinusIcon, onSelect: () => editor.chain().focus().setHorizontalRule().run() },
            { id: "link", label: state.link ? "Editar link" : "Link", icon: LinkIcon, onSelect: openLink },
          ],
        },
        {
          id: "facts",
          label: "Dados do contrato",
          items: [
            { id: "contractor", label: "Contratante", icon: UserCircleIcon, onSelect: () => insertText(facts.contractor?.toUpperCase() ?? "[NOME DE QUEM CONTRATA]") },
            { id: "provider", label: "Contratada", icon: BuildingsIcon, onSelect: () => insertText(facts.provider.toUpperCase()) },
            { id: "amount", label: "Valor do contrato", icon: CurrencyCircleDollarIcon, onSelect: () => insertText(facts.amount === null ? "[valor]" : formatMoney(facts.amount)) },
            { id: "date", label: "Data de hoje", icon: CalendarBlankIcon, onSelect: () => insertText(longDate(new Date())) },
          ],
        },
        {
          id: "theme",
          label: "Estilo do documento",
          items: contractThemeValues.map((value) => ({
            id: value,
            label: themeLabels[value],
            media: <span className={styles.dot} data-theme={value} aria-hidden="true" />,
            selected: theme === value,
            onSelect: () => onTheme(value),
          })),
        },
      ]
    : [];

  /* A barra por cima da folha, na largura do que tem dentro e não da folha: desfazer e refazer, o tipo do
     bloco em leque, os quatro formatos, o alinhamento e as opções em leque e o botão da IA na ponta. Rola
     de lado quando não cabe. A linha do link abre embaixo dela. Os leques são sólidos (2026-09-15): abrem
     sobre a folha branca, e o vidro da casa a 20% ficava ilegível ali no tema escuro. */
  const toolbar = editor && (
    <div className={styles.toolbox}>
      <div className={styles.toolbar} role="toolbar" aria-label="Formatação do documento">
        <span className={styles.toolbarGroup}>
          <Tool label="Desfazer" icon={<ArrowUUpLeftIcon />} disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()} />
          <Tool label="Refazer" icon={<ArrowUUpRightIcon />} disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()} />
        </span>
        <span className={styles.toolbarRule} aria-hidden="true" />
        <DropdownMenu
          label="Tipo do bloco"
          triggerLabel="Tipo do bloco"
          surface="solid"
          sections={[{ id: "block", label: "Tipo do bloco", items: blockOptions.map((option) => ({ id: option.value, label: option.label, selected: state.block === option.value, onSelect: () => setBlock(option.value) })) }]}
          triggerContent={
            <span className={cx(styles.menuTrigger, styles.blockTrigger)}>
              {blockOptions.find((option) => option.value === state.block)?.label}
              <CaretDownIcon weight="bold" aria-hidden="true" className={styles.menuCaret} />
            </span>
          }
        />
        <span className={styles.toolbarRule} aria-hidden="true" />
        <span className={styles.toolbarGroup}>
          <Tool label="Negrito" on={state.bold} icon={<TextBIcon />} onClick={() => editor.chain().focus().toggleBold().run()} />
          <Tool label="Itálico" on={state.italic} icon={<TextItalicIcon />} onClick={() => editor.chain().focus().toggleItalic().run()} />
          <Tool label="Sublinhado" on={state.underline} icon={<TextUnderlineIcon />} onClick={() => editor.chain().focus().toggleUnderline().run()} />
          <Tool label="Riscado" on={state.strike} icon={<TextStrikethroughIcon />} onClick={() => editor.chain().focus().toggleStrike().run()} />
        </span>
        <span className={styles.toolbarRule} aria-hidden="true" />
        <span className={styles.toolbarGroup}>
          <DropdownMenu
            label="Alinhamento do texto"
            triggerLabel="Alinhamento"
            surface="solid"
            icon={(() => {
              const Glyph = alignments.find((entry) => entry.value === state.align)?.icon ?? TextAlignJustifyIcon;
              return <Glyph />;
            })()}
            sections={[
              {
                id: "align",
                label: "Alinhamento",
                items: alignments.map((entry) => ({ id: entry.value, label: entry.label, icon: entry.icon, selected: state.align === entry.value, onSelect: () => editor.chain().focus().setTextAlign(entry.value).run() })),
              },
            ]}
          />
          <DropdownMenu
            label="Opções do documento"
            triggerLabel="Opções"
            surface="solid"
            sections={optionSections}
            triggerContent={
              <span className={styles.menuTrigger}>
                <PlusCircleIcon weight="bold" aria-hidden="true" />
                Opções
                <CaretDownIcon weight="bold" aria-hidden="true" className={styles.menuCaret} />
              </span>
            }
          />
        </span>
        <span className={styles.toolbarRule} aria-hidden="true" />
        {aiMenu(false)}
      </div>

      {linking && (
        <div className={styles.linkBar} role="group" aria-label="Endereço do link">
          <Input
            ref={linkInput}
            type="url"
            size="sm"
            value={linkUrl}
            placeholder="https://"
            autoComplete="off"
            iconStart={<LinkIcon />}
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyLink();
              if (event.key === "Escape") setLinking(false);
            }}
          />
          <Button size="sm" radius="md" onClick={applyLink}>
            {linkUrl.trim() ? "Aplicar" : "Tirar link"}
          </Button>
          <IconButton label="Fechar" variant="ghost" size="sm" radius="md" onClick={() => setLinking(false)}>
            <XIcon />
          </IconButton>
        </div>
      )}
    </div>
  );

  return (
    <section className={styles.stage} aria-label="Documento">
      {toolbar}
      <article className={cx(docStyles.sheet, styles.sheet)} data-variant="preview" data-theme={theme} data-scheme="light">
        <EditorContent editor={editor} className={styles.content} />
        <ContractSignatures parties={parties} className={docStyles.foot} />
      </article>

      {/* O menu que flutua sobre a seleção: os três formatos e o mesmo leque da IA, um botão só. */}
      {editor && (
        <BubbleMenu editor={editor} className={styles.bubble} shouldShow={({ from, to }) => from !== to}>
          <Tool label="Negrito" on={state.bold} icon={<TextBIcon />} onClick={() => editor.chain().focus().toggleBold().run()} />
          <Tool label="Itálico" on={state.italic} icon={<TextItalicIcon />} onClick={() => editor.chain().focus().toggleItalic().run()} />
          <Tool label="Sublinhado" on={state.underline} icon={<TextUnderlineIcon />} onClick={() => editor.chain().focus().toggleUnderline().run()} />
          <span className={styles.bubbleRule} aria-hidden="true" />
          {aiMenu(true)}
        </BubbleMenu>
      )}
    </section>
  );
}

/* Um botão de ferramenta da barra: glifo só, aceso quando o formato está em vigor no cursor. */
function Tool({ label, icon, on = false, disabled = false, onClick }: { label: string; icon: ReactNode; on?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <IconButton label={label} variant={on ? "secondary" : "ghost"} size="sm" radius="md" aria-pressed={on} disabled={disabled} onClick={onClick}>
      {icon}
    </IconButton>
  );
}

export type { Editor };
