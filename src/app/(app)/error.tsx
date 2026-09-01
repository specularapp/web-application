"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Stack } from "@/components/ui/stack";
import { Text } from "@/components/ui/text";
import styles from "./error.module.css";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  return (
    <main className={styles.page}>
      <Stack gap={4} align="center" className={styles.block}>
        <Image src="/3d-icons/error.png" alt="" width={61} height={178} className={styles.icon} />
        <Text as="h1" variant="title3" weight="medium" align="center">
          Algo saiu do lugar
        </Text>
        <Text variant="subheadline" tone="secondary" align="center">
          Não conseguimos carregar esta tela agora. Tente de novo em instantes.
        </Text>
        <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowClockwiseIcon />} onClick={reset}>
          Tentar de novo
        </Button>
        {error.digest && (
          <Text variant="caption1" tone="tertiary" font="code" align="center">
            {error.digest}
          </Text>
        )}
      </Stack>
    </main>
  );
}
