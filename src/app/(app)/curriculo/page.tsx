import { notFound } from "next/navigation";
import { ResumeEditor } from "@/features/resume/components/resume-editor";
import { getResumeSettings } from "@/features/settings/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Currículo",
  description: "Sua apresentação, habilidades e links, com endereço público",
  path: "/curriculo",
  noIndex: true,
});

export default async function ResumePage() {
  const data = await getResumeSettings();
  if (!data) notFound();

  return <ResumeEditor resume={data.resume} publicUrl={data.publicUrl} />;
}
