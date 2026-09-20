import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* Abrir o servidor de desenvolvimento para o celular e o tablet da mesma rede: o Next serve em 0.0.0.0 por
     padrão, mas recusa os recursos internos (HMR, /_next) quando a origem não é localhost. As faixas aqui são
     as privadas de rede local; nada disso vale em produção, onde a opção é ignorada. */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  poweredByHeader: false,
  typedRoutes: true,
  devIndicators: false,
  images: {
    // Mesmas origens já liberadas no img-src da CSP: logo do time no Storage e foto de quem entrou por OAuth.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  /* A Inter em arquivo vai junto com a rota do PDF do orçamento: o react-pdf lê a fonte do disco, e o
     rastreamento do build não enxerga essa leitura, porque o caminho é montado em tempo de execução. */
  outputFileTracingIncludes: {
    "/orcamento/*/pdf": ["./public/fonts/inter/**"],
    "/contrato/*/pdf": ["./public/fonts/inter/**"],
    "/api/contratos/*/pdf": ["./public/fonts/inter/**"],
  },
  experimental: {
    /* Estas quatro exportam por barril: sem a otimização, importar uma função traz o pacote inteiro para o
       pacote da rota. O Phosphor é o caso extremo, com mais de mil ícones. */
    optimizePackageImports: ["@phosphor-icons/react", "date-fns", "recharts", "@dnd-kit/core"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
