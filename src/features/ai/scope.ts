/**
 * O que o assistente pode ler para responder. Existe porque a resposta é tão boa quanto o que ela leu, e
 * quem pergunta às vezes quer o contrário: "olhe só o funil", para a resposta não misturar a conta inteira.
 *
 * É a opção que a coluna lateral não tem espaço para oferecer, e a página cheia tem: lá o que vai junto da
 * pergunta é a tela aberta atrás, que já diz o assunto; aqui não há tela atrás nenhuma, então quem diz o
 * assunto é a escolha das fontes.
 *
 * **Sem glifo aqui dentro** (acerto de 2026-09-16): o schema do zod lê esta lista para montar o enum, e o
 * schema é lido pela Server Action e pela rota de `api/v1`. Com os ícones morando aqui, a rota arrastava a
 * biblioteca inteira de ícones para o servidor e quebrava na montagem, com `createContext is not a
 * function`. É o mesmo motivo que tirou o `slugify` de perto do zod. O glifo de cada fonte mora ao lado de
 * quem o desenha, como o do modo de resposta já fazia.
 */
export type AiScopeId = "crm" | "orcamentos" | "contratos" | "clientes" | "projetos" | "tarefas" | "financeiro";

/* Na ordem do dinheiro: de onde a venda nasce até o que ela vira. */
export const aiScopeIds = ["crm", "orcamentos", "contratos", "clientes", "projetos", "tarefas", "financeiro"] as const;

export const aiScopeLabels: Record<AiScopeId, string> = {
  crm: "Funil de vendas",
  orcamentos: "Orçamentos",
  contratos: "Contratos",
  clientes: "Clientes",
  projetos: "Projetos",
  tarefas: "Tarefas",
  financeiro: "Financeiro",
};

/** Tudo ligado: quem não escolheu nada quer a conta inteira, que é o que o assistente serve para ler. */
export const defaultAiScope: readonly AiScopeId[] = aiScopeIds;

/** O que a pílula do compositor diz: o nome da fonte quando é uma só, a contagem quando são algumas. */
export function aiScopeLabel(scope: readonly AiScopeId[]) {
  if (scope.length >= aiScopeIds.length) return "Toda a conta";
  if (scope.length === 0) return "Sem fonte";
  if (scope.length === 1) return aiScopeLabels[scope[0]];
  return `${scope.length} fontes`;
}
