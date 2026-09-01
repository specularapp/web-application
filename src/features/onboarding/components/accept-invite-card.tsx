"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/layout/logo";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Text } from "@/components/ui/text";
import { TextLink } from "@/components/ui/link";
import { acceptInviteAction } from "@/features/organizations/actions";
import styles from "./onboarding.module.css";

type AcceptInviteCardProps = {
  token: string;
  email: string | null;
};

export function AcceptInviteCard({ token, email }: AcceptInviteCardProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);

  const accept = async () => {
    if (accepting) return;
    setAccepting(true);

    const result = await acceptInviteAction(token);
    if (!result.ok) {
      toast({ title: "Não foi possível aceitar", description: result.error, tone: "danger" });
      setAccepting(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <Logo variant="logotipo" height={20} />
      </div>

      <div className={styles.shell}>
        <Surface as="section" className={styles.card}>
          <div className={styles.head}>
            <div className={styles.headText}>
              <Text as="h1" variant="title2" weight="medium">
                Convite para um time
              </Text>
              <Text variant="subheadline" tone="secondary">
                Aceite para entrar no time e começar a trabalhar junto
                {email ? ` com a conta ${email}` : ""}.
              </Text>
            </div>
            <Logo variant="icon" height={28} label="" aria-hidden="true" />
          </div>

          <div className={styles.actions}>
            <Text variant="footnote" tone="secondary" className={styles.back}>
              Convite para outra pessoa?{" "}
              <TextLink href="/dashboard" tone="inherit" underline="always">
                Ir para o painel
              </TextLink>
            </Text>
            <Button size="lg" loading={accepting} iconEnd={<ArrowRightIcon />} onClick={() => void accept()}>
              {accepting ? "Entrando no time" : "Aceitar convite"}
            </Button>
          </div>
        </Surface>
      </div>
    </main>
  );
}
