"use client";

import { BrandIcon } from "@/components/ui/brand-icon";
import { Button } from "@/components/ui/button";
import { signInWithOAuth } from "../actions";
import type { OAuthProvider } from "../schemas";
import styles from "./auth-form.module.css";

const providers: { id: OAuthProvider; label: string; color?: boolean }[] = [
  { id: "google", label: "Google", color: true },
  { id: "github", label: "GitHub" },
];

export function OAuthButtons({ next }: { next: string }) {
  return (
    <div className={styles.providers}>
      {providers.map(({ id, label, color }) => (
        <form key={id} action={signInWithOAuth.bind(null, id, next)}>
          <Button type="submit" variant="outline" fullWidth iconStart={<BrandIcon name={id} color={color} />}>
            <span className={styles.mobileOnly}>Continuar com </span>
            {label}
          </Button>
        </form>
      ))}
    </div>
  );
}
