import { addDays, format } from "date-fns";
import type { TasksSummary } from "./summary";

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");

/**
 * Resumo de exemplo enquanto o domínio não existe no banco. Quem montar a tabela troca só a origem: o
 * bloco recebe o resumo por prop e não sabe de onde ele vem. As datas são relativas a hoje, para a
 * prévia não envelhecer, e ninguém tem foto, para o rosto gerado pelo `Avatar` aparecer.
 */
export const previewTasksSummary: TasksSummary = {
  tasks: [
    {
      id: "k1",
      title: "Estilos de tipografia",
      description: "Fechar as escolhas de fonte e a hierarquia dos títulos.",
      dueDate: day(-1),
      status: "done",
      people: [{ name: "Miguel Santos", avatarUrl: null }, { name: "Angel Costa", avatarUrl: null }, { name: "Hane Lima", avatarUrl: null }],
    },
    {
      id: "k2",
      title: "Design system v2",
      description: "Componentes, diretrizes e tokens que formam a base do sistema.",
      dueDate: day(0),
      status: "ongoing",
      people: [{ name: "Miguel Santos", avatarUrl: null }, { name: "Jhon Pereira", avatarUrl: null }, { name: "Hane Lima", avatarUrl: null }],
    },
    {
      id: "k3",
      title: "Interface do usuário",
      description: "Apresentar os novos elementos e estilos de tela.",
      dueDate: day(1),
      status: "upcoming",
      people: [{ name: "Miguel Santos", avatarUrl: null }, { name: "Jhon Pereira", avatarUrl: null }, { name: "Hane Lima", avatarUrl: null }],
    },
    {
      id: "k4",
      title: "Proposta da Padaria Aurora",
      description: "Revisar o escopo e enviar a proposta para aprovação.",
      dueDate: day(3),
      status: "upcoming",
      people: [{ name: "Marina Duarte", avatarUrl: null }, { name: "Rafael Nunes", avatarUrl: null }],
    },
    {
      id: "k5",
      title: "Entrega do site institucional",
      description: "Publicar e passar os acessos para o cliente.",
      dueDate: day(6),
      status: "ongoing",
      people: [{ name: "Camila Ferreira", avatarUrl: null }, { name: "Linda Dong", avatarUrl: null }, { name: "Tiago Almeida", avatarUrl: null }],
    },
  ],
};
