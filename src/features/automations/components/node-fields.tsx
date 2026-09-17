"use client";

import { BracketsCurlyIcon } from "@phosphor-icons/react";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { onlyDigits } from "@/lib/masks";
import { variables, type FieldSpec, type NodeSpec } from "../catalog";
import type { NodeConfig } from "../summary";

export type NodeFieldsProps = {
  spec: NodeSpec;
  config: NodeConfig;
  onChange: (patch: NodeConfig) => void;
  /** Outros campos no lugar dos do catálogo do nó: as configurações comuns a todo passo. */
  fields?: FieldSpec[];
  /** Dentro do card do quadro: sem dicas, caixa de texto baixa. No painel, tudo. */
  compact?: boolean;
  className?: string;
};

/* O leque das variáveis, por grupo (Cliente, Cobrança, Contrato), que escreve o `{{caminho}}` no fim do
   campo: é o único jeito de a pessoa não ter de decorar os nomes. */
function variableSections(onInsert: (token: string) => void): DropdownSection[] {
  const groups = [...new Set(variables.map((entry) => entry.group))];
  return groups.map((group) => ({
    id: group,
    label: group,
    items: variables.filter((entry) => entry.group === group).map((entry) => ({ id: entry.token, label: entry.label, onSelect: () => onInsert(entry.token) })),
  }));
}

// Os campos de um nó, os que o catálogo declara para ele: texto, e-mail, endereço, número, lista, horário,
// interruptor e caixa de texto com o leque de variáveis. Um só desenho para o card do quadro (compacto), o
// painel do passo e a janela do passo, para o que se edita num lugar ser o mesmo do outro.
export function NodeFields({ spec, config, onChange, fields = spec.fields, compact = false, className }: NodeFieldsProps) {
  const visible = (field: FieldSpec) => !field.when || String(config[field.when.key] ?? "") === field.when.equals;
  const textOf = (key: string) => {
    const value = config[key];
    return value === undefined || value === null ? "" : String(value);
  };
  const append = (key: string, token: string) => {
    const current = textOf(key);
    onChange({ [key]: current && !/\s$/.test(current) ? `${current} ${token}` : `${current}${token}` });
  };

  return (
    <div className={className}>
      {fields.filter(visible).map((field) => {
        const label = field.variables ? (
          <span style={{ display: "inline-flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: "var(--space-1)" }}>
            {field.label}
            <DropdownMenu label={`Variáveis para ${field.label}`} triggerLabel="Inserir variável" sections={variableSections((token) => append(field.key, token))} icon={<BracketsCurlyIcon />} surface="solid" />
          </span>
        ) : (
          field.label
        );
        const hint = compact ? undefined : field.hint;

        if (field.type === "boolean") {
          return (
            <div key={field.key} style={{ display: "grid", gap: "var(--space-half)" }}>
              <Switch size="sm" checked={config[field.key] === true} onChange={(event) => onChange({ [field.key]: event.target.checked })}>
                {field.label}
              </Switch>
              {hint && (
                <Text variant="footnote" tone="secondary">
                  {hint}
                </Text>
              )}
            </div>
          );
        }
        if (field.type === "select") {
          return (
            <Field key={field.key} label={label} hint={hint}>
              <Select<string> label={field.label} size="sm" options={field.options ?? []} value={textOf(field.key) || undefined} onChange={(value) => onChange({ [field.key]: value })} />
            </Field>
          );
        }
        if (field.type === "textarea") {
          return (
            <Field key={field.key} label={label} hint={hint}>
              <Textarea size="sm" rows={compact ? 3 : 6} value={textOf(field.key)} placeholder={field.placeholder} className="nowheel" onChange={(event) => onChange({ [field.key]: event.target.value })} />
            </Field>
          );
        }
        if (field.type === "number") {
          return (
            <Field key={field.key} label={label} hint={hint}>
              <Input
                type="text"
                size="sm"
                mask="integer"
                inputMode="numeric"
                value={textOf(field.key)}
                onChange={(event) => {
                  const digits = onlyDigits(event.target.value);
                  const number = digits === "" ? (field.min ?? 0) : Math.min(field.max ?? 1_000_000, Math.max(field.min ?? 0, Number(digits)));
                  onChange({ [field.key]: number });
                }}
              />
            </Field>
          );
        }
        return (
          <Field key={field.key} label={label} hint={hint}>
            <Input type={field.type === "time" ? "time" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text"} size="sm" value={textOf(field.key)} placeholder={field.placeholder} autoComplete="off" onChange={(event) => onChange({ [field.key]: event.target.value })} />
          </Field>
        );
      })}
    </div>
  );
}
