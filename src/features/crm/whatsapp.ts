import { onlyDigits } from "@/lib/masks";

/** O nome com que a oportunidade nasce, antes de alguém dizer quem é: não é nome de gente, então não cumprimenta. */
export const PLACEHOLDER_CONTACT = "Novo lead";

/** O primeiro nome de quem está na ficha, ou vazio quando ela ainda tem o nome de nascença. */
export const contactFirstName = (name: string) => (name.trim() === PLACEHOLDER_CONTACT ? "" : (name.trim().split(/\s+/)[0] ?? ""));

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** O título que ainda é o de quando a oportunidade nasceu não diz o que a pessoa quer, então não entra no texto. */
const PLACEHOLDER_TITLE = "Nova oportunidade";

/**
 * A primeira mensagem para o contato da oportunidade (2026-10-26, a pedido, no padrão da ficha de lead da
 * pousada): cumprimenta pelo primeiro nome, apresenta quem responde pela venda e cita o assunto, quando a ficha
 * já tem um. Em negrito pelo asterisco, que é como o WhatsApp formata.
 */
export function opportunityGreeting({ contact, title, sender }: { contact: string; title: string; sender?: string }) {
  const name = contactFirstName(contact);
  const subject = title.trim() && title.trim() !== PLACEHOLDER_TITLE ? ` sobre *${title.trim()}*` : "";
  const intro = sender ? `Aqui é ${firstName(sender)}. ` : "";

  return [
    name ? `Oi, ${name}! Tudo bem?` : "Oi! Tudo bem?",
    "",
    `${intro}Recebi seu contato${subject} e queria entender melhor o que você precisa para te mandar uma proposta.`,
    "",
    "Podemos conversar por aqui?",
  ].join("\n");
}

/** O número no formato do `wa.me`: só dígitos, com o 55 quando a ficha guardou o telefone sem o país. */
export function whatsappNumber(phone: string) {
  const digits = onlyDigits(phone);
  if (digits.length < 10) return null;
  return digits.length <= 11 ? `55${digits}` : digits;
}

export const whatsappLink = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
