import { ConfirmEmailCard } from "@/features/auth/components/confirm-email-card";
import { otpTypeSchema, tokenHashSchema } from "@/features/auth/schemas";
import { createMetadata } from "@/lib/metadata";
import { safePath } from "@/lib/security/safe-path";

export const metadata = createMetadata({
  title: "Confirmar e-mail",
  description: "Confirme seu e-mail para continuar no Specular",
  path: "/confirmar-email",
});

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConfirmEmailPage({ searchParams }: PageProps<"/confirmar-email">) {
  const params = await searchParams;
  const tokenHash = tokenHashSchema.safeParse(first(params.token_hash));
  const type = otpTypeSchema.safeParse(first(params.type));
  const next = safePath(first(params.next));

  return (
    <ConfirmEmailCard
      tokenHash={tokenHash.success ? tokenHash.data : undefined}
      type={type.success ? type.data : "signup"}
      next={next}
    />
  );
}
