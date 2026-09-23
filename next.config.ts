import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /* O microfone é do próprio site: a conversa da tarefa grava áudio. Câmera e localização seguem fechadas. */
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
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
    /* As duas qualidades que a casa usa, e nenhuma outra: o otimizador recusa o que não está na lista, que é
       o que impede alguém de gerar mil variações da mesma imagem pelo nosso domínio. 75 é o padrão, e serve
       a rosto, logo e azulejo, que nunca passam de cinquenta pixels na tela; 90 fica para capa e banner, que
       ocupam a largura toda e em que o olho pega o que a compressão tirou. O arquivo guardado já é um WebP
       reduzido no navegador, então reencodar baixo duas vezes somaria perda de geração. */
    qualities: [75, 90],
    /* Trinta e um dias de cache do que o otimizador gerou. O endereço de cada imagem leva um identificador
       aleatório e nunca é reaproveitado, então não existe imagem trocada atrás do mesmo endereço: trocar
       cria endereço novo, e o cache velho simplesmente deixa de ser pedido. */
    minimumCacheTTL: 2678400,
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
