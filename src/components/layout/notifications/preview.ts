import type { AppNotification } from "./index";

const minutes = (value: number) => new Date(Date.now() - value * 60_000).toISOString();

/**
 * Notificações de exemplo enquanto o domínio não existe no banco. Quem montar a tabela troca só a
 * origem: o painel já recebe a lista por prop e não sabe de onde ela vem.
 */
export const previewNotifications: AppNotification[] = [
  {
    id: "1",
    kind: "sistema",
    title: "Atualização do sistema",
    description: "O prazo do orçamento #2451 muda para 20 de setembro",
    at: minutes(2),
    read: false,
  },
  {
    id: "2",
    kind: "acao",
    title: "Cadastro incompleto",
    description: "Olivia Bennett ainda não terminou a verificação de conta",
    at: minutes(5),
    read: false,
    actor: { name: "Olivia Bennett", avatarUrl: null },
  },
  {
    id: "3",
    kind: "revisao",
    title: "Contrato aguardando revisão",
    description: "Linda Dong enviou a segunda via do contrato para você conferir",
    at: minutes(10),
    read: false,
    actor: { name: "Linda Dong", avatarUrl: null },
    action: { label: "Revisar", href: "/contratos" },
  },
  {
    id: "4",
    kind: "acao",
    title: "Pagamento não recebido",
    description: "A cobrança do orçamento #2438 venceu sem confirmação",
    at: minutes(30),
    read: true,
  },
  {
    id: "5",
    kind: "revisao",
    title: "Documento recusado",
    description: "A proposta enviada para Andrew Deighan voltou com pendências",
    at: minutes(45),
    read: true,
    actor: { name: "Andrew Deighan", avatarUrl: null },
  },
  {
    id: "6",
    kind: "sistema",
    title: "Cliente respondeu a solicitação",
    description: "Linda Dong anexou o comprovante que faltava no projeto Aurora",
    at: minutes(1440),
    read: true,
    actor: { name: "Linda Dong", avatarUrl: null },
  },
];
