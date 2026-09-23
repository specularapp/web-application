import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import { EmotionRegistry } from "@/components/providers/emotion-registry";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CelebrationProvider } from "@/components/providers/celebration-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { FloatingActionsProvider } from "@/components/layout/floating-actions";
import { isAuthPath } from "@/lib/auth-paths";
import { isHomologation } from "@/lib/env";
import { siteConfig } from "@/lib/metadata";
import { readThemeCookie, themeAttribute } from "@/lib/theme";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

/* A monoespaçada entrou com o bloco de código do texto rico (2026-09-22): ali a fonte não é estilo, é
   função, porque é o alinhamento das colunas que faz a indentação de um trecho de código ser legível, e com
   a Inter cada linha começava num lugar. Vale também para a tecla do atalho e para o `code` no meio do
   texto, que são os outros lugares que já pediam `--font-code`. Só o latino e com `swap`, como a de texto. */
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

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
  // Escuro é o padrão do produto: sem preferência salva, nada de seguir o sistema. Quem escolheu
  // "Sistema" tem isso gravado, e aí o html fica sem atributo e o color-scheme segue o aparelho.
  const theme = authScreen ? "dark" : themeAttribute(preference);

  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${mono.variable}`}
      data-theme={theme}
      data-scroll={authScreen ? "locked" : undefined}
    >
      <body>
        <EmotionRegistry nonce={nonce}>
          {/* O feedback principal envolve o recibo: assim todo sucesso pode ganhar a janela contextual, e
              avisos e erros continuam chegando no canto sem cada tela precisar montar sua própria camada. */}
          {/* A barra flutuante do celular fica acima dos dois: a comemoração e a confirmação são janelas, e as
              ações delas moram na barra, então quem as registra precisa enxergar o provedor dela. */}
          <FloatingActionsProvider>
            <CelebrationProvider>
              <ToastProvider>{children}</ToastProvider>
            </CelebrationProvider>
          </FloatingActionsProvider>
          {isHomologation() && <ThemeToggle initial={preference ?? "dark"} />}
        </EmotionRegistry>
      </body>
    </html>
  );
}
