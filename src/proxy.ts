import { NextResponse, type NextRequest } from "next/server";
import { CONFIRM_EMAIL_PATH, MFA_PATH, publicAuthPaths, RESET_PASSWORD_PATH } from "@/lib/auth-paths";
import { isHomologation } from "@/lib/env";
import { siteConfig } from "@/lib/metadata";
import { applyContentSecurityPolicy, buildContentSecurityPolicy, createNonce } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/proxy";

const marketingPaths = new Set(["/", "/precos", "/termos", "/privacidade", "/politica-de-privacidade"]);
const siteHosts = new Set([siteConfig.hosts.site, `www.${siteConfig.hosts.site}`]);
// A vitrine monta as telas de MFA de verdade, que chamam as actions: fora de homologação ela fica atrás do login.
const openPaths = isHomologation() ? new Set(["/componentes"]) : new Set<string>();
const authPaths = new Set<string>(publicAuthPaths);
const sharedPrefixes = ["/p/", "/cv/", "/orcamento/", "/contrato/", "/cobranca/"];
const openPrefixes = ["/auth/"];

function isPublic(pathname: string) {
  return (
    marketingPaths.has(pathname) ||
    openPaths.has(pathname) ||
    openPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    sharedPrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}

function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

// O token do e-mail vive na query, e withNext zera a busca: sem carregar a query no next,
// o link de confirmação morre no caminho do step-up.
function mfaTarget(pathname: string, search: string, isAuthPath: boolean) {
  if (!isAuthPath || pathname === RESET_PASSWORD_PATH) return pathname;
  if (pathname === CONFIRM_EMAIL_PATH) return `${pathname}${search}`;
  return "/dashboard";
}

function withNext(request: NextRequest, pathname: string, next: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  url.searchParams.set("next", next);
  return url;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  // A Vercel já redireciona o domínio nu para o www. Redirecionar de volta aqui criava
  // loop infinito, e era por isso que o www aparecia como fora do ar na verificação do Google.
  if (siteHosts.has(host) && !marketingPaths.has(pathname)) {
    return NextResponse.redirect(new URL(`${siteConfig.url}${pathname}${search}`), 308);
  }

  if (host === siteConfig.hosts.app && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const nonce = createNonce();
  const csp = buildContentSecurityPolicy(nonce);
  request.headers.set("x-nonce", nonce);
  request.headers.set("x-pathname", pathname);
  request.headers.set("Content-Security-Policy", csp);

  const { response, claims, mfaPending, mfaMissing } = await updateSession(request);
  const isAuthPath = authPaths.has(pathname);

  if (!claims) {
    if (isAuthPath || isPublic(pathname)) return applyContentSecurityPolicy(response, csp);
    return redirectWithCookies(withNext(request, "/login", pathname), response);
  }

  const bounceToDashboard = isAuthPath && pathname !== CONFIRM_EMAIL_PATH && pathname !== RESET_PASSWORD_PATH;

  if (mfaPending || mfaMissing) {
    if (pathname === MFA_PATH || isPublic(pathname)) return applyContentSecurityPolicy(response, csp);
    return redirectWithCookies(withNext(request, MFA_PATH, mfaTarget(pathname, search, isAuthPath)), response);
  }

  if (bounceToDashboard || pathname === MFA_PATH) {
    return redirectWithCookies(new URL("/dashboard", request.url), response);
  }

  return applyContentSecurityPolicy(response, csp);
}

// Sem cláusula `missing`: o exemplo da doc do Next isenta requisição de prefetch, e isentar
// significa rota protegida respondendo 200 sem sessão e sem CSP para quem manda o header na mão.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|logotipo|banners|bg|brands|3d-icons|manifest.webmanifest|robots.txt|sitemap.xml|opengraph-image).*)",
  ],
};
