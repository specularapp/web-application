export type PatternMask = "cpf" | "cnpj" | "document" | "phone" | "cep" | "date";

export type NumericMask = "currency" | "percent" | "integer";

export type InputMask = PatternMask | NumericMask;

const CPF = "###.###.###-##";
const CNPJ = "##.###.###/####-##";
const PHONE = "(##) ####-####";
const MOBILE = "(##) #####-####";

const maxDigits: Record<PatternMask, number> = {
  cpf: 11,
  cnpj: 14,
  document: 14,
  phone: 11,
  cep: 8,
  date: 8,
};

const decimalFormatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integerFormatter = new Intl.NumberFormat("pt-BR");

export const numericAffix: Record<NumericMask, { prefix?: string; suffix?: string }> = {
  currency: { prefix: "R$" },
  percent: { suffix: "%" },
  integer: {},
};

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function patternOf(mask: PatternMask, digits: string) {
  switch (mask) {
    case "cpf":
      return CPF;
    case "cnpj":
      return CNPJ;
    case "document":
      return digits.length > 11 ? CNPJ : CPF;
    case "phone":
      return digits.length > 10 ? MOBILE : PHONE;
    case "cep":
      return "#####-###";
    case "date":
      return "##/##/####";
  }
}

export function trimToPattern(mask: PatternMask, value: string) {
  return onlyDigits(value).slice(0, maxDigits[mask]);
}

export function trimToNumeric(value: string) {
  return onlyDigits(value).slice(0, 15);
}

export function formatNumeric(mask: NumericMask, value: string) {
  const digits = onlyDigits(value);
  if (digits === "") return "";
  const amount = Number(digits);

  switch (mask) {
    case "currency":
    case "percent":
      return decimalFormatter.format(amount / 100);
    case "integer":
      return integerFormatter.format(amount);
  }
}

export function isNumericMask(mask: InputMask): mask is NumericMask {
  return mask in numericAffix;
}

export function toCents(value: number | undefined) {
  return value === undefined ? undefined : Math.round(value * 100);
}

export function fromCents(cents: number | undefined) {
  return cents === undefined ? undefined : cents / 100;
}
