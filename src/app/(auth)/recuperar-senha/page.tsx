import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { env, hasTurnstile } from "@/lib/env";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Recuperar senha",
  description: "Receba um link para redefinir sua senha",
  path: "/recuperar-senha",
});

export default function ForgotPasswordPage() {
  const turnstileSiteKey = hasTurnstile() ? env.turnstilePublic().NEXT_PUBLIC_TURNSTILE_SITE_KEY : undefined;

  return <ForgotPasswordForm turnstileSiteKey={turnstileSiteKey} />;
}
