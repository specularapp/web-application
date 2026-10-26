import { getAiUsageData } from "@/features/ai/queries";
import { EmailScreen } from "@/features/marketing/components/email-screen";
import { sampleEmailData } from "@/features/marketing/sample";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "E-mail marketing",
  description: "Campanhas de e-mail com modelos, prévia, agendamento e as métricas de abertura e clique",
  path: "/marketing/email",
  noIndex: true,
});

export default async function EmailMarketingPage() {
  const ai = await getAiUsageData();

  return <EmailScreen data={sampleEmailData} ai={ai} />;
}
