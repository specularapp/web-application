import { addDays, format } from "date-fns";
import { formatReference } from "@/lib/utils/reference";
import type { TaskPerson, TasksSummary } from "./summary";

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");
const at = (offset: number, time: string) => `${day(offset)}T${time}`;

const person = (name: string): TaskPerson => ({ name, avatarUrl: null });

const miguel = person("Miguel Santos");
const angel = person("Angel Costa");
const hane = person("Hane Lima");
const jhon = person("Jhon Pereira");
const marina = person("Marina Duarte");
const rafael = person("Rafael Nunes");
const camila = person("Camila Ferreira");
const linda = person("Linda Dong");
const tiago = person("Tiago Almeida");

/**
 * Resumo de exemplo enquanto o domínio não existe no banco. Quem montar a tabela troca só a origem: o
 * bloco recebe o resumo por prop e não sabe de onde ele vem. As datas são relativas a hoje, para a
 * prévia não envelhecer, e ninguém tem foto, para o rosto gerado pelo `Avatar` aparecer.
 */
export const previewTasksSummary: TasksSummary = {
  tasks: [
    {
      id: "k1",
      reference: formatReference("task", 2026, 28),
      title: "Estilos de tipografia",
      description:
        "Fechar as escolhas de fonte e a hierarquia dos títulos. A família fica em Inter em tudo, e a escala segue a da Apple, do título grande à legenda, com o mesmo espaçamento entre letras que já usamos nos botões.",
      dueDate: day(-1),
      startDate: day(-6),
      estimate: 240,
      status: "done",
      priority: "normal",
      owner: miguel,
      people: [miguel, angel, hane],
      project: { name: "Design system", reference: formatReference("project", 2026, 7) },
      tags: ["Design", "Tokens"],
      subtasks: [
        { id: "s1", title: "Escolher a família e os pesos", done: true, person: miguel },
        { id: "s2", title: "Definir a escala de tamanhos", done: true, person: angel },
        { id: "s3", title: "Publicar os tokens de texto", done: true, person: hane },
      ],
      attachments: [{ id: "a1", name: "Escala tipográfica", type: "image", url: "/banners/login-1-desktop.png", size: "72 KB", label: "Aprovado" }],
      activity: [
        { id: "e1", person: hane, action: "concluiu a tarefa", at: at(-1, "17:40") },
        { id: "e2", person: angel, action: "marcou a escala como pronta", at: at(-2, "11:15") },
        { id: "e3", person: miguel, action: "anexou a escala tipográfica", at: at(-4, "09:30") },
      ],
    },
    {
      id: "k2",
      reference: formatReference("task", 2026, 29),
      title: "Design system v2",
      description:
        "Componentes, diretrizes e tokens que formam a base do sistema. A segunda versão troca os cantos arredondados pela superelipse, revê as cores de preenchimento no tema escuro e documenta cada componente com os estados de foco e de erro.",
      dueDate: day(0),
      startDate: day(-4),
      estimate: 960,
      status: "ongoing",
      priority: "high",
      owner: miguel,
      people: [miguel, jhon, hane],
      project: { name: "Design system", reference: formatReference("project", 2026, 7) },
      tags: ["Design", "Componentes", "Tokens"],
      subtasks: [
        { id: "s1", title: "Revisar os tokens de cor no tema escuro", done: true, person: hane },
        { id: "s2", title: "Levar os cantos para a superelipse", done: true, person: miguel },
        { id: "s3", title: "Documentar foco e erro em cada componente", done: false, person: jhon },
        { id: "s4", title: "Revisar com a equipe de produto", done: false },
      ],
      attachments: [
        { id: "a1", name: "Diretrizes do sistema", type: "image", url: "/banners/login-2-desktop.png", size: "78 KB" },
        { id: "a2", name: "Arquivo no Figma", type: "link", url: "https://www.figma.com" },
      ],
      activity: [
        { id: "e1", person: jhon, action: "comentou: \"Falta o estado de erro no seletor.\"", at: at(0, "09:12") },
        { id: "e2", person: miguel, action: "concluiu \"Levar os cantos para a superelipse\"", at: at(-1, "16:05") },
        { id: "e3", person: hane, action: "anexou as diretrizes do sistema", at: at(-2, "14:48") },
      ],
    },
    {
      id: "k3",
      reference: formatReference("task", 2026, 30),
      title: "Interface do usuário",
      description: "Apresentar os novos elementos e estilos de tela para a equipe, com os fluxos principais montados no protótipo.",
      dueDate: day(1),
      startDate: day(1),
      estimate: 90,
      status: "upcoming",
      priority: "normal",
      owner: jhon,
      people: [miguel, jhon, hane],
      project: { name: "Design system", reference: formatReference("project", 2026, 7) },
      tags: ["Apresentação"],
      subtasks: [
        { id: "s1", title: "Montar o protótipo dos fluxos principais", done: false, person: jhon },
        { id: "s2", title: "Reservar a sala e convidar a equipe", done: false, person: hane },
      ],
      attachments: [],
      activity: [
        { id: "e1", person: miguel, action: "criou a tarefa", at: at(-1, "10:20") },
        { id: "e2", person: miguel, action: "atribuiu a tarefa para Jhon", at: at(-1, "10:21") },
      ],
    },
    {
      id: "k4",
      reference: formatReference("task", 2026, 31),
      title: "Proposta da Padaria Aurora",
      description:
        "Revisar o escopo e enviar a proposta para aprovação. A Marina pediu que o site tenha cardápio com fotos e pedidos pelo WhatsApp, e quer ver duas opções de preço: uma só com o site e outra com a identidade visual junto.",
      dueDate: day(3),
      startDate: day(0),
      estimate: 180,
      status: "upcoming",
      priority: "urgent",
      owner: rafael,
      people: [marina, rafael],
      tags: ["Comercial", "Orçamento"],
      alert: "A cliente pediu a proposta antes da reunião de sexta. Confirme o horário com ela antes de enviar.",
      subtasks: [
        { id: "s1", title: "Revisar o escopo com a Marina", done: false, person: rafael },
        { id: "s2", title: "Montar as duas opções de preço", done: false, person: rafael },
        { id: "s3", title: "Enviar a proposta para aprovação", done: false },
      ],
      attachments: [{ id: "a1", name: "Briefing da reunião", type: "image", url: "/banners/login-3-desktop.png", size: "69 KB" }],
      activity: [
        { id: "e1", person: rafael, action: "anexou o briefing da reunião", at: at(0, "08:45") },
        { id: "e2", person: marina, action: "pediu duas opções de preço", at: at(-1, "18:30") },
        { id: "e3", person: rafael, action: "criou a tarefa", at: at(-2, "15:00") },
      ],
    },
    {
      id: "k5",
      reference: formatReference("task", 2026, 32),
      title: "Entrega do site institucional",
      description:
        "Publicar e passar os acessos para o cliente. Antes de publicar, conferir o domínio, o certificado e o formulário de contato, e deixar o painel do site com o e-mail da Camila como dona.",
      dueDate: day(6),
      startDate: day(-2),
      estimate: 300,
      status: "ongoing",
      priority: "high",
      owner: tiago,
      people: [camila, linda, tiago],
      project: { name: "Site institucional", reference: formatReference("project", 2026, 11) },
      tags: ["Entrega", "Publicação"],
      subtasks: [
        { id: "s1", title: "Apontar o domínio para a hospedagem", done: true, person: tiago },
        { id: "s2", title: "Testar o formulário de contato", done: true, person: linda },
        { id: "s3", title: "Publicar a versão final", done: false, person: tiago },
        { id: "s4", title: "Enviar os acessos para a Camila", done: false, person: linda },
      ],
      attachments: [
        { id: "a1", name: "Prévia aprovada", type: "image", url: "/bg/bg-model.jpeg", size: "50 KB", label: "Aprovado" },
        { id: "a2", name: "Site em homologação", type: "link", url: "https://homolog.specular.app" },
      ],
      activity: [
        { id: "e1", person: linda, action: "concluiu \"Testar o formulário de contato\"", at: at(0, "11:02") },
        { id: "e2", person: camila, action: "aprovou a prévia", at: at(-1, "19:10") },
        { id: "e3", person: tiago, action: "anexou a prévia aprovada", at: at(-1, "17:55") },
      ],
    },
  ],
};
