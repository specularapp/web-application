# Personalização do funil de vendas

Implementado em 21 de setembro de 2026.

## O que mudou

- Funis permitem escolher nome, ícone e cor ao criar ou editar.
- Pastas permitem escolher a cor ao criar ou editar.
- O editor de etapas permite criar, renomear, recolorir, reordenar e remover etapas, inclusive as predefinidas.
- Cada etapa indica se representa oportunidade aberta, venda ganha ou venda perdida. Esse resultado controla fechamento e contagens.
- Ao remover uma etapa, é possível escolher o destino das oportunidades. A configuração e a transferência são gravadas juntas; uma falha cancela a operação inteira.
- O banco impede que uma configuração esconda oportunidades em etapas removidas e restringe as definições à equipe correspondente.
- A movimentação de cartões agora persiste no banco, com retorno à etapa anterior se a chamada falhar.
- Fichas, menus, criação de oportunidades e mapa de relações reconhecem as etapas personalizadas.
- As mesmas regras estão disponíveis nas APIs de funis, pastas e movimentação de oportunidades.

## Como usar

No menu lateral de Funil de vendas, abra as opções do funil e escolha **Editar funil e ícone**. Para pastas, use **Editar pasta e cor**.

No quadro de um funil, clique em **Editar etapas**. A mesma janela está disponível em **Etapas do funil** no menu lateral. Escolha nomes, cores, resultados e ordem, indique destinos para etapas removidas e salve.

## Validação

- 36 verificações de integração aprovadas, com usuário e equipe temporários removidos ao final.
- Cobertura de persistência de ícone e cores, personalização de etapas predefinidas e novas, ordenação, fechamento, reabertura, migração de oportunidades, rollback e isolamento entre equipes.
- Conferência na interface autenticada do acesso aos editores, seleção de ícone, criação de etapa no formulário, reordenação, destino de remoção e cancelamento sem alterar o funil existente.
- Typecheck, lint e build de produção aprovados.
- Corrigidas incompatibilidades de tipos e imports com a alteração simultânea do módulo de tarefas, preservando as novas etapas dinâmicas.

A validação cobre este incremento do funil. Não representa uma nova auditoria integral de todas as páginas.

## Ficha da oportunidade e organização das etapas

- O botão de etapas usa apenas ícone. O editor ampliado apresenta nome, cor e resultado em colunas alinhadas, com separadores entre linhas.
- Setas de subir e descer substituídas por alça de arraste. Reordenação também disponível por teclado com espaço e setas, com anúncios para leitores de tela.
- Campos se reorganizam em telas pequenas, com conferência em 320 px.
- Nova oportunidade cria o registro e abre diretamente sua ficha. Sem título preenchido, o nome salvo é Nova oportunidade.
- A ficha preserva o desenho de leitura original. Título, descrição, valores e fatos viram campos somente quando clicados, seguindo a mesma interação usada em tarefas.
- Alterações são salvas automaticamente após uma pausa curta. Fechar a ficha força a gravação pendente antes de sair, sem abrir outro modal e sem manter botões de salvar na interface.
- Cabeçalho usa ícone de quadro e código da oportunidade, sem separadores por bolinha.
- Link ocupa a largura da seção e usa hash pelo código OPO. Abrir esse endereço carrega a oportunidade correspondente.
- Código PN, contato separado, primeira resposta e resposta média removidos da interface. Dados antigos desses campos são preservados ao editar outros campos.
- Caminho no funil tem linha contínua e destaque da etapa atual.
- Datas ausentes permanecem vazias; editar uma oportunidade fechada preserva a data original do fechamento.
- Mover a oportunidade para outro funil a retira do quadro anterior.

Validação deste incremento: 43 de 43 verificações de integração aprovadas; criação e edição na mesma ficha, título padrão e reabertura pelo hash conferidos no navegador; reordenação com mouse e teclado conferida sem salvar alterações de teste no funil do usuário. Registro temporário da interface removido após a conferência.

### Ajuste de densidade do editor

Modal reduzido de 64 rem para 46 rem, linhas e botões compactos, campos sem bordas permanentes e descrição explicativa removida. As seis etapas padrão cabem juntas no desktop. No celular, cada etapa ocupa duas linhas com nome, cor e resultado. Conferido em 320 px.

### Refinamento visual da ficha

- O seletor de cliente mostra avatar e nome, seguindo a mesma composição do responsável. Clientes sem foto continuam com o avatar gerado pelo sistema.
- Textos editáveis, nomes e valores fixos permanecem em uma linha e usam reticências quando a coluna não comporta o conteúdo completo.
- A linha do caminho no funil foi centralizada no eixo dos marcadores e fica atrás deles. Os marcadores têm fundo sólido, evitando cortes ou o traço visível dentro dos ícones.
- O seletor de origem mostra a identidade visual de cada canal na lista e no valor selecionado. Canais de marca usam seus logotipos e as demais opções usam ícones semânticos próprios.
