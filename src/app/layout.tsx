import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Playfair_Display } from "next/font/google";
import { cookies, headers } from "next/headers";
import { EmotionRegistry } from "@/components/providers/emotion-registry";
import { GooberNonce } from "@/components/providers/goober-nonce";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SquircleProvider } from "@/components/providers/squircle-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { isAuthPath } from "@/lib/auth-paths";
import { isHomologation } from "@/lib/env";
import { siteConfig } from "@/lib/metadata";
import { readThemeCookie } from "@/lib/theme";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "gestão para freelancers",
    "CRM para agências",
    "orçamento online",
    "contrato digital",
    "cobrança",
    "portfólio",
    "gestão financeira",
  ],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "business",
  formatDetection: { telephone: false, email: false, address: false },
  appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    url: "/",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: siteConfig.themeColor.light },
    { media: "(prefers-color-scheme: dark)", color: siteConfig.themeColor.dark },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  const nonce = headerStore.get("x-nonce") ?? undefined;
  const preference = readThemeCookie(cookieStore.get("theme")?.value);
  const authScreen = isAuthPath(headerStore.get("x-pathname"));
  const theme = authScreen ? "dark" : preference;

  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${geistMono.variable} ${playfair.variable}`}
      data-theme={theme}
      data-scroll={authScreen ? "locked" : undefined}
    >
      <body>
        <GooberNonce nonce={nonce} />
        <EmotionRegistry nonce={nonce}>
          <ToastProvider>{children}</ToastProvider>
          {isHomologation() && <ThemeToggle initial={preference ?? "system"} />}
        </EmotionRegistry>
        <SquircleProvider />
      </body>
    </html>
  );
}
