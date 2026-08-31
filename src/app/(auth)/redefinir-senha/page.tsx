import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { getCurrentUser } from "@/features/auth/session";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Redefinir senha",
  description: "Defina uma nova senha para sua conta",
  path: "/redefinir-senha",
});

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  return <ResetPasswordForm email={user?.email ?? undefined} />;
}
