import { siteConfig } from "@/lib/metadata";
import type { Contract } from "./summary";

/** O endereço público de assinatura de **uma parte**, o que ela recebe por e-mail: absoluto, para colar em qualquer lugar. */
export function contractSignUrl(partyToken: string) {
  return `${siteConfig.url}/contrato/${partyToken}`;
}

/** O nome do documento salvo, o que a pessoa vê na pasta de downloads dela: o número e para quem é. */
export function contractDocumentName(contract: Contract) {
  const who = contract.client?.company ?? contract.client?.name;
  return who ? `Contrato ${contract.reference}, ${who}` : `Contrato ${contract.reference}`;
}
