"use client";

import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { IconButton } from "@/components/ui/icon-button";

// Refaz a árvore do servidor, que é de onde o bloco lê: o giro toma o lugar do ícone enquanto a ida
// dura, e ao terminar um toast confirma que o que está na tela é o de agora.
export function RefreshButton({ label = "Atualizar" }: { label?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    toast({ title: "Financeiro atualizado", description: "Saldo e movimentações recarregados agora", tone: "success" });
  }, [pending, toast]);

  return (
    <IconButton label={label} variant="ghost" size="sm" loading={pending} onClick={() => startTransition(() => router.refresh())}>
      <ArrowsClockwiseIcon />
    </IconButton>
  );
}
