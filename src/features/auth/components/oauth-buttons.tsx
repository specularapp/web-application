"use client";

import { useFormStatus } from "react-dom";
import { BrandIcon } from "@/components/ui/brand-icon";
import { Button } from "@/components/ui/button";
import { signInWithOAuth } from "../actions";
import type { OAuthProvider } from "../schemas";
import styles from "./auth-form.module.css";

type Provider = { id: OAuthProvider; label: string; color?: boolean };

const providers: Provider[] = [
  { id: "google", label: "Google", color: true },
  { id: "github", label: "GitHub" },
];

function ProviderButton({ id, label, color }: Provider) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" fullWidth loading={pending} iconStart={<BrandIcon name={id} color={color} />}>
      <span className={styles.mobileOnly}>Continuar com </span>
      {label}
    </Button>
  );
}

export function OAuthButtons({ next }: { next: string }) {
  return (
    <div className={styles.providers}>
      {providers.map((provider) => (
        <form key={provider.id} action={signInWithOAuth.bind(null, provider.id, next)}>
          <ProviderButton {...provider} />
        </form>
      ))}
    </div>
  );
}
