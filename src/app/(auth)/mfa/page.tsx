import { redirect } from "next/navigation";
import { listTotpFactors } from "@/features/auth/actions";
import { MfaEnroll } from "@/features/auth/components/mfa-enroll";
import { MfaVerify } from "@/features/auth/components/mfa-verify";
import { getCurrentUser } from "@/features/auth/session";
import { createMetadata } from "@/lib/metadata";
import { safePath } from "@/lib/security/safe-path";
import { first } from "@/lib/utils/search-params";

export const metadata = createMetadata({
  title: "Verificação em duas etapas",
  description: "Confirme o código do seu autenticador para continuar",
  path: "/mfa",
});


export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const params = await searchParams;
  const next = safePath(first(params.next));

  const user = await getCurrentUser();
  if (!user) redirect("/auth/sair");

  const factors = await listTotpFactors();
  const verified = factors.find((factor) => factor.status === "verified");

  return verified ? <MfaVerify next={next} factorId={verified.id} /> : <MfaEnroll next={next} />;
}
