import { siteConfig } from "@/lib/metadata";

/** O link que o cliente recebe: só por token, que é a credencial. */
export const chargeUrl = (token: string) => `${siteConfig.url}/cobranca/${token}`;

/** O endereço da cobrança dentro da aplicação, para a equipe. */
export const chargePath = (id: string) => `/cobrancas/${id}`;
