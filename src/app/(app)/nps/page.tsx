import { redirect } from "next/navigation";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({ title: "NPS", description: "Pesquisas de satisfação dos clientes, disparos, respostas e tratativas", path: "/nps", noIndex: true });

export default function NpsPage() {
  redirect("/nps/resultados");
}
