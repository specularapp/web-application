"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/providers/toast-provider";

const PRIMEIRA_RENDERIZACAO = Symbol("inicial");

// A marca separa "erro novo" de "mesma tela renderizando de novo": sem ela o toast some
// na primeira tentativa repetida, porque a mensagem é idêntica à anterior.
export function useAuthToast(title: string, message: string | undefined, token?: unknown) {
  const { toast } = useToast();
  const disparado = useRef<unknown>(PRIMEIRA_RENDERIZACAO);

  useEffect(() => {
    const marca = token ?? message;
    if (!message || Object.is(disparado.current, marca)) return;
    disparado.current = marca;
    toast({ title, description: message, tone: "danger" });
  }, [title, message, token, toast]);
}
