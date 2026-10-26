import { WhatsappScreen } from "@/features/whatsapp/components/whatsapp-screen";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "WhatsApp",
  description: "Conversas do WhatsApp da equipe, com a ficha de cada contato",
  path: "/whatsapp",
  noIndex: true,
});

export default function WhatsappPage() {
  return <WhatsappScreen />;
}
