# Specular

SaaS de gestão para freelancers e agências.

## Documentação

- [Regras](src/docs/rules.md): obrigatórias para qualquer alteração
- [Objetivo](src/docs/objective.md): visão do produto e módulos
- [Estrutura](src/docs/structure.md): stack, pastas e convenções
- [Setup](src/docs/setup.md): onde obter cada chave de API e configurar domínio
- [Segurança](src/docs/security.md): onde cada credencial vive, CSP, regras e plano
- [Tema](src/docs/theme.md): mapa do claro e escuro
- [Bibliotecas](src/docs/libs.md): o que usar para cada necessidade

## Setup

```
npm install
cp .env.example .env.local
npm run dev
```

## Scripts

| Comando | Ação |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servir o build |
| `npm run lint` | ESLint com regras de acessibilidade |
| `npm run typecheck` | Gera tipos de rota e roda o TypeScript |
