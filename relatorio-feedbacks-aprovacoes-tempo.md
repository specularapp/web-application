# Relatório: feedbacks, aprovações e apontamento de tempo

Data: 22 de setembro de 2026

## Resultado entregue

Foram implementados três fluxos completos e persistentes: avaliação curta após a entrega de um projeto,
aprovação de materiais com histórico de versões e registro de tempo em projetos ou tarefas.

## 1. Feedbacks do cliente

- Nova página privada `/feedbacks`, com busca, situação, projeto, cliente, nota e ação de copiar o link.
- Criação manual vinculada a um projeto, com título e mensagem editáveis.
- Integração com a conclusão do projeto: ao mudar o projeto para concluído, o sistema garante um único pedido
  de feedback e apresenta o link no aviso da ação.
- Nova página pública `/avaliacao/[token]`, curta e responsiva, com nota de 1 a 5, recomendação, comentário e
  nome opcional.
- Estado final de confirmação e leitura da resposta na central privada.
- Regra idempotente por projeto para impedir avaliações duplicadas em conclusões repetidas.

## 2. Aprovação de entregas

- Nova central privada `/aprovacoes` e ficha em `/aprovacoes/[id]`.
- Pedido vinculado ao projeto e, quando necessário, a uma tarefa.
- Versões numeradas com título e notas de alteração.
- Entrega por URL com prévia em `iframe` e link de abertura direta para sites que bloqueiam incorporação.
- Entrega por até 12 imagens PNG, JPEG, WebP ou AVIF, com limite de 10 MB por arquivo.
- Galeria de imagens na visão interna e na página pública.
- Nova página pública `/aprovacao/[token]`, com escolha de versões e decisão apenas sobre a versão atual.
- Ações de aprovar, solicitar alterações e rejeitar. Alteração e rejeição exigem justificativa; nome e
  comentário ficam registrados na versão.
- O status do pedido acompanha a decisão mais recente e uma nova versão volta o pedido para aguardando.

## 3. Cronômetro em projeto e tarefa

- Botão de iniciar ou parar na ficha do projeto e no cabeçalho da tarefa.
- Contador persistente fixo à direita, visível em toda a aplicação enquanto houver registro ativo.
- Hover com nome, identificador, horário de início, projeto relacionado e duração corrente.
- Parada manual pelo contador ou pelo botão do item, com duração final gravada em segundos.
- Iniciar outro item encerra com segurança o registro anterior.
- Restrição no banco garante apenas um cronômetro ativo por usuário.

## Banco, segurança e integrações

- Tabelas novas: `client_feedback`, `approval_requests`, `approval_versions`, `approval_assets`,
  `approval_decisions` e `time_entries`.
- RLS em todas as tabelas e gatilhos que impedem vínculos entre organizações diferentes.
- Tokens públicos derivados por HMAC; somente o hash é persistido.
- Links públicos expiram em 90 dias, usam `noindex`, prefixos explícitos no proxy e limite por link e IP.
- Leitura e escrita públicas passam por funções de banco liberadas somente para `service_role`.
- Storage `approval-files` limitado a imagens aceitas e 10 MB.
- APIs disponíveis em `/api/v1/feedbacks`, `/api/v1/aprovacoes`, `/api/v1/aprovacoes/arquivos` e
  `/api/v1/tempo`, com endpoints públicos específicos por token.
- Interface e API reutilizam os mesmos serviços de domínio e os mesmos schemas Zod.

## Validação executada

- Migrações aplicadas no Supabase hospedado e tipos TypeScript regenerados.
- Criação de feedback na sessão autenticada e envio real pela página pública.
- Confirmação no banco da nota, recomendação, comentário, nome e horário do envio.
- Criação de aprovação pela interface, publicação de uma versão por URL e abertura do link público.
- Publicação de uma versão por imagem com upload assinado, confirmação de `published_at`, renderização na
  galeria pública e remoção do objeto temporário do Storage.
- Solicitação de alterações com justificativa e confirmação do status e do comentário no histórico interno.
- Início do cronômetro pela ficha de um projeto, exibição do contador fixo e parada com duração persistida.
- Registros sintéticos de feedback, aprovação, decisão, versão e tempo removidos depois da prova.
- `npm run typecheck`, `npm run lint` e `npm run build` executados ao final.
