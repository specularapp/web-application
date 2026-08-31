import { redirect } from "next/navigation";
import { listTotpFactors } from "@/features/auth/actions";
import { MfaEnroll } from "@/features/auth/components/mfa-enroll";
import { MfaVerify } from "@/features/auth/components/mfa-verify";
import { getCurrentUser } from "@/features/auth/session";
import { createMetadata } from "@/lib/metadata";
import { safePath } from "@/lib/security/safe-path";

export const metadata = createMetadata({
  title: "Verificação em duas etapas",
  description: "Confirme o código do seu autenticador para continuar",
  path: "/mfa",
});

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const params = await searchParams;
  const next = safePath(first(params.next));

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fmfa");

  const factors = await listTotpFactors();
  const verified = factors.find((factor) => factor.status === "verified");

  return verified ? <MfaVerify next={next} factorId={verified.id} /> : <MfaEnroll next={next} />;
}
