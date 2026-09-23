import { siteConfig } from "@/lib/metadata";

export const intakeFormUrl = (token: string) => `${siteConfig.url}/formulario/${token}`;
