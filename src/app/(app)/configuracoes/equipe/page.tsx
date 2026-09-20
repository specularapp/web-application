import { TeamSettings } from "@/features/settings/components/team-settings";
import { getTeamSettings } from "@/features/settings/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Equipe",
  description: "Quem está na equipe, o papel de cada um e os convites pendentes",
  path: "/configuracoes/equipe",
  noIndex: true,
});

export default async function TeamPage() {
  const state = await getTeamSettings();
  return <TeamSettings {...state} />;
}
