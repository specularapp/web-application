"use client";

import { TrashIcon } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import { categories, nodeCatalog, settingsFields } from "../catalog";
import { automationLimits } from "../schemas";
import type { NodeConfig } from "../summary";
import type { FlowNodeType } from "./flow-node";
import { NodeFields } from "./node-fields";
import styles from "./automation-editor.module.css";

export type NodeConfigPanelProps = {
  node: FlowNodeType;
  onChange: (patch: NodeConfig) => void;
  onRename: (title: string) => void;
  onRemove: () => void;
};

// O painel do passo escolhido: o glifo, a categoria e o que o passo é em cima; o nome que a pessoa dá a ele;
// os mesmos campos do card, aqui com as dicas e mais espaço; as configurações que todo passo tem (tentar de
// novo, continuar se falhar, notas), recolhidas; e, no pé, remover o passo. O que muda aqui muda no card na
// hora, e o editor salva sozinho depois da pausa.
export function NodeConfigPanel({ node, onChange, onRename, onRemove }: NodeConfigPanelProps) {
  const spec = nodeCatalog[node.data.kind];
  const category = categories[spec.category];

  return (
    <div className={styles.config}>
      <header className={styles.configHead}>
        <span className={styles.configGlyph} style={{ "--item-hue": category.hue } as CSSProperties} aria-hidden="true" {...squircle("md")}>
          <spec.icon weight="duotone" />
        </span>
        <span className={styles.configCopy}>
          <Badge size="sm" hue={category.hue}>
            {category.single}
          </Badge>
          <Text as="h3" variant="subheadline" weight="semibold">
            {spec.label}
          </Text>
          <Text variant="caption1" tone="secondary">
            {spec.description}
          </Text>
        </span>
      </header>

      <Field label="Nome do passo">
        <Input type="text" size="sm" value={node.data.title ?? ""} maxLength={automationLimits.title} placeholder={spec.label} onChange={(event) => onRename(event.target.value)} />
      </Field>

      {spec.fields.length === 0 ? (
        <Text variant="footnote" tone="secondary">
          Este passo não tem o que configurar: ele dispara sozinho quando o evento acontece.
        </Text>
      ) : (
        <NodeFields spec={spec} config={node.data.config} onChange={onChange} className={styles.configFields} />
      )}

      <details className={styles.configSettings}>
        <summary className={styles.configSummary}>
          <Text as="span" variant="footnote" weight="semibold">
            Configurações do passo
          </Text>
          <Text as="span" variant="caption1" tone="secondary">
            Tentar de novo, continuar se falhar, notas
          </Text>
        </summary>
        <NodeFields spec={spec} config={node.data.config} onChange={onChange} fields={settingsFields} className={styles.configFields} />
      </details>

      <footer className={styles.configFoot}>
        <Button variant="ghost" size="sm" radius="md" iconStart={<TrashIcon />} onClick={onRemove}>
          Remover passo
        </Button>
      </footer>
    </div>
  );
}
