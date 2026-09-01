import { requireUser } from "@/features/auth/session";
import { AcceptInviteCard } from "@/features/onboarding/components/accept-invite-card";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Convite",
  description: "Aceite o convite para entrar em um time do Specular",
  noIndex: true,
});

export default async function ConvitePage({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const user = await requireUser(`/convite/${token}`);

  return <AcceptInviteCard token={token} email={user.email ?? null} />;
}
