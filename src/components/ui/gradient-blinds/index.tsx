"use client";

import styled from "@emotion/styled";
import { Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef, type CSSProperties } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";

export type GradientBlindsProps = {
  colors?: string[];
  angle?: number;
  noise?: number;
  blindCount?: number;
  blindMinWidth?: number;
  mouseDampening?: number;
  mirrorGradient?: boolean;
  spotlightRadius?: number;
  spotlightSoftness?: number;
  spotlightOpacity?: number;
  distortAmount?: number;
  shineDirection?: "left" | "right";
  autoOrbit?: boolean;
  mixBlendMode?: CSSProperties["mixBlendMode"];
  paused?: boolean;
  dpr?: number;
  className?: string;
};

type Rgb = [number, number, number];

const MAX_COLORS = 8;
const MAX_DPR = 1.5;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const DEFAULT_COLORS = ["var(--sys-purple)", "var(--sys-indigo)", "var(--sys-blue)"];
const IDLE_AFTER_MS = 1500;
const ORBIT_RADIUS = 0.28;

const Root = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;

  & canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
`;

const vertex = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
#ifdef GL_ES
precision mediump float;
#endif

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;
uniform float uAngle;
uniform float uNoise;
uniform float uBlindCount;
uniform float uSpotlightRadius;
uniform float uSpotlightSoftness;
uniform float uSpotlightOpacity;
uniform float uMirror;
uniform float uDistort;
uniform float uShineFlip;
uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

varying vec2 vUv;

float rand(vec2 co){
  return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453);
}

vec2 rotate2D(vec2 p, float a){
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c) * p;
}

vec3 getGradientColor(float t){
  float tt = clamp(t, 0.0, 1.0);
  int count = uColorCount;
  if (count < 2) count = 2;
  float scaled = tt * float(count - 1);
  float seg = floor(scaled);
  float f = fract(scaled);

  if (seg < 1.0) return mix(uColor0, uColor1, f);
  if (seg < 2.0 && count > 2) return mix(uColor1, uColor2, f);
  if (seg < 3.0 && count > 3) return mix(uColor2, uColor3, f);
  if (seg < 4.0 && count > 4) return mix(uColor3, uColor4, f);
  if (seg < 5.0 && count > 5) return mix(uColor4, uColor5, f);
  if (seg < 6.0 && count > 6) return mix(uColor5, uColor6, f);
  if (seg < 7.0 && count > 7) return mix(uColor6, uColor7, f);
  if (count > 7) return uColor7;
  if (count > 6) return uColor6;
  if (count > 5) return uColor5;
  if (count > 4) return uColor4;
  if (count > 3) return uColor3;
  if (count > 2) return uColor2;
  return uColor1;
}

void main() {
  vec2 fragCoord = vUv * iResolution.xy;
  vec2 uv0 = fragCoord.xy / iResolution.xy;

  float aspect = iResolution.x / iResolution.y;
  vec2 p = uv0 * 2.0 - 1.0;
  p.x *= aspect;
  vec2 pr = rotate2D(p, uAngle);
  pr.x /= aspect;
  vec2 uv = pr * 0.5 + 0.5;

  vec2 uvMod = uv;
  if (uDistort > 0.0) {
    float a = uvMod.y * 6.0;
    float b = uvMod.x * 6.0;
    float w = 0.01 * uDistort;
    uvMod.x += sin(a) * w;
    uvMod.y += cos(b) * w;
  }
  float t = uvMod.x;
  if (uMirror > 0.5) {
    t = 1.0 - abs(1.0 - 2.0 * fract(t));
  }
  vec3 base = getGradientColor(t);

  vec2 offset = vec2(iMouse.x / iResolution.x, iMouse.y / iResolution.y);
  float d = length(uv0 - offset);
  float r = max(uSpotlightRadius, 1e-4);
  float dn = d / r;
  float spot = (1.0 - 2.0 * pow(dn, uSpotlightSoftness)) * uSpotlightOpacity;
  vec3 cir = vec3(spot);
  float blindCount = max(uBlindCount, 1.0);
  float stripePhase = uvMod.x * blindCount;
  float stripe = fract(stripePhase);
  float stripeAA = clamp(blindCount * 1.25 / min(iResolution.x, iResolution.y), 0.001, 0.12);
  float edgeDistance = min(stripe, 1.0 - stripe);
  float edgeBlend = 1.0 - smoothstep(0.0, stripeAA, edgeDistance);
  stripe = mix(stripe, 0.5, edgeBlend);
  if (uShineFlip > 0.5) stripe = 1.0 - stripe;
  vec3 ran = vec3(stripe);
  vec3 col = cir + base - ran;
  col += (rand(gl_FragCoord.xy + iTime) - 0.5) * uNoise;

  gl_FragColor = vec4(col, 1.0);
}
`;

function resolveColor(probe: HTMLElement, color: string): Rgb {
  probe.style.color = color;
  const channels = getComputedStyle(probe).color.match(/[\d.]+/g);
  if (!channels || channels.length < 3) return [0, 0, 0];
  return [Number(channels[0]) / 255, Number(channels[1]) / 255, Number(channels[2]) / 255];
}

function prepareStops(colors: string[], probe: HTMLElement) {
  const base = (colors.length ? colors : DEFAULT_COLORS).slice(0, MAX_COLORS);
  if (base.length === 1) base.push(base[0] as string);
  const stops = base.map((color) => resolveColor(probe, color));
  while (stops.length < MAX_COLORS) stops.push(stops[stops.length - 1] as Rgb);
  return { stops, count: Math.max(2, Math.min(MAX_COLORS, base.length)) };
}

export function GradientBlinds({
  colors = DEFAULT_COLORS,
  angle = 0,
  noise = 0.4,
  blindCount = 22,
  blindMinWidth = 80,
  mouseDampening = 0.25,
  mirrorGradient = false,
  spotlightRadius = 0.5,
  spotlightSoftness = 1,
  spotlightOpacity = 1,
  distortAmount = 0,
  shineDirection = "left",
  autoOrbit = true,
  mixBlendMode = "lighten",
  paused = false,
  dpr,
  className,
}: GradientBlindsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const still = paused || reducedMotion;
  const colorKey = colors.join("|");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const probe = document.createElement("span");
    container.appendChild(probe);
    const { stops, count } = prepareStops(colorKey.split("|"), probe);
    container.removeChild(probe);

    const renderer = new Renderer({
      dpr: Math.min(dpr ?? window.devicePixelRatio ?? 1, MAX_DPR),
      alpha: true,
      antialias: true,
    });
    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    container.appendChild(canvas);

    const uniforms = {
      iResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
      iMouse: { value: [0, 0] },
      iTime: { value: 0 },
      uAngle: { value: (angle * Math.PI) / 180 },
      uNoise: { value: noise },
      uBlindCount: { value: Math.max(1, blindCount) },
      uSpotlightRadius: { value: spotlightRadius },
      uSpotlightSoftness: { value: spotlightSoftness },
      uSpotlightOpacity: { value: spotlightOpacity },
      uMirror: { value: mirrorGradient ? 1 : 0 },
      uDistort: { value: distortAmount },
      uShineFlip: { value: shineDirection === "right" ? 1 : 0 },
      uColor0: { value: stops[0] },
      uColor1: { value: stops[1] },
      uColor2: { value: stops[2] },
      uColor3: { value: stops[3] },
      uColor4: { value: stops[4] },
      uColor5: { value: stops[5] },
      uColor6: { value: stops[6] },
      uColor7: { value: stops[7] },
      uColorCount: { value: count },
    };

    const program = new Program(gl, { vertex, fragment, uniforms });
    const geometry = new Triangle(gl);
    const mesh = new Mesh(gl, { geometry, program });

    let target: [number, number] = [0, 0];
    let frame = 0;
    let lastTime = 0;
    let lastPointer = -Infinity;

    const render = () => renderer.render({ scene: mesh });

    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];
      const maxByWidth = blindMinWidth > 0 ? Math.max(1, Math.floor(rect.width / blindMinWidth)) : blindCount;
      uniforms.uBlindCount.value = Math.max(1, Math.min(blindCount, maxByWidth));
      if (still) render();
    };

    const center: [number, number] = [gl.drawingBufferWidth / 2, gl.drawingBufferHeight / 2];
    uniforms.iMouse.value = [...center];
    target = center;

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scale = renderer.dpr || 1;
      lastPointer = performance.now();
      target = [(event.clientX - rect.left) * scale, (rect.height - (event.clientY - rect.top)) * scale];
      if (mouseDampening <= 0) uniforms.iMouse.value = [...target];
    };
    container.addEventListener("pointermove", onPointerMove);

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      uniforms.iTime.value = time * 0.001;
      if (autoOrbit && time - lastPointer > IDLE_AFTER_MS) {
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;
        const seconds = time * 0.001;
        target = [
          width / 2 + Math.cos(seconds * 0.35) * width * ORBIT_RADIUS,
          height / 2 + Math.sin(seconds * 0.27) * height * ORBIT_RADIUS,
        ];
      }
      if (mouseDampening > 0) {
        if (!lastTime) lastTime = time;
        const dt = (time - lastTime) / 1000;
        lastTime = time;
        const factor = Math.min(1, 1 - Math.exp(-dt / Math.max(1e-4, mouseDampening)));
        const current = uniforms.iMouse.value;
        current[0] = (current[0] ?? 0) + (target[0] - (current[0] ?? 0)) * factor;
        current[1] = (current[1] ?? 0) + (target[1] - (current[1] ?? 0)) * factor;
      }
      render();
    };

    const start = () => {
      if (frame === 0) frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    };
    const onVisibility = () => (document.hidden || still ? stop() : start());

    if (still) render();
    else start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      container.removeEventListener("pointermove", onPointerMove);
      observer.disconnect();
      program.remove();
      geometry.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (canvas.parentElement === container) container.removeChild(canvas);
    };
  }, [
    colorKey,
    angle,
    noise,
    blindCount,
    blindMinWidth,
    mouseDampening,
    mirrorGradient,
    spotlightRadius,
    spotlightSoftness,
    spotlightOpacity,
    distortAmount,
    shineDirection,
    autoOrbit,
    still,
    dpr,
  ]);

  return <Root ref={containerRef} className={className} style={{ mixBlendMode }} aria-hidden="true" />;
}
