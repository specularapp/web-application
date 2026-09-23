# Relatório: acompanhamento de projeto e formulários públicos

Data: 22 de setembro de 2026

## Resultado entregue

Foram implementados dois fluxos completos. O primeiro cria um link público para o cliente acompanhar um
projeto. O segundo permite montar, publicar e receber formulários vinculados a um projeto, com criação ou
atualização do cliente na base e registro explícito do consentimento.

## 1. Acompanhamento público do projeto

- Nova rota pública `/acompanhar/[token]`.
- Ação `Copiar link do cliente` no menu de cada projeto.
- Composição refeita como uma página de rastreio compacta, sem capa decorativa ou efeitos fora do sistema.
- Cabeçalho com identidade da organização, situação, referência, projeto, cliente e previsão da entrega.
- Caminho horizontal das etapas e histórico vertical detalhado, com ícone, cor, situação e quantidade agregada
  de atividades.
- Cartões de detalhes e contexto usam os componentes `Surface` e `Card` do projeto.
- Projetos em 100% fecham visualmente todas as etapas, inclusive quando o progresso foi informado sem tarefas.
- Contato por e-mail e site da organização quando esses dados existem.
- Layout responsivo para computador e celular.

Por privacidade, o retorno público não inclui título ou descrição de tarefas, comentários, anexos, valores,
orçamentos, contratos, cobranças nem integrantes da equipe.

## 2. Construtor e formulário público

- Nova entrada `Formulários` no grupo Vendas do menu.
- Listagem em `/formularios` com busca, projeto, situação, identificador e contagem de respostas.
- Editor em tela inteira em `/formularios/novo` e `/formularios/[id]`.
- Seleção de projeto e de um cliente específico opcional.
- Título, introdução, texto do botão, validade, mensagem de sucesso e texto de consentimento configuráveis.
- Perguntas ordenadas por arraste com resposta curta, resposta longa, e-mail, telefone, data, escolha única e
  múltipla escolha.
- Organização das perguntas em páginas. Cada página pode exibir uma ou várias perguntas e a prévia permite
  percorrer o mesmo fluxo antes da publicação.
- Perguntas obrigatórias, texto de apoio, exemplo e opções customizáveis.
- Vínculo opcional da resposta com nome, e-mail, telefone, empresa, cargo, cidade, site ou descrição do cliente.
- Prévia ao vivo com a identidade visual do projeto.
- Estados de rascunho, publicado e encerrado.
- Nova rota pública `/formulario/[token]`, responsiva e acessível, com uma página por vez, barra de progresso,
  avanço pelo botão ou pela tecla Enter e navegação anterior e próxima.
- Campo de telefone com a máscara compartilhada do projeto, calendário pelo `DatePicker`, escolha única pelo
  `Select` e múltipla escolha pelo `Checkbox`.
- Validação por página antes do avanço e repetição das mesmas garantias no servidor.
- Página privada `/formularios/[id]/respostas` com identificação, respostas por pergunta e prova do
  consentimento. O mesmo conteúdo está disponível em `GET /api/v1/formularios/[id]/respostas`.
- Cards da listagem e das respostas migrados para o componente `Card` do design system.

No envio, o servidor relê a versão publicada do formulário, descarta chaves desconhecidas, valida tipo,
obrigatoriedade, opções e limites. A operação no banco é transacional: localiza o destinatário ou um cliente
com o mesmo e-mail, cria o cliente quando necessário, atualiza somente os campos mapeados e grava a resposta.

## Consentimento e rastreabilidade

- O checkbox de consentimento é obrigatório.
- O texto mostrado ao cliente é guardado como cópia junto da resposta.
- O horário da concordância é registrado em `consented_at`.
- Nome, e-mail e telefone extraídos também ficam na resposta para consulta e auditoria.
- O cadastro do cliente continua independente do formulário; excluir um formulário não apaga o cliente.

## Banco e segurança

- Tabelas novas: `intake_forms`, `intake_form_questions` e `intake_form_submissions`.
- Colunas de acompanhamento adicionadas a `projects`.
- RLS ativa em todas as tabelas novas e vínculos protegidos contra mistura de organizações.
- Tokens de 256 bits derivados por HMAC; somente o SHA-256 é salvo.
- Links de formulário expiram em 90 dias por padrão; links de acompanhamento são renovados por 180 dias.
- Gerar ou abrir o acompanhamento atualiza somente a telemetria do link; a data de atualização exibida continua
  representando uma alteração real no conteúdo do projeto.
- Funções públicas executáveis somente por `service_role`.
- Leitura pública limitada a 30 requisições por minuto por IP.
- Envio limitado a 8 tentativas em 15 minutos por link e IP.
- Metadados `noindex`, bloqueio no `robots.txt` e abertura explícita dos dois prefixos no proxy.

## API

- `GET` e `POST /api/v1/formularios`.
- `GET`, `PATCH` e `DELETE /api/v1/formularios/[id]`.
- `GET /api/v1/formularios/[id]/respostas`.
- `GET` e `POST /api/v1/formularios/publico/[token]`.
- `POST /api/v1/projetos/[id]/acompanhamento`.
- `GET /api/v1/projetos/publico/[token]`.

As rotas autenticadas usam o mesmo `service.ts` da interface web e continuam sob sessão, RLS e limite de
ações. As rotas públicas usam o cliente administrativo apenas depois do limite por IP e das funções fechadas
do banco.

## Validação executada

- Migrações aplicadas no Supabase hospedado e tipos TypeScript regenerados.
- Criação e publicação de um formulário pelo navegador autenticado.
- Abertura das duas páginas públicas sem cookie, ambas respondendo HTTP 200.
- Preenchimento e envio real de nome, e-mail e telefone sintéticos.
- Confirmação da criação do cliente, vínculo da resposta, normalização do telefone e gravação do texto e da
  data do consentimento.
- Confirmação de uma resposta na listagem privada.
- Exclusão do formulário de teste, resposta e cliente sintético, confirmando a limpeza completa.
- Geração do link de acompanhamento pelo menu real do projeto e inspeção visual da página pública.
- Navegação real entre duas páginas de um formulário temporário, incluindo uma página com duas perguntas,
  escolha única e múltiplos checkboxes. O formulário temporário foi removido após a prova.
- Abertura e inspeção da nova página privada de respostas com um envio real existente.
- Conectores de grupos e subgrupos do menu restaurados para o desenho tracejado anterior.
- `npm run typecheck`, `npm run lint` e `npm run build` executados ao final desta entrega.

## Padronização visual aplicada ao sistema

- Removidos `corner-shape`, superelipses, recortes por caminho e o motor JavaScript de cantos.
- Todos os componentes passaram a usar `border-radius` circular tradicional com uma escala curta entre 4 e
  16 px. Botões, campos e botões de ícone usam de 6 a 10 px; círculos, barras de progresso e pílulas
  semânticas continuam com raio completo.
- Modais independentes usam o fundo principal, que é preto no tema escuro. As fichas extensas de tarefa,
  oportunidade e projeto preservam a superfície de trabalho elevada por uma variante explícita.
- Menus, seletores e listas roláveis ganharam o mesmo degradê suave nas extremidades. A busca e os cabeçalhos
  permanecem fixos enquanto somente as opções rolam.
- A listagem de formulários passou a concentrar ações no menu compacto da casa. No celular, o editor mantém
  apenas Voltar, menu de ações e Publicar na barra superior.
- A página de respostas ganhou data compacta, quebra segura de contatos e máscara de telefone também no
  conteúdo respondido.
- O conector de grupos e subgrupos voltou ao tracejado anterior, sem o SVG introduzido na tentativa de
  redesenho.
