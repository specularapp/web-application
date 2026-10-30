import type { Icon } from "@phosphor-icons/react";
import { ArrowsLeftRightIcon, BankIcon, CreditCardIcon, FlagIcon, HandCoinsIcon, PiggyBankIcon, ReceiptIcon, ScalesIcon, WalletIcon } from "@phosphor-icons/react/ssr";
import type { BadgeTone } from "@/components/ui/badge";
import type { Database } from "@/types/database";

/*
 * As contas bancárias e as transferências (2026-10-27, fase 2 da vinda do financeiro da Le Ange): os tipos que a
 * tela lê, o catálogo dos bancos e os rótulos. Puro, sem servidor, porque o cartão, o extrato e a janela de
 * transferir usam as mesmas peças do lado do cliente.
 */

export type AccountKind = Database["public"]["Enums"]["finance_account_kind"];
export type AccountHue = Database["public"]["Enums"]["palette_hue"];
export type MovementOrigin = Database["public"]["Enums"]["transaction_origin"];

/** Uma conta com o saldo de agora e o que entrou e saiu nela nos últimos 30 dias (só o que é da empresa). */
export type FinanceAccount = {
  id: string;
  name: string;
  kind: AccountKind;
  /** A chave do banco no catálogo (`itau`, `nubank`); nula no caixa ou num banco fora da lista. */
  bank: string | null;
  agency: string | null;
  lastDigits: string | null;
  hue: AccountHue;
  openingBalance: number;
  openingDate: string;
  isDefault: boolean;
  active: boolean;
  balance: number;
  recentIn: number;
  recentOut: number;
};

/** Um movimento confirmado de uma conta, como o extrato e a curva do cartão leem. */
export type AccountMovement = {
  id: string;
  accountId: string;
  kind: "in" | "out";
  amount: number;
  date: string;
  title: string;
  description: string;
  origin: MovementOrigin;
  createdAt: string;
};

export type FinanceTransfer = {
  id: string;
  reference: string;
  fromId: string;
  toId: string;
  amount: number;
  date: string;
  note: string;
  undone: boolean;
  createdAt: string;
};

export type AccountsScreenData = { accounts: FinanceAccount[]; movements: AccountMovement[]; today: string };

export type TransfersScreenData = { accounts: FinanceAccount[]; transfers: FinanceTransfer[]; today: string };

export const accountKinds: Record<AccountKind, { label: string; icon: Icon; tone: BadgeTone }> = {
  checking: { label: "Conta corrente", icon: BankIcon, tone: "blue" },
  savings: { label: "Poupança", icon: PiggyBankIcon, tone: "teal" },
  cash: { label: "Caixa", icon: WalletIcon, tone: "orange" },
  acquirer: { label: "Maquininha", icon: CreditCardIcon, tone: "purple" },
};

export const accountKindValues = ["checking", "savings", "cash", "acquirer"] as const satisfies readonly AccountKind[];

export const accountHueValues = ["blue", "indigo", "purple", "pink", "red", "orange", "yellow", "green", "mint", "teal", "cyan", "brown", "gray"] as const satisfies readonly AccountHue[];

/**
 * Os bancos que a tela conhece, com o matiz que a conta ganha ao escolher o banco. Os logos vêm do financeiro da
 * Le Ange (`public/bancos`, do repositório Bancos em SVG); `framed` marca os que são só o símbolo, sem fundo, e
 * ganham o quadrinho claro com borda para ficarem do tamanho dos que já vêm num quadrado. Desde 2026-10-29 (a
 * pedido: "faça todos os bancos terem a logo definitiva do banco") todos têm logo: os que faltavam vieram do
 * mesmo repositório, e Cielo e Rede, que não estão nele, do Wikimedia Commons.
 */
export const banks = {
  itau: { label: "Itaú", hue: "orange", logo: "/bancos/itau.svg", framed: false },
  bradesco: { label: "Bradesco", hue: "red", logo: "/bancos/bradesco.svg", framed: false },
  sicredi: { label: "Sicredi", hue: "green", logo: "/bancos/sicredi.svg", framed: true },
  stone: { label: "Stone", hue: "green", logo: "/bancos/stone.svg", framed: true },
  nubank: { label: "Nubank", hue: "purple", logo: "/bancos/nubank.svg", framed: false },
  inter: { label: "Inter", hue: "orange", logo: "/bancos/inter.svg", framed: true },
  bb: { label: "Banco do Brasil", hue: "yellow", logo: "/bancos/bb.svg", framed: false },
  caixa: { label: "Caixa Econômica", hue: "blue", logo: "/bancos/caixa.svg", framed: true },
  santander: { label: "Santander", hue: "red", logo: "/bancos/santander.svg", framed: false },
  c6: { label: "C6 Bank", hue: "gray", logo: "/bancos/c6.svg", framed: true },
  sicoob: { label: "Sicoob", hue: "teal", logo: "/bancos/sicoob.svg", framed: true },
  btg: { label: "BTG Pactual", hue: "indigo", logo: "/bancos/btg.svg", framed: true },
  cora: { label: "Cora", hue: "pink", logo: "/bancos/cora.svg", framed: false },
  mercadopago: { label: "Mercado Pago", hue: "cyan", logo: "/bancos/mercadopago.svg", framed: true },
  pagbank: { label: "PagBank", hue: "yellow", logo: "/bancos/pagbank.svg", framed: true },
  cielo: { label: "Cielo", hue: "blue", logo: "/bancos/cielo.svg", framed: true },
  rede: { label: "Rede", hue: "orange", logo: "/bancos/rede.svg", framed: true },
} as const satisfies Record<string, { label: string; hue: AccountHue; logo: string | null; framed: boolean }>;

export type BankKey = keyof typeof banks;

export const bankKeys = Object.keys(banks) as BankKey[];

export const bankOf = (key: string | null) => (key && key in banks ? banks[key as BankKey] : null);

/** O nome em duas linhas: o nome dado em cima e, embaixo, o banco. O tipo já vai na etiqueta do cartão, e repetir ali seria dizer duas vezes. */
export function accountIdentity(account: Pick<FinanceAccount, "name" | "bank" | "kind">) {
  return { title: account.name, subtitle: bankOf(account.bank)?.label ?? (account.kind === "cash" ? "Dinheiro em espécie" : "Banco não informado") };
}

/** A agência e o fim do número, para a segunda linha: "Ag. 0812 / ***1234". */
export const accountDigits = (account: Pick<FinanceAccount, "agency" | "lastDigits">) =>
  [account.agency && `Ag. ${account.agency}`, account.lastDigits && `***${account.lastDigits}`].filter(Boolean).join(" / ");

/** De onde veio o movimento, no extrato: só o que a empresa faz com o dinheiro. */
export const movementOrigins: Record<MovementOrigin | "opening", { label: string; tone: BadgeTone; icon: Icon }> = {
  opening: { label: "Abertura", tone: "neutral", icon: FlagIcon },
  manual: { label: "Lançamento", tone: "indigo", icon: ReceiptIcon },
  charge: { label: "Parcela", tone: "success", icon: HandCoinsIcon },
  transfer: { label: "Transferência", tone: "blue", icon: ArrowsLeftRightIcon },
  adjustment: { label: "Ajuste", tone: "purple", icon: ScalesIcon },
};

/** Só lançamento e parcela são dinheiro entrando ou saindo da empresa; o resto muda de conta ou acerta saldo. */
export const isFlow = (origin: MovementOrigin) => origin === "manual" || origin === "charge";

export const signedOf = (movement: Pick<AccountMovement, "kind" | "amount">) => (movement.kind === "in" ? movement.amount : -movement.amount);
