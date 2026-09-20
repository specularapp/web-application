import { getAiUsageData } from "@/features/ai/queries";
import { AchievementsScreen } from "@/features/gamification/components/achievements-screen";
import { getGamificationBlocks } from "@/features/gamification/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Conquistas",
  description: "Seus pontos, sua posição e a constância de quem entra todo dia",
  path: "/conquistas",
  noIndex: true,
});

// A página de conquistas (2026-09-17): as mesmas duas leituras do painel, com o espaço que ele não tem.
export default async function AchievementsPage() {
  const [{ points, challenge }, ai] = await Promise.all([getGamificationBlocks(), getAiUsageData()]);
  return <AchievementsScreen points={points} challenge={challenge} ai={ai} />;
}
