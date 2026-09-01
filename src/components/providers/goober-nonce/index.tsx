"use client";

import { useState } from "react";

declare global {
  interface Window {
    __nonce__?: string;
  }
}

// O goober (que vem com o avvvatars) injeta um <style> em runtime e lê o nonce de window.__nonce__.
// Sem isso a CSP por nonce bloqueia a folha e o avatar aparece sem estilo. Roda na renderização, e
// não em efeito, porque o goober cria a tag no primeiro avatar que montar.
export function GooberNonce({ nonce }: { nonce?: string }) {
  useState(() => {
    if (typeof window !== "undefined" && nonce) window.__nonce__ = nonce;
  });

  return null;
}
