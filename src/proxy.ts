import { NextResponse, type NextRequest } from "next/server";
import { MFA_PATH, publicAuthPaths } from "@/lib/auth-paths";
import { siteConfig } from "@/lib/metadata";
import { applyContentSecurityPolicy, buildContentSecurityPolicy, createNonce } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/proxy";

const marketingPaths = new Set(["/", "/precos", "/termos", "/privacidade"]);
const openPaths = new Set(["/componentes"]);
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

  if (host === `www.${siteConfig.hosts.site}`) {
    return NextResponse.redirect(new URL(`${siteConfig.siteUrl}${pathname}${search}`), 308);
  }

  if (host === siteConfig.hosts.site && !marketingPaths.has(pathname)) {
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

  if (mfaPending) {
    if (pathname === MFA_PATH || isPublic(pathname)) return applyContentSecurityPolicy(response, csp);
    return redirectWithCookies(withNext(request, MFA_PATH, isAuthPath ? "/dashboard" : pathname), response);
  }

  if (mfaMissing) {
    if (pathname === MFA_PATH || isPublic(pathname)) return applyContentSecurityPolicy(response, csp);
    return redirectWithCookies(withNext(request, MFA_PATH, isAuthPath ? "/dashboard" : pathname), response);
  }

  if (isAuthPath || pathname === MFA_PATH) {
    return redirectWithCookies(new URL("/dashboard", request.url), response);
  }

  return applyContentSecurityPolicy(response, csp);
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|logotipo|banners|bg|brands|manifest.webmanifest|robots.txt|sitemap.xml|opengraph-image).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
