"use client";

import { useEffect } from "react";
import { startSquircleEngine } from "@/lib/squircle/engine";

export function SquircleProvider() {
  useEffect(() => startSquircleEngine(), []);
  return null;
}
