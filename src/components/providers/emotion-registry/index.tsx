"use client";

import { useState } from "react";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { useServerInsertedHTML } from "next/navigation";

type Inserted = { name: string; isGlobal: boolean };

export function EmotionRegistry({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  const [registry] = useState(() => {
    const cache = createCache({ key: "sp", nonce });
    cache.compat = true;
    const previousInsert = cache.insert;
    let inserted: Inserted[] = [];

    cache.insert = (...args) => {
      const [selector, serialized] = args;
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push({ name: serialized.name, isGlobal: !selector });
      }
      return previousInsert(...args);
    };

    const flush = () => {
      const previous = inserted;
      inserted = [];
      return previous;
    };

    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const inserted = registry.flush();
    if (inserted.length === 0) return null;

    let styles = "";
    let dataEmotion = registry.cache.key;
    const globals: { name: string; style: string }[] = [];

    for (const { name, isGlobal } of inserted) {
      const style = registry.cache.inserted[name];
      if (typeof style === "string") {
        if (isGlobal) {
          globals.push({ name, style });
        } else {
          styles += style;
          dataEmotion += ` ${name}`;
        }
      }
    }

    return (
      <>
        {globals.map(({ name, style }) => (
          <style
            key={name}
            data-emotion={`${registry.cache.key}-global ${name}`}
            dangerouslySetInnerHTML={{ __html: style }}
          />
        ))}
        {styles && <style data-emotion={dataEmotion} dangerouslySetInnerHTML={{ __html: styles }} />}
      </>
    );
  });

  return <CacheProvider value={registry.cache}>{children}</CacheProvider>;
}
