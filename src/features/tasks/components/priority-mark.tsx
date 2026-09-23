import { FlagIcon } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { priorityHues } from "../labels";
import type { TaskPriority } from "../summary";

/** A bandeira no matiz da prioridade, para toda lista de prioridade dizer qual é qual pela cor e não só pelo nome. */
export const priorityMark = (priority: TaskPriority) => <FlagIcon weight="bold" style={{ color: priorityHues[priority] } as CSSProperties} />;
