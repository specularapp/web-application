"use client";

import { ArrowClockwiseIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { callAction } from "@/lib/action";
import { loadClientAction } from "./actions";
import type { Client } from "./summary";

/**
 * O pedido da ficha completa de um contato, num lugar só.
 *
 * A gaveta da ficha e a janela de edição fazem o mesmo pedido, e o trecho estava copiado nas duas, com o
 * tipo, o recado, a conversão e o bloco de erro repetidos linha a linha (2026-09-22, na varredura). Um
 * módulo próprio não acopla uma janela à outra: nenhuma importa a outra, e a listagem segue baixando cada
 * uma por conta, pelo `dynamic` dela.
 */
const GONE = "Não encontramos este contato. Ele pode ter sido excluído, ou a sessão venceu.";

/**
 * Os três estados que a tela precisa, e não dois: `loadClientAction` devolve `Client | null`, então "ainda
 * carregando" e "não achou" eram o mesmo estado, e abrir um contato que outra pessoa acabou de excluir, ou
 * com a sessão vencida, deixava o giro para sempre, sem recado e sem tentar de novo.
 */
type Loaded = { ok: true; client: Client } | { ok: false; error: string };

/**
 * A ficha por baixo do teto de tempo da casa. A action devolve nulo quando a guarda recusa ou a linha não
 * existe, e rejeita quando o transporte cai, e nenhum dos dois casos tem resposta na tela sem isto.
 *
 * O jeito definitivo é `loadClientAction` devolver `{ ok, data }` como as outras actions da feature; até lá,
 * a conversão mora aqui.
 */
async function fetchClient(id: string): Promise<Loaded> {
  return callAction<Loaded>(loadClientAction(id).then((data) => (data ? { ok: true, client: data } : { ok: false, error: GONE })));
}

export type FullClient = {
  /** A ficha quando chegou; nula enquanto vem e quando não veio. */
  client: Client | null;
  /** O recado de quando não veio. */
  error: string | null;
  /** Pede de novo, depois de uma falha. */
  retry: () => void;
};

/**
 * A ficha completa de um contato, buscada ao abrir. Sem id nada é pedido, o que é o estado da janela que
 * segue montada e fechada para a saída animar.
 */
export function useFullClient(id: string | undefined): FullClient {
  const [fetched, setFetched] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Trocar de contato limpa a ficha antiga no mesmo render, senão a janela mostraria a de quem estava aberto
  // antes enquanto a nova vem. Ajuste durante o render, e não em efeito: é o que o React recomenda para
  // reagir a prop nova, e o lint barra `setState` síncrono dentro de efeito.
  const [asked, setAsked] = useState(id);
  if (id && asked !== id) {
    setAsked(id);
    setFetched(null);
  }

  useEffect(() => {
    if (!id) return;

    let current = true;
    void fetchClient(id).then((result) => {
      if (current) setFetched(result);
    });

    return () => {
      current = false;
    };
  }, [id, attempt]);

  return {
    client: fetched?.ok ? fetched.client : null,
    error: fetched && !fetched.ok ? fetched.error : null,
    retry: () => {
      setFetched(null);
      setAttempt((round) => round + 1);
    },
  };
}

/* A ficha que não vem tem recado e saída, e não um giro sem fim. A mesma peça na gaveta da ficha e na
   janela de edição; quem chama só põe o espaço em volta. */
export function ClientLoadFailure({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <EmptyState icon={WarningCircleIcon} title="A ficha não carregou" description={error} size="sm">
      <Button variant="secondary" size="sm" radius="md" iconStart={<ArrowClockwiseIcon />} onClick={onRetry}>
        Tentar de novo
      </Button>
    </EmptyState>
  );
}
