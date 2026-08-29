"use client";

import { useCallback } from "react";
import { observeSquircle, unobserveSquircle } from "./engine";

export function useSquircle<T extends HTMLElement>(radius?: number, clip = false) {
  return useCallback(
    (node: T | null) => {
      if (!node) return;
      node.dataset.squircle = "";
      if (radius !== undefined) node.dataset.squircleRadius = String(radius);
      if (clip) node.dataset.squircleClip = "";
      observeSquircle(node);
      return () => unobserveSquircle(node);
    },
    [radius, clip],
  );
}
