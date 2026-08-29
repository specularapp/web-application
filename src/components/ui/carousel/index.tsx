"use client";

import styled from "@emotion/styled";
import { getImageProps } from "next/image";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { carouselSlideSize } from "./sizes";

export type CarouselSlide = {
  desktop: string;
  mobile: string;
  alt: string;
};

export type CarouselProps = {
  slides: CarouselSlide[];
  label: string;
  interval?: number;
  className?: string;
};

const DESKTOP_QUERY = "(min-width: 64rem)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const Root = styled.div`
  position: relative;
  width: 100%;
  min-height: 100%;
  overflow: hidden;
  background-color: var(--color-bg-secondary);
`;

const Slide = styled.div`
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: scale(1.04);
  transition:
    opacity var(--duration-slow) var(--ease-standard),
    transform 1.6s var(--ease-standard);

  &[data-active] {
    opacity: 1;
    transform: scale(1);
  }

  & picture,
  & img {
    display: block;
    width: 100%;
    height: 100%;
  }

  & img {
    object-fit: cover;
  }

  @media ${REDUCED_MOTION_QUERY} {
    transition: none;
    transform: none;
  }
`;

function slideImages(slide: CarouselSlide) {
  const common = { alt: slide.alt };
  const desktop = getImageProps({ ...common, ...carouselSlideSize.desktop, src: slide.desktop, sizes: "60vw" });
  const mobile = getImageProps({ ...common, ...carouselSlideSize.mobile, src: slide.mobile, sizes: "100vw" });
  return { desktopSrcSet: desktop.props.srcSet, mobile: mobile.props };
}

export function Carousel({ slides, label, interval = 6000, className }: CarouselProps) {
  const [index, setIndex] = useState(0);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const cycling = slides.length > 1 && !reducedMotion;

  useEffect(() => {
    if (!cycling) return;
    let timer = 0;
    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), interval);
    };
    const onVisibility = () => (document.hidden ? window.clearInterval(timer) : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [cycling, interval, slides.length]);

  return (
    <Root role="region" aria-roledescription="carrossel" aria-label={label} className={className}>
      {slides.map((slide, position) => {
        const { desktopSrcSet, mobile } = slideImages(slide);
        const active = position === index;
        return (
          <Slide key={slide.desktop} data-active={active || undefined} aria-hidden={!active}>
            <picture>
              <source media={DESKTOP_QUERY} srcSet={desktopSrcSet} sizes="60vw" />
              <img {...mobile} alt={slide.alt} />
            </picture>
          </Slide>
        );
      })}
    </Root>
  );
}
