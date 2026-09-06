"use client";

import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { IconButton } from "@/components/ui/icon-button";

// Refaz a árvore do servidor, que é de onde o bloco lê: o giro fica no botão enquanto a ida dura.
export function RefreshButton({ label = "Atualizar" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <IconButton label={label} variant="ghost" size="sm" loading={pending} onClick={() => startTransition(() => router.refresh())}>
      <ArrowsClockwiseIcon />
    </IconButton>
  );
}
