import { siteConfig } from "@/lib/metadata";

export const feedbackUrl = (token: string) => `${siteConfig.url}/avaliacao/${token}`;
