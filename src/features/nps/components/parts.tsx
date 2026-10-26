import type { CSSProperties, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/metadata";
import { groupLabels, groupOf, groups } from "../labels";
import type { GroupShares } from "../analytics";
import styles from "./nps.module.css";

export const NPS_BASE = "/nps";

/** O link pessoal que o cliente abre para responder. */
export const surveyLink = (token: string) => `${siteConfig.url}/pesquisa/${token}`;

/** A nota num quadradinho na tinta da faixa. */
export function ScoreBubble({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const group = groupOf(score);
  return (
    <span className={styles.score} data-group={group} data-size={size} title={`Nota ${score}, ${groupLabels[group].label.toLowerCase()}`}>
      {score}
    </span>
  );
}

export function GroupBadge({ score }: { score: number }) {
  const meta = groupLabels[groupOf(score)];
  return (
    <Badge tone={meta.tone} size="sm">
      {meta.label}
    </Badge>
  );
}

/** A parte de cada faixa numa barra fina, na largura de cada uma. */
export function SharesBar({ shares, label }: { shares: GroupShares; label: string }) {
  const total = shares.promoter + shares.passive + shares.detractor;
  return (
    <span className={styles.shares} role="img" aria-label={label}>
      {total > 0 && groups.map((group) => (shares[group] > 0 ? <i key={group} style={{ flexGrow: shares[group], "--share": groupLabels[group].color } as CSSProperties} /> : null))}
    </span>
  );
}

const RADIUS = 86;
const CIRCLE = 2 * Math.PI * RADIUS;

/** Um anel em arcos: cada parte na cor dela, com 2px de respiro entre elas. */
export function NpsRing({ parts, label, children }: { parts: { value: number; color: string }[]; label: string; children: ReactNode }) {
  const visible = parts.filter((part) => part.value > 0);
  const gap = visible.length > 1 ? 4 : 0;
  const arcs = visible.map((part, index) => ({
    ...part,
    length: Math.max(0, (part.value / 100) * CIRCLE - gap),
    offset: visible.slice(0, index).reduce((sum, before) => sum + (before.value / 100) * CIRCLE, 0),
  }));
  return (
    <div className={styles.ring} role="img" aria-label={label}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r={RADIUS} className={styles.ringTrack} />
        {arcs.map((arc) => (
          <circle key={arc.color} cx="100" cy="100" r={RADIUS} className={styles.ringArc} style={{ stroke: arc.color }} strokeDasharray={`${arc.length} ${CIRCLE - arc.length}`} strokeDashoffset={-arc.offset} />
        ))}
      </svg>
      <div className={styles.ringCenter}>{children}</div>
    </div>
  );
}
