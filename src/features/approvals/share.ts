import { siteConfig } from "@/lib/metadata";

export const approvalUrl = (token: string) => `${siteConfig.url}/aprovacao/${token}`;
