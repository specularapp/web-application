# Relatório da revisão funcional

Data: 20 de setembro de 2026

## Resultado e escopo

Revisão do código, banco conectado, APIs e navegação da aplicação local. Foram corrigidas falhas reproduzidas e problemas encontrados nos componentes compartilhados. As alterações anteriores e o trabalho simultâneo de outra sessão foram preservados.

A validação cobre carregamento de páginas, operações selecionadas com persistência real, integridade do banco e comportamento responsivo. Não constitui garantia de ausência de qualquer defeito ou execução de todas as combinações de ações de cada página.

## Correções realizadas

| Área | Problema | Correção |
| --- | --- | --- |
| Clientes e fornecedores | Código consultava `clients.kind` sem a migração correspondente aplicada | Aplicada a migração pendente que distingue cliente, fornecedor e ambos |
| Modais e páginas de detalhes | Portal acessava `document` durante renderização no servidor, causando erro 500 | Portal aguarda montagem no navegador, com estado inicial consistente entre servidor e cliente |
| Navegação por teclado | Modal sem controles focáveis não mantinha corretamente o foco | Ajustado tratamento de Tab e Shift+Tab no painel |
| Barra de ações do celular | Janelas na mesma profundidade sobrescreviam ou removiam as ações umas das outras | Registro por identidade da janela e prioridade de camada, com desempate estável |
| CRM e tarefas | Troca entre desktop e celular mudava a lista de sensores, gerando erro de hooks | Mantida a lista estável, preservando a desativação de arrasto nos cartões móveis |
| CRM, tarefas e organização do painel | Identificadores do arrasto divergiam entre servidor e navegador | Contextos usam identificadores estáveis com `useId` |
| Cabeçalho | Migalhas com o mesmo nome produziam chaves React duplicadas | Chaves consideram posição e nome |
| Campos de formulário | `iconEnd` era repassado a controles que não suportavam a propriedade | Adorno de erro limitado aos controles compatíveis, mensagem visível nos demais e preservação de `aria-describedby` |
| Nova despesa e cobrança | Validação de certos campos falhava sem mensagem geral visível | Erros do servidor aparecem no formulário, inclusive quando não há campo específico renderizado |
| Fornecedor avulso | Nome com um caractere passava pela entrada e falhava no banco | Validação antecipada de nome não vazio com pelo menos dois caracteres |
| Parcelamento | Interface oferecia até 12 parcelas, embora o contrato aceitasse 24 | Seletor passa a usar o limite central do domínio |
| Datas | Expressão regular aceitava datas impossíveis | Validação de calendário em financeiro, projetos, tarefas, CRM e orçamentos |
| Baixa de parcela | Transação, parcela e histórico eram gravados separadamente | Função SQL transacional com bloqueio da cobrança e parcela, validação de acesso e gravação conjunta |
| Baixas simultâneas | Duas requisições podiam gerar movimentações duplicadas | Serialização no banco e recusa da segunda baixa |
| Reabertura e cancelamento | Operações separadas podiam deixar financeiro inconsistente | Mesma função transacional reabre parcela e remove a movimentação; cancelamento recusa cobrança com parcela paga |
| Recorrência | Falha ao gerar próxima cobrança podia ficar silenciosa ou deixar cobrança sem parcelas | Retorno de aviso após pagamento confirmado e limpeza da nova cobrança quando a criação de parcelas falha |
| Encerrar recorrência | Modal podia continuar mostrando dados anteriores | Registro aberto é atualizado com a resposta da operação |
| Nova movimentação | Cliques repetidos e fechamento durante gravação não tinham trava imediata | Referência de gravação impede submissão repetida e fechamento durante a operação |
| Formulários e configurações | Rejeições inesperadas de Server Actions podiam deixar estado de carregamento preso | Uso do tratamento compartilhado `callAction` em tarefas, CRM, currículo, portfólio, domínio, notificações e segurança |
| Nova tarefa | Seleção geral podia usar etapa ausente no projeto escolhido | Etapas disponíveis e etapa enviada acompanham o projeto selecionado |
| APIs de domínio | Escritas não invalidavam o cache utilizado pelas páginas | Revalidação compartilhada em clientes, catálogo, projetos, tarefas, CRM, orçamentos, contratos, cobranças, despesas e automações |
| API de imagens | Anexar ou remover imagem podia manter leituras antigas | Mapa de cache compartilhado com as Server Actions |
| Respostas da API | Sucesso sem dados tentava serializar `undefined`, causando 500 após gravar | Resposta JSON explícita `{ ok: true }` nesses casos |
| API financeira | Ausência de endpoints para movimentação e baixa/reabertura equivalentes à web | Adicionados POST de movimentação e POST/DELETE de parcela reutilizando os serviços e validações |

## Banco e arquivos principais

- Aplicada `db/migrations/clients/20260920200000_add_client_kind.sql`, que já estava no diretório de trabalho.
- Criada e aplicada `db/migrations/finance/20260921010000_make_installment_changes_atomic.sql`.
- Atualizados os tipos gerados em `src/types/database.ts`.
- Criado `scripts/probe-application.mjs`, executável por `npm run test:application`.
- Correções compartilhadas em `src/components/ui/dialog`, `src/components/ui/field`, `src/components/layout/floating-actions` e `src/lib/api/domain.ts`.
- Serviços, schemas e formulários alterados nos domínios descritos na tabela.

A rotina de migração também aplicou uma migração de capa de perfil que surgiu durante o trabalho simultâneo da outra sessão. Essa funcionalidade não foi criada nesta revisão.

## Cobertura das páginas

As 43 URLs autenticadas abaixo passaram pela renderização HTTP com sessão real de teste. As 23 telas principais também foram abertas no navegador autenticado nas larguras de 1280 e 320 pixels, sem transbordamento horizontal do documento nas medições realizadas.

| Domínio | Páginas renderizadas | Operações adicionais verificadas |
| --- | --- | --- |
| Painel | `/dashboard` | Leitura da API do painel |
| Clientes | `/clientes`, `/clientes/novo`, `/clientes/[id]` | Criar, editar, listar, excluir e atualização de cache pela API |
| Catálogo | `/catalogo`, `/catalogo/novo`, `/catalogo/[id]` | Criar serviço e listar |
| Projetos | `/projetos`, `/projetos/novo`, `/projetos/[id]`, `/projetos/[id]/editar` | Criar, listar e excluir |
| Tarefas | `/tarefas`, `/tarefas/[projeto]` | Criar, mudar etapa, reler, excluir e confirmar 404 após exclusão |
| CRM | `/crm`, `/crm/sem-funil` | Criar e listar oportunidade; abrir ficha, abrir edição e cancelar no navegador |
| Orçamentos | `/orcamentos`, `/orcamentos/novo`, `/orcamentos/[id]` | Criar rascunho e listar |
| Contratos | `/contratos`, `/contratos/novo`, `/contratos/[id]`, `/contratos/[id]/editar` | Criar rascunho e listar |
| Cobranças | `/cobrancas`, `/cobrancas/nova`, `/cobrancas/[id]` | Criar, listar e conferir soma exata das parcelas |
| Despesas | `/despesas`, `/despesas/nova`, `/despesas/[id]` | Criar despesa avulsa; baixar, reabrir e cancelar; testar concorrência e recusa de entradas inválidas |
| Financeiro | `/financeiro` | Criar entrada e saída avulsas, conferir movimentação gerada pela baixa e sua remoção na reabertura |
| Automações | `/automacoes`, `/automacoes/nova`, `/automacoes/[id]` | Criar rascunho e listar |
| IA | `/ia` | Carregamento da tela |
| Presença | `/portfolio`, `/curriculo` | Carregamento e revisão do tratamento de gravação |
| Conquistas | `/conquistas` | Carregamento |
| Configurações | `/configuracoes`, `/configuracoes/equipe`, `/configuracoes/seguranca`, `/configuracoes/notificacoes`, `/configuracoes/dominio`, `/configuracoes/integracoes`, `/configuracoes/plano` | Carregamento, leituras de organizações e planos, revisão de erros nos formulários selecionados |

Também foram conferidos por HTTP:

- Login, cadastro, recuperação de senha, confirmação de e-mail e redefinição de senha respondem sem erro de renderização.
- MFA, painel e convite sem sessão redirecionam para login.
- Portfólio, currículo, orçamento, contrato e cobrança com identificador inválido retornam 404.

No navegador, o formulário de nova despesa exibiu validação após envio vazio, apresentou 24 opções de parcelamento e coube na largura mínima. Os gráficos carregados somente no cliente foram diferenciados de erros reais na sonda HTTP.

## Testes e reprodução

1. Iniciar a aplicação com `npm run dev`.
2. Configurar as variáveis Supabase já utilizadas pelo projeto.
3. Executar `npm run test:application`.
4. Executar `npm run db:probe`.
5. Executar `npm run typecheck`, `npm run lint` e `npm run build`.

A sonda da aplicação cria um usuário e uma organização temporários no banco configurado, usa JWT normal nas operações e remove seus registros ao terminar. A chave administrativa é usada apenas na preparação e limpeza. Portanto, a sonda exige acesso ao banco e faz escritas de teste, não é um teste puramente local sem efeitos externos.

Resultados:

| Verificação | Resultado |
| --- | --- |
| `npm run test:application` | 102 de 102 verificações passaram |
| `npm run db:probe` | 30 de 30 verificações passaram |
| Renderização autenticada | 43 URLs sem falha detectada pela sonda |
| Navegação responsiva | 23 telas principais em desktop e celular, sem transbordamento horizontal nas medições |
| Rotas públicas e proteção de sessão | 13 requisições com resposta ou redirecionamento esperado |
| `npm run typecheck` | Passou |
| `npm run lint` | Passou |
| `npm run build` | Passou após os últimos ajustes, com 77 páginas estáticas geradas |
| `git diff --check` | Passou |

## Limites da verificação

- Não foram realizados pagamentos reais, contratação de plano, assinaturas de documentos, envio de e-mails a clientes, convites reais, alteração de senha/MFA do usuário ou publicação de domínio.
- IA, Stripe, Resend e n8n não passaram por uma execução completa com efeitos externos nesta revisão.
- Uploads, PDFs, compartilhamentos com token válido e todas as variações de permissões de membros não receberam testes completos de ponta a ponta.
- A verificação responsiva mediu carregamento e transbordamento; não é uma auditoria completa de acessibilidade, contraste ou todos os controles por teclado.
- O teste de pagamento confirma atomicidade da baixa, reabertura e cancelamento. A geração da próxima recorrência continua sendo uma operação posterior, com aviso de falha; não faz parte da mesma transação SQL.
- A compilação é local. Não foi feito deploy.
- O diretório contém alterações anteriores e simultâneas de outras sessões. O relatório distingue as correções desta revisão e não atribui a ela todo o diff do repositório.
