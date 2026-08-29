import { squirclePath } from "./path";

const SELECTOR = "[data-squircle]";
const CACHE_LIMIT = 400;

type Size = { width: number; height: number };

let started = false;
let resizeObserver: ResizeObserver | null = null;
let mutationObserver: MutationObserver | null = null;
let frame = 0;
const pending = new Map<HTMLElement, Size>();
const applied = new WeakMap<HTMLElement, string>();
const paths = new Map<string, string>();

export function supportsNativeCorners() {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("corner-shape", "squircle");
}

function shouldClip(element: HTMLElement, style: CSSStyleDeclaration) {
  if (element.dataset.squircleClip !== undefined) return true;
  const overflow = style.overflow;
  return overflow === "hidden" || overflow === "clip";
}

function readRadius(element: HTMLElement, style: CSSStyleDeclaration) {
  const declared = Number.parseFloat(element.dataset.squircleRadius ?? "");
  if (Number.isFinite(declared) && declared > 0) return declared;
  const computed = Number.parseFloat(style.borderTopLeftRadius);
  return Number.isFinite(computed) && computed > 0 ? computed : 0;
}

function pathFor(width: number, height: number, radius: number) {
  const key = `${width}|${height}|${radius}`;
  const cached = paths.get(key);
  if (cached) return cached;
  if (paths.size >= CACHE_LIMIT) paths.clear();
  const path = squirclePath(width, height, radius);
  paths.set(key, path);
  return path;
}

function clear(element: HTMLElement) {
  if (applied.has(element)) {
    element.style.removeProperty("clip-path");
    applied.delete(element);
  }
}

function paint(element: HTMLElement, size: Size) {
  if (!element.isConnected) return clear(element);
  const style = getComputedStyle(element);
  if (!shouldClip(element, style)) return clear(element);
  const radius = readRadius(element, style);
  if (radius <= 0 || size.width <= 0 || size.height <= 0) return clear(element);
  const width = Math.round(size.width * 4) / 4;
  const height = Math.round(size.height * 4) / 4;
  const path = pathFor(width, height, radius);
  if (applied.get(element) === path) return;
  element.style.clipPath = `path("${path}")`;
  applied.set(element, path);
}

function flush() {
  frame = 0;
  const batch = Array.from(pending);
  pending.clear();
  for (const [element, size] of batch) paint(element, size);
}

function schedule() {
  if (frame === 0) frame = requestAnimationFrame(flush);
}

function sizeOf(entry: ResizeObserverEntry): Size {
  const box = entry.borderBoxSize?.[0];
  if (box) return { width: box.inlineSize, height: box.blockSize };
  const rect = entry.target.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

export function observeSquircle(element: HTMLElement) {
  if (!resizeObserver) return;
  resizeObserver.observe(element, { box: "border-box" });
}

export function unobserveSquircle(element: HTMLElement) {
  resizeObserver?.unobserve(element);
  pending.delete(element);
  clear(element);
}

function refresh(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  pending.set(element, { width: rect.width, height: rect.height });
  schedule();
}

function forEachSquircle(node: Node, callback: (element: HTMLElement) => void) {
  if (!(node instanceof HTMLElement)) return;
  if (node.matches(SELECTOR)) callback(node);
  node.querySelectorAll<HTMLElement>(SELECTOR).forEach(callback);
}

function onMutations(records: MutationRecord[]) {
  for (const record of records) {
    if (record.type === "attributes") {
      const target = record.target as HTMLElement;
      if (target.matches(SELECTOR)) {
        observeSquircle(target);
        refresh(target);
      } else {
        unobserveSquircle(target);
      }
      continue;
    }
    record.addedNodes.forEach((node) => forEachSquircle(node, observeSquircle));
    record.removedNodes.forEach((node) => forEachSquircle(node, unobserveSquircle));
  }
}

export function startSquircleEngine() {
  if (started || typeof window === "undefined" || supportsNativeCorners()) return () => undefined;
  started = true;

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) pending.set(entry.target as HTMLElement, sizeOf(entry));
    schedule();
  });

  mutationObserver = new MutationObserver(onMutations);
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-squircle", "data-squircle-radius", "data-squircle-clip"],
  });

  forEachSquircle(document.documentElement, observeSquircle);

  return () => {
    mutationObserver?.disconnect();
    resizeObserver?.disconnect();
    if (frame !== 0) cancelAnimationFrame(frame);
    mutationObserver = null;
    resizeObserver = null;
    frame = 0;
    pending.clear();
    started = false;
  };
}
