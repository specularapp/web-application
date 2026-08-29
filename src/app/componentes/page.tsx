import {
  ArchiveIcon,
  ArrowsClockwiseIcon,
  CalendarBlankIcon,
  CreditCardIcon,
  ExportIcon,
  PaperPlaneTiltIcon,
  PersonArmsSpreadIcon,
  PlusIcon,
  QuestionIcon,
  SunIcon,
  TrashIcon,
} from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { DatePicker } from "@/components/ui/date-picker";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { TextLink } from "@/components/ui/link";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Inline, Stack } from "@/components/ui/stack";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TableScroll } from "@/components/ui/table";
import { Surface } from "@/components/ui/surface";
import { Text } from "@/components/ui/text";
import { Tooltip } from "@/components/ui/tooltip";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Logo } from "@/components/layout/logo";
import { squircle } from "@/lib/corners";
import { createMetadata } from "@/lib/metadata";
import styles from "./componentes.module.css";

export const metadata = createMetadata({
  title: "Componentes",
  description: "Vitrine dos componentes do design system do Specular",
  path: "/componentes",
  noIndex: true,
});

type Entry = {
  name: string;
  note: string;
  wide?: boolean;
  layout?: "row" | "stack";
  example: ReactNode;
};

type Group = {
  title: string;
  entries: Entry[];
};

function Sample({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.sample}>
      <Text variant="caption1" tone="tertiary" font="code">
        {label}
      </Text>
      <div className={styles.sampleRow}>{children}</div>
    </div>
  );
}

const groups: Group[] = [
  {
    title: "Ações",
    entries: [
      {
        name: "Button",
        note: "Emotion e client. Texto ao centro, borda discreta, cantos squircle e peso do ícone acompanhando o do texto.",
        wide: true,
        layout: "stack",
        example: (
          <div className={styles.samples}>
            <Sample label="variant">
              <Button variant="primary">Primário</Button>
              <Button variant="secondary">Secundário</Button>
              <Button variant="outline">Contorno</Button>
              <Button variant="ghost">Fantasma</Button>
              <Button variant="danger">Excluir</Button>
            </Sample>
            <Sample label="size">
              <Button size="sm">Pequeno</Button>
              <Button size="md">Médio</Button>
              <Button size="lg">Grande</Button>
            </Sample>
            <Sample label="radius auto acompanha a altura">
              <Button size="sm" variant="outline">
                sm, raio 16
              </Button>
              <Button size="md" variant="outline">
                md, raio 20
              </Button>
              <Button size="lg" variant="outline">
                lg, raio 24
              </Button>
            </Sample>
            <Sample label="radius fixo">
              <Button radius="md" variant="outline">
                md
              </Button>
              <Button radius="lg" variant="outline">
                lg
              </Button>
              <Button radius="xl" variant="outline">
                xl
              </Button>
              <Button radius="full" variant="outline">
                full
              </Button>
            </Sample>
            <Sample label="iconStart e iconEnd">
              <Button iconStart={<PlusIcon />}>Criar</Button>
              <Button variant="outline" iconStart={<PlusIcon />}>
                Adicionar
              </Button>
              <Button variant="ghost" iconStart={<ExportIcon />}>
                Exportar
              </Button>
              <Button variant="secondary" iconEnd={<PaperPlaneTiltIcon />}>
                Enviar orçamento
              </Button>
            </Sample>
            <Sample label="locked e plan">
              <Button variant="ghost" locked plan="Alliance">
                Convidar
              </Button>
              <Button variant="outline" locked plan="Studio" iconStart={<PlusIcon />}>
                Domínio próprio
              </Button>
              <Button variant="ghost" locked>
                Automações
              </Button>
            </Sample>
            <Sample label="disabled">
              <Button disabled>Primário</Button>
              <Button variant="outline" disabled>
                Contorno
              </Button>
              <Button variant="danger" disabled>
                Excluir
              </Button>
            </Sample>
            <Sample label="background, foreground e border">
              <Button background="var(--sys-indigo)" foreground="var(--color-on-accent)">
                Cor sob medida
              </Button>
              <Button variant="outline" foreground="var(--sys-indigo)" border="var(--sys-indigo)">
                Contorno sob medida
              </Button>
            </Sample>
            <Sample label="type">
              <Button type="submit" variant="outline">
                Enviar
              </Button>
              <Button type="reset" variant="ghost">
                Limpar
              </Button>
            </Sample>
            <Sample label="fullWidth">
              <Button fullWidth>Continuar</Button>
            </Sample>
          </div>
        ),
      },
      {
        name: "IconButton",
        note: "Button quadrado com só o ícone. O label vira aria-label, então nunca fica sem nome acessível.",
        wide: true,
        layout: "stack",
        example: (
          <div className={styles.samples}>
            <Sample label="variant">
              <IconButton label="Arquivar" variant="outline">
                <ArchiveIcon />
              </IconButton>
              <IconButton label="Cobrança" variant="outline">
                <CreditCardIcon />
              </IconButton>
              <IconButton label="Agenda" variant="outline">
                <CalendarBlankIcon />
              </IconButton>
              <IconButton label="Excluir" variant="danger">
                <TrashIcon />
              </IconButton>
            </Sample>
            <Sample label="size">
              <IconButton label="Ajuda" size="sm" variant="secondary">
                <QuestionIcon />
              </IconButton>
              <IconButton label="Atualizar" size="md" variant="secondary">
                <ArrowsClockwiseIcon />
              </IconButton>
              <IconButton label="Tema" size="lg" variant="secondary">
                <SunIcon />
              </IconButton>
            </Sample>
            <Sample label="radius">
              <IconButton label="Ajuda" variant="outline">
                <QuestionIcon />
              </IconButton>
              <IconButton label="Atualizar" radius="md" variant="outline">
                <ArrowsClockwiseIcon />
              </IconButton>
              <IconButton label="Tema" radius="xl" variant="outline">
                <SunIcon />
              </IconButton>
              <IconButton label="Acessibilidade" radius="full" variant="outline">
                <PersonArmsSpreadIcon />
              </IconButton>
            </Sample>
          </div>
        ),
      },
    ],
  },
  {
    title: "Tipografia e estrutura",
    entries: [
      {
        name: "Text",
        note: "Escala da Apple com tracking por faixa de tamanho: -0.06em nos títulos, -0.04em no corpo e -0.02em nos textos pequenos.",
        wide: true,
        layout: "stack",
        example: (
          <div className={styles.samples}>
            <Sample label="variant">
              <Stack gap={2}>
                <Text as="p" variant="largeTitle">
                  Large title
                </Text>
                <Text as="p" variant="title1">
                  Title 1
                </Text>
                <Text as="p" variant="title2">
                  Title 2
                </Text>
                <Text as="p" variant="title3">
                  Title 3
                </Text>
                <Text as="p" variant="headline">
                  Headline
                </Text>
                <Text variant="body">Body</Text>
                <Text variant="callout">Callout</Text>
                <Text variant="subheadline">Subheadline</Text>
                <Text variant="footnote">Footnote</Text>
                <Text variant="caption1">Caption 1</Text>
                <Text variant="caption2">Caption 2</Text>
              </Stack>
            </Sample>
            <Sample label="tone">
              <Stack gap={2}>
                <Text>Padrão</Text>
                <Text tone="secondary">Secundário</Text>
                <Text tone="tertiary">Terciário</Text>
                <Text tone="accent">Acento</Text>
                <Text tone="success">Sucesso</Text>
                <Text tone="warning">Atenção</Text>
                <Text tone="danger">Erro</Text>
              </Stack>
            </Sample>
            <Sample label="font e weight">
              <Stack gap={2}>
                <Text as="p" font="display" variant="title3">
                  Playfair editorial
                </Text>
                <Text font="code">Geist Mono, só para código</Text>
                <Text weight="semibold">Inter semibold</Text>
              </Stack>
            </Sample>
            <Sample label="numeric mantém a Inter com algarismo tabular">
              <Stack gap={2}>
                <Text numeric>R$ 12.480,00</Text>
                <Text numeric>R$ 111.999,00</Text>
                <Text>R$ 12.480,00 sem numeric</Text>
              </Stack>
            </Sample>
          </div>
        ),
      },
      {
        name: "Stack e Inline",
        note: "Flex em coluna e em linha, com gap na escala de espaçamento e alinhamento por prop.",
        layout: "stack",
        example: (
          <Stack gap={4}>
            <Stack gap={2}>
              <Text variant="caption1" tone="tertiary" font="code">
                Stack gap={3}
              </Text>
              <Stack gap={3}>
                <Skeleton shape="rect" height="1.25rem" />
                <Skeleton shape="rect" height="1.25rem" />
              </Stack>
            </Stack>
            <Stack gap={2}>
              <Text variant="caption1" tone="tertiary" font="code">
                Inline gap={3} justify=&quot;between&quot;
              </Text>
              <Inline gap={3} justify="between">
                <Kbd>Início</Kbd>
                <Kbd>Meio</Kbd>
                <Kbd>Fim</Kbd>
              </Inline>
            </Stack>
          </Stack>
        ),
      },
      {
        name: "Surface",
        note: "Container aninhável. A profundidade sozinha define raio e padding: 40/16, depois 24/12, 12/8 e 4/8. Cada raio interno é o externo menos o padding, e sempre cai num token.",
        wide: true,
        layout: "stack",
        example: (
          <Surface>
            <Stack gap={3}>
              <Text variant="footnote" tone="secondary">
                nível 1, raio 40 e padding 16
              </Text>
              <Surface tone="sunken">
                <Stack gap={3}>
                  <Text variant="footnote" tone="secondary">
                    nível 2, raio 24 e padding 12
                  </Text>
                  <Surface tone="raised">
                    <Stack gap={3}>
                      <Text variant="footnote" tone="secondary">
                        nível 3, raio 12 e padding 8
                      </Text>
                      <Surface tone="sunken">
                        <Text variant="caption1" tone="tertiary">
                          nível 4, raio 4
                        </Text>
                      </Surface>
                    </Stack>
                  </Surface>
                </Stack>
              </Surface>
            </Stack>
          </Surface>
        ),
      },
      {
        name: "Container",
        note: "Largura máxima do conteúdo e respiro lateral responsivo. Envolve esta página.",
        example: (
          <Text variant="footnote" tone="secondary">
            size: default, narrow, full
          </Text>
        ),
      },
      {
        name: "Separator",
        note: "Divisor horizontal ou vertical, decorativo por padrão.",
        layout: "stack",
        example: (
          <Stack gap={4}>
            <Separator />
            <div className={styles.sampleRow}>
              <Text variant="footnote">Antes</Text>
              <Separator orientation="vertical" />
              <Text variant="footnote">Depois</Text>
            </div>
          </Stack>
        ),
      },
      {
        name: "VisuallyHidden",
        note: "Texto só para leitor de tela, sem ocupar espaço na tela.",
        example: (
          <Text variant="footnote" tone="secondary">
            <VisuallyHidden>Rótulo lido apenas por leitores de tela</VisuallyHidden>
            Há um texto oculto neste parágrafo
          </Text>
        ),
      },
    ],
  },
  {
    title: "Formulário",
    entries: [
      {
        name: "Label",
        note: "Rótulo de campo, com marcação de obrigatório.",
        layout: "stack",
        example: (
          <Stack gap={4}>
            <Stack gap={2}>
              <Label htmlFor="exemplo-nome">Nome do cliente</Label>
              <input id="exemplo-nome" type="text" name="nome" />
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="exemplo-empresa" required>
                Empresa
              </Label>
              <input id="exemplo-empresa" type="text" name="empresa" required />
            </Stack>
          </Stack>
        ),
      },
      {
        name: "Input",
        note: "Máscaras de CPF, CNPJ, telefone, CEP, dinheiro e percentual pela prop mask. R$ e % ficam fora do valor, em semibold, e o campo guarda só o número. Sem anel de foco, sem marcação de preenchimento automático e fonte com piso de 16px contra o zoom do iOS.",
        wide: true,
        layout: "stack",
        example: (
          <div className={styles.samples}>
            <Sample label="size">
              <Stack gap={3} style={{ width: "100%" }}>
                <Input size="sm" placeholder="Pequeno" />
                <Input size="md" placeholder="Médio" />
                <Input size="lg" placeholder="Grande" />
              </Stack>
            </Sample>
            <Sample label="estado">
              <Stack gap={3} style={{ width: "100%" }}>
                <Input defaultValue="Com dado preenchido" />
                <Input invalid defaultValue="Valor recusado" />
                <Input disabled placeholder="Desabilitado" />
              </Stack>
            </Sample>
            <Sample label="mask de documento e contato">
              <Stack gap={3} style={{ width: "100%" }}>
                <Input mask="cpf" placeholder="000.000.000-00" />
                <Input mask="cnpj" placeholder="00.000.000/0000-00" />
                <Input mask="document" placeholder="CPF ou CNPJ, troca sozinho" />
                <Input mask="phone" placeholder="(00) 00000-0000" />
                <Input mask="cep" placeholder="00000-000" />
              </Stack>
            </Sample>
            <Sample label="mask de número">
              <Stack gap={3} style={{ width: "100%" }}>
                <Input mask="currency" placeholder="0,00" />
                <Input mask="percent" placeholder="0,00" />
                <Input mask="integer" placeholder="0" />
              </Stack>
            </Sample>
          </div>
        ),
      },
      {
        name: "DatePicker",
        note: "Data por seleção, não por digitação. Calendário em pt-BR com mês e ano em listas próprias, no lugar do select nativo. Abre em portal para nunca ficar atrás de outro campo e entrega o valor ISO num campo oculto para o formulário.",
        wide: true,
        layout: "stack",
        example: (
          <div className={styles.samples}>
            <Sample label="size">
              <Stack gap={3} style={{ width: "100%" }}>
                <DatePicker size="sm" />
                <DatePicker size="md" />
                <DatePicker size="lg" />
              </Stack>
            </Sample>
            <Sample label="estado">
              <Stack gap={3} style={{ width: "100%" }}>
                <DatePicker defaultValue={new Date(2026, 8, 15)} />
                <DatePicker invalid />
                <DatePicker disabled />
              </Stack>
            </Sample>
          </div>
        ),
      },
      {
        name: "Field",
        note: "Rótulo em cima, campo embaixo, tudo alinhado à esquerda. O erro só aparece depois que o campo é preenchido e perde o foco: ícone na ponta do campo com a bolha fixa acima, seta no centro do ícone.",
        layout: "stack",
        example: (
          <Stack gap={5}>
            <Field label="E-mail" hint="Usamos para enviar o orçamento ao cliente" required>
              <Input type="email" name="email" placeholder="cliente@empresa.com.br" autoComplete="email" />
            </Field>
            <Field label="CNPJ" error="Informe um CNPJ válido">
              <Input mask="cnpj" name="cnpj" placeholder="00.000.000/0000-00" />
            </Field>
            <Field label="Telefone" error="Informe um telefone com DDD" revealError>
              <Input mask="phone" name="telefone" placeholder="(00) 00000-0000" />
            </Field>
            <Field label="Vencimento" hint="Primeira cobrança do contrato" required>
              <DatePicker name="vencimento" />
            </Field>
          </Stack>
        ),
      },
    ],
  },
  {
    title: "Feedback",
    entries: [
      {
        name: "Progress",
        note: "Sempre tracejada, com canto suave no traço. size controla a altura e segments a densidade, que é o que define a largura de cada traço.",
        wide: true,
        layout: "stack",
        example: (
          <div className={styles.samples}>
            <Sample label="size, variação de altura">
              <Stack gap={3} style={{ width: "100%" }}>
                <Progress value={89} size="xs" tone="success" />
                <Progress value={89} size="sm" tone="success" />
                <Progress value={89} size="md" tone="success" />
                <Progress value={89} size="lg" tone="success" />
                <Progress value={89} size="xl" tone="success" />
              </Stack>
            </Sample>
            <Sample label="segments, variação de largura">
              <Stack gap={3} style={{ width: "100%" }}>
                <Progress value={67} segments={64} />
                <Progress value={67} segments={32} />
                <Progress value={67} segments={16} />
                <Progress value={67} segments={4} />
              </Stack>
            </Sample>
            <Sample label="tone">
              <Stack gap={3} style={{ width: "100%" }}>
                <Progress value={40} tone="accent" />
                <Progress value={40} tone="success" />
                <Progress value={40} tone="warning" />
                <Progress value={40} tone="danger" />
              </Stack>
            </Sample>
            <Sample label="indeterminada">
              <Stack gap={3} style={{ width: "100%" }}>
                <Progress />
                <Progress size="lg" tone="warning" segments={16} />
              </Stack>
            </Sample>
          </div>
        ),
      },
      {
        name: "Spinner",
        note: "Dois arcos opostos girando em rotação contínua. Portado do dual arc do loading-ui para CSS Module com tokens.",
        example: (
          <>
            <Spinner size="sm" />
            <Spinner />
            <Spinner size="lg" />
          </>
        ),
      },
      {
        name: "Skeleton",
        note: "Espaço reservado enquanto o conteúdo carrega.",
        layout: "stack",
        example: (
          <Stack gap={3}>
            <Inline gap={3}>
              <Skeleton shape="circle" />
              <Stack gap={2} style={{ flex: 1 }}>
                <Skeleton width="60%" />
                <Skeleton width="85%" />
              </Stack>
            </Inline>
            <Inline gap={3}>
              <Skeleton shape="circle" height="1.5rem" />
              <Skeleton shape="circle" height="2rem" />
              <Skeleton shape="circle" height="3rem" />
            </Inline>
            <Skeleton shape="rect" height="3rem" />
          </Stack>
        ),
      },
    ],
  },
  {
    title: "Dados",
    entries: [
      {
        name: "Table",
        note: "Tabela rolando dentro do próprio container, com cabeçalho fixo.",
        wide: true,
        layout: "stack",
        example: (
          <TableScroll label="Orçamentos recentes">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Cliente</TableHeaderCell>
                  <TableHeaderCell>Situação</TableHeaderCell>
                  <TableHeaderCell align="end">Valor</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Estúdio Bravo</TableCell>
                  <TableCell>Aprovado</TableCell>
                  <TableCell align="end">R$ 18.400,00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Padaria Aurora</TableCell>
                  <TableCell>Enviado</TableCell>
                  <TableCell align="end">R$ 6.250,00</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableScroll>
        ),
      },
    ],
  },
  {
    title: "Navegação e marca",
    entries: [
      {
        name: "TextLink",
        note: "Link de texto com sublinhado no hover ou sempre.",
        example: (
          <>
            <TextLink href="/precos">Ver preços</TextLink>
            <TextLink href="/termos" underline="always">
              Termos de uso
            </TextLink>
            <TextLink href="/privacidade" tone="inherit">
              Privacidade
            </TextLink>
          </>
        ),
      },
      {
        name: "Tooltip",
        note: "Bolha invertida com seta, no padrão do shadcn. Entra com fade e zoom, fecha com Escape, e a seta cai sempre no centro do gatilho, seja qual for o alinhamento.",
        example: (
          <>
            <Tooltip content="Centralizado no gatilho">
              <Button variant="outline" size="sm">
                Centro
              </Button>
            </Tooltip>
            <Tooltip content="Bolha para a esquerda, seta no centro" align="end">
              <Button variant="outline" size="sm">
                Fim
              </Button>
            </Tooltip>
            <Tooltip content="Bolha para a direita, seta no centro" align="start">
              <Button variant="outline" size="sm">
                Início
              </Button>
            </Tooltip>
            <Tooltip content="Abaixo, quando houver espaço" side="bottom">
              <Button variant="outline" size="sm">
                Abaixo
              </Button>
            </Tooltip>
          </>
        ),
      },
      {
        name: "Kbd",
        note: "Tecla ou atalho de teclado.",
        example: (
          <>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
            <Kbd>Esc</Kbd>
          </>
        ),
      },
      {
        name: "Logo",
        note: "Marca por máscara CSS, acompanha o tema.",
        example: (
          <>
            <Logo variant="icon" height={32} />
            <Logo variant="logo" height={32} />
            <Logo variant="logotipo" height={22} />
          </>
        ),
      },
    ],
  },
];

const pending = [
  {
    area: "ui",
    names: [
      "Avatar",
      "Badge",
      "Card",
      "Checkbox",
      "Dialog",
      "DropdownMenu",
      "EmptyState",
      "Radio",
      "Select",
      "Switch",
      "Tabs",
      "Textarea",
      "Toast",
    ],
  },
  {
    area: "layout",
    names: [
      "AppShell",
      "AuthCard",
      "CommandPalette",
      "PageHeader",
      "Sidebar",
      "SiteFooter",
      "SiteHeader",
      "ThemeToggle",
      "Topbar",
    ],
  },
  { area: "providers", names: ["ToastProvider"] },
];

const readyCount = groups.reduce((total, group) => total + group.entries.length, 0);
const pendingCount = pending.reduce((total, area) => total + area.names.length, 0);

export default function ComponentesPage() {
  return (
    <main className={styles.page}>
      <Container>
        <header className={styles.header}>
          <Logo variant="logotipo" height={22} />
          <Text as="h1" variant="largeTitle">
            Componentes
          </Text>
          <Text tone="secondary">
            Vitrine para construir e organizar o design system. Cada caixote traz o nome, uma nota curta e um exemplo
            vivo. Confira sempre nos dois temas antes de dar um componente como pronto.
          </Text>
        </header>

        <div className={styles.stats}>
          <div className={styles.stat} {...squircle("lg", { color: "var(--color-separator)" })}>
            <Text as="p" variant="title2" numeric>
              {readyCount}
            </Text>
            <Text variant="footnote" tone="secondary">
              prontos
            </Text>
          </div>
          <div className={styles.stat} {...squircle("lg")}>
            <Text as="p" variant="title2" numeric>
              {pendingCount}
            </Text>
            <Text variant="footnote" tone="secondary">
              pendentes
            </Text>
          </div>
          <div className={styles.stat} {...squircle("lg")}>
            <Text as="p" variant="title2" numeric>
              {groups.length}
            </Text>
            <Text variant="footnote" tone="secondary">
              grupos
            </Text>
          </div>
        </div>

        <div className={styles.groups}>
          {groups.map((group) => (
            <section key={group.title} className={styles.group}>
              <div className={styles.groupHead}>
                <Text as="h2" variant="title3">
                  {group.title}
                </Text>
                <Text variant="footnote" tone="tertiary" numeric>
                  {group.entries.length}
                </Text>
              </div>

              <div className={styles.grid}>
                {group.entries.map((entry) => (
                  <article
                    key={entry.name}
                    className={styles.box}
                    data-wide={entry.wide || undefined}
                    {...squircle("2xl", { color: "var(--color-separator)" })}
                  >
                    <div className={styles.boxHead}>
                      <Text as="h3" variant="headline">
                        {entry.name}
                      </Text>
                      <span className={styles.chip} data-state="ready">
                        pronto
                      </span>
                    </div>
                    <Text variant="footnote" tone="secondary">
                      {entry.note}
                    </Text>
                    <div className={styles.demo} data-layout={entry.layout ?? "row"} {...squircle("md")}>
                      {entry.example}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}

          <section className={styles.group}>
            <div className={styles.groupHead}>
              <Text as="h2" variant="title3">
                Ainda não implementados
              </Text>
              <Text variant="footnote" tone="tertiary" numeric>
                {pendingCount}
              </Text>
            </div>

            {pending.map((area) => (
              <div key={area.area} className={styles.pendingGroup}>
                <Text as="h3" variant="subheadline" weight="semibold" font="code">
                  {area.area}
                </Text>
                <div className={styles.pendingGrid}>
                  {area.names.map((name) => (
                    <div
                      key={name}
                      className={styles.pendingItem}
                      {...squircle("md", { color: "var(--color-separator)" })}
                    >
                      <span>{name}</span>
                      <span className={styles.chip} data-state="pending">
                        stub
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      </Container>
    </main>
  );
}
