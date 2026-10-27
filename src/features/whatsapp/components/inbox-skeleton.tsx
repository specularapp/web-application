import type { CSSProperties } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import inbox from "./inbox.module.css";
import styles from "./whatsapp-screen.module.css";

/* Os esqueletos da caixa de entrada, na medida do que entra no lugar, para nada saltar quando o dado chega. */

/** Balões de exemplo: alternam contato e equipe, com larguras diferentes, como uma conversa de verdade. */
const BUBBLES: { out: boolean; width: string }[] = [
  { out: false, width: "52%" },
  { out: false, width: "34%" },
  { out: true, width: "46%" },
  { out: false, width: "60%" },
  { out: true, width: "28%" },
  { out: true, width: "50%" },
];

export function ThreadSkeleton() {
  return (
    <div className={inbox.threadSkeleton} aria-hidden="true">
      {BUBBLES.map((bubble, index) => (
        <span key={index} className={inbox.skeletonBubble} data-out={bubble.out || undefined} style={{ width: bubble.width } as CSSProperties}>
          <Skeleton shape="rect" height="2.25rem" />
        </span>
      ))}
    </div>
  );
}

/** As linhas da lista: rosto, nome e hora, prévia. */
export function ListSkeleton({ rows = 9 }: { rows?: number }) {
  return (
    <ul className={inbox.listSkeleton} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index}>
          <Skeleton shape="circle" width="2.25rem" height="2.25rem" />
          <span>
            <Skeleton height="0.875rem" width={`${48 + ((index * 17) % 30)}%`} />
            <Skeleton height="0.75rem" width={`${62 + ((index * 23) % 30)}%`} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A tela inteira enquanto a rota carrega: a lista com as linhas e a conversa em espera, sem o topo. */
export function WhatsappSkeleton() {
  return (
    <div className={styles.page}>
      <span role="status" aria-live="polite" className={styles.status}>
        Carregando as conversas
      </span>
      <div className={inbox.screen} aria-hidden="true">
        <div className={inbox.list}>
          <div className={inbox.listHead}>
            <Skeleton width="8rem" height="1.25rem" />
            <Skeleton shape="rect" height="2.25rem" />
            <Skeleton shape="rect" width="85%" height="2rem" />
          </div>
          <div className={inbox.listBody}>
            <ListSkeleton />
          </div>
        </div>
        <div className={inbox.thread}>
          <ThreadSkeleton />
        </div>
      </div>
    </div>
  );
}
