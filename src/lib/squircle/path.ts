export const CORNER_SMOOTHING = 0.6;

type CornerParams = {
  a: number;
  b: number;
  c: number;
  d: number;
  p: number;
  arc: number;
  radius: number;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

function cornerParams(radius: number, smoothing: number, budget: number): CornerParams {
  const maxSmoothing = budget / radius - 1;
  const s = Math.max(0, Math.min(smoothing, maxSmoothing));
  const p = Math.min((1 + s) * radius, budget);
  const arcMeasure = 90 * (1 - s);
  const arc = Math.sin(toRadians(arcMeasure / 2)) * radius * Math.SQRT2;
  const alpha = (90 - arcMeasure) / 2;
  const p3ToP4 = radius * Math.tan(toRadians(alpha / 2));
  const beta = 45 * s;
  const c = p3ToP4 * Math.cos(toRadians(beta));
  const d = c * Math.tan(toRadians(beta));
  const b = (p - arc - c - d) / 3;
  const a = 2 * b;
  return { a, b, c, d, p, arc, radius };
}

const n = (value: number) => Math.round(value * 100) / 100;

export function squirclePath(width: number, height: number, radius: number, smoothing = CORNER_SMOOTHING) {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const budget = Math.min(w, h) / 2;
  const r = Math.min(radius, budget);
  if (r <= 0 || w === 0 || h === 0) return `M0 0H${n(w)}V${n(h)}H0Z`;

  const { a, b, c, d, p, arc } = cornerParams(r, smoothing, budget);

  return [
    `M${n(w - p)} 0`,
    `c${n(a)} 0 ${n(a + b)} 0 ${n(a + b + c)} ${n(d)}`,
    `a${n(r)} ${n(r)} 0 0 1 ${n(arc)} ${n(arc)}`,
    `c${n(d)} ${n(c)} ${n(d)} ${n(b + c)} ${n(d)} ${n(a + b + c)}`,
    `L${n(w)} ${n(h - p)}`,
    `c0 ${n(a)} 0 ${n(a + b)} ${n(-d)} ${n(a + b + c)}`,
    `a${n(r)} ${n(r)} 0 0 1 ${n(-arc)} ${n(arc)}`,
    `c${n(-c)} ${n(d)} ${n(-(b + c))} ${n(d)} ${n(-(a + b + c))} ${n(d)}`,
    `L${n(p)} ${n(h)}`,
    `c${n(-a)} 0 ${n(-(a + b))} 0 ${n(-(a + b + c))} ${n(-d)}`,
    `a${n(r)} ${n(r)} 0 0 1 ${n(-arc)} ${n(-arc)}`,
    `c${n(-d)} ${n(-c)} ${n(-d)} ${n(-(b + c))} ${n(-d)} ${n(-(a + b + c))}`,
    `L0 ${n(p)}`,
    `c0 ${n(-a)} 0 ${n(-(a + b))} ${n(d)} ${n(-(a + b + c))}`,
    `a${n(r)} ${n(r)} 0 0 1 ${n(arc)} ${n(-arc)}`,
    `c${n(c)} ${n(-d)} ${n(b + c)} ${n(-d)} ${n(a + b + c)} ${n(-d)}`,
    "Z",
  ].join("");
}
