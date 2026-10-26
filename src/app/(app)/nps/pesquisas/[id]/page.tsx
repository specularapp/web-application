import { notFound } from "next/navigation";
import { getAiUsageData } from "@/features/ai/queries";
import { NpsScreen } from "@/features/nps/components/nps-screen";
import { SurveyEditor } from "@/features/nps/components/survey-editor";
import { newSurvey, npsSample } from "@/features/nps/sample";
import { createMetadata } from "@/lib/metadata";
import { first } from "@/lib/utils/search-params";

export async function generateMetadata({ params }: PageProps<"/nps/pesquisas/[id]">) {
  const { id } = await params;
  const survey = npsSample().surveys.find((item) => item.id === id);
  return createMetadata({
    title: survey ? `Editar ${survey.name}` : "Nova pesquisa de NPS",
    description: "Perguntas, agradecimentos e caminhos da pesquisa, com a prévia de como o cliente vê",
    path: `/nps/pesquisas/${id}`,
    noIndex: true,
  });
}

export default async function NpsSurveyEditorPage({ params, searchParams }: PageProps<"/nps/pesquisas/[id]">) {
  const [{ id }, query, ai] = await Promise.all([params, searchParams, getAiUsageData()]);
  const survey = id === "nova" ? newSurvey(first(query.nome)?.slice(0, 60) || "Nova pesquisa") : npsSample().surveys.find((item) => item.id === id);
  if (!survey) notFound();

  return (
    <NpsScreen title={id === "nova" ? "Nova pesquisa" : "Editor de pesquisa"} ai={ai}>
      <SurveyEditor survey={survey} />
    </NpsScreen>
  );
}
