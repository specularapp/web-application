import type { IconWeight } from "@phosphor-icons/react";
import { cloneElement, isValidElement, type ReactNode } from "react";

export function matchIconWeight(node: ReactNode, weight: IconWeight) {
  if (!isValidElement<{ weight?: IconWeight }>(node) || node.props.weight) return node;
  return cloneElement(node, { weight });
}
