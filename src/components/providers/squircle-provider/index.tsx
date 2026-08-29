"use client";

import CornerKit from "@cornerkit/core";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CORNER_SMOOTHING } from "@/lib/corners";

const overlayClass = "cornerkit-border";

function isOverlay(node: Node) {
  return node instanceof Element && node.classList.contains(overlayClass);
}

function addsOnlyOverlays(record: MutationRecord) {
  return record.addedNodes.length > 0 && Array.from(record.addedNodes).every(isOverlay);
}

function adoptDeclaredRadius() {
  const pending = document.querySelectorAll<HTMLElement>("[data-squircle]:not([data-squircle-radius])");
  for (const element of pending) {
    const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
    if (Number.isFinite(radius) && radius > 0) element.dataset.squircleRadius = String(Math.round(radius));
  }
}

export function SquircleProvider() {
  const pathname = usePathname();

  useEffect(() => {
    const kit = new CornerKit({ smoothing: CORNER_SMOOTHING });
    let frame = 0;

    const scan = () => {
      frame = 0;
      adoptDeclaredRadius();
      kit.auto();
    };

    const observer = new MutationObserver((records) => {
      if (frame !== 0 || records.every(addsOnlyOverlays)) return;
      frame = requestAnimationFrame(scan);
    });

    scan();
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
      kit.destroy();
    };
  }, [pathname]);

  return null;
}
