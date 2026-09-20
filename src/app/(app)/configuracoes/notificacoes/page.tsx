import { getAiUsageData } from "@/features/ai/queries";
import { NotificationsSettings } from "@/features/settings/components/notifications-settings";
import { getNotificationsSettings } from "@/features/settings/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Notificações",
  description: "Tudo o que a casa te avisou",
  path: "/configuracoes/notificacoes",
  noIndex: true,
});

export default async function NotificationsPage() {
  const [items, ai] = await Promise.all([getNotificationsSettings(), getAiUsageData()]);
  return <NotificationsSettings items={items} ai={ai} />;
}
