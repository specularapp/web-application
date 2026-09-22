import type { Icon } from "@phosphor-icons/react";
import {
  BehanceLogoIcon,
  DribbbleLogoIcon,
  FacebookLogoIcon,
  FigmaLogoIcon,
  GithubLogoIcon,
  GlobeIcon,
  InstagramLogoIcon,
  LinkedinLogoIcon,
  PinterestLogoIcon,
  SpotifyLogoIcon,
  TelegramLogoIcon,
  ThreadsLogoIcon,
  TiktokLogoIcon,
  TwitchLogoIcon,
  WhatsappLogoIcon,
  XLogoIcon,
  YoutubeLogoIcon,
} from "@phosphor-icons/react/ssr";

/**
 * A rede por trás de um link do perfil, lida do endereço (2026-09-20, para a página da conta desenhar os
 * links como cartões na cor de cada rede, como na referência). O que a pessoa digita é só a URL; o glifo, o
 * nome padrão e o matiz saem daqui, pelos tokens da casa, e um endereço que não é de rede nenhuma é "Site".
 */
export type LinkNetwork = {
  id: string;
  label: string;
  icon: Icon;
  /** A cor da rede, sempre um token da casa. */
  hue: string;
};

const networks: (LinkNetwork & { hosts: string[] })[] = [
  { id: "instagram", label: "Instagram", icon: InstagramLogoIcon, hue: "var(--sys-pink)", hosts: ["instagram.com"] },
  { id: "linkedin", label: "LinkedIn", icon: LinkedinLogoIcon, hue: "var(--sys-blue)", hosts: ["linkedin.com"] },
  { id: "github", label: "GitHub", icon: GithubLogoIcon, hue: "var(--color-label)", hosts: ["github.com"] },
  { id: "youtube", label: "YouTube", icon: YoutubeLogoIcon, hue: "var(--sys-red)", hosts: ["youtube.com", "youtu.be"] },
  { id: "x", label: "X", icon: XLogoIcon, hue: "var(--color-label)", hosts: ["x.com", "twitter.com"] },
  { id: "tiktok", label: "TikTok", icon: TiktokLogoIcon, hue: "var(--color-label)", hosts: ["tiktok.com"] },
  { id: "threads", label: "Threads", icon: ThreadsLogoIcon, hue: "var(--color-label)", hosts: ["threads.net", "threads.com"] },
  { id: "behance", label: "Behance", icon: BehanceLogoIcon, hue: "var(--sys-indigo)", hosts: ["behance.net"] },
  { id: "dribbble", label: "Dribbble", icon: DribbbleLogoIcon, hue: "var(--sys-pink)", hosts: ["dribbble.com"] },
  { id: "figma", label: "Figma", icon: FigmaLogoIcon, hue: "var(--sys-purple)", hosts: ["figma.com"] },
  { id: "whatsapp", label: "WhatsApp", icon: WhatsappLogoIcon, hue: "var(--color-whatsapp)", hosts: ["wa.me", "whatsapp.com"] },
  { id: "telegram", label: "Telegram", icon: TelegramLogoIcon, hue: "var(--sys-cyan)", hosts: ["t.me", "telegram.me", "telegram.org"] },
  { id: "spotify", label: "Spotify", icon: SpotifyLogoIcon, hue: "var(--sys-green)", hosts: ["spotify.com"] },
  { id: "pinterest", label: "Pinterest", icon: PinterestLogoIcon, hue: "var(--sys-red)", hosts: ["pinterest.com", "pin.it"] },
  { id: "twitch", label: "Twitch", icon: TwitchLogoIcon, hue: "var(--sys-purple)", hosts: ["twitch.tv"] },
  { id: "facebook", label: "Facebook", icon: FacebookLogoIcon, hue: "var(--sys-blue)", hosts: ["facebook.com", "fb.com"] },
];

export const siteNetwork: LinkNetwork = { id: "site", label: "Site", icon: GlobeIcon, hue: "var(--sys-teal)" };

/** O domínio do endereço, sem `www.`; vazio quando o que foi digitado ainda não é um endereço. */
export function hostOf(url: string) {
  const raw = url.trim();
  if (!raw) return "";
  for (const candidate of [raw, `https://${raw}`]) {
    try {
      const host = new URL(candidate).hostname.replace(/^www\./, "").toLowerCase();
      if (host.includes(".")) return host;
    } catch {
      continue;
    }
  }
  return "";
}

export function networkOf(url: string): LinkNetwork {
  const host = hostOf(url);
  if (!host) return siteNetwork;
  return networks.find((network) => network.hosts.some((known) => host === known || host.endsWith(`.${known}`))) ?? siteNetwork;
}
