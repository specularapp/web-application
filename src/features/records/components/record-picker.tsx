"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { squircle } from "@/lib/corners";
import { slugify } from "@/lib/utils/slug";
import { RECORDS_PER_KIND, recordKindValues, recordKinds, type AppRecord, type RecordKind } from "../records";
import { RecordMediaView } from "./record-media";
import styles from "./record-picker.module.css";

export type RecordPickerProps = {
  records: AppRecord[];
  /** O que fazer com o escolhido: vincular à tarefa, escrever no comentário. */
  onPick: (record: AppRecord) => void;
  /** Os tipos que a aba "Todos" cobre; sem isto, todos os do índice. */
  kinds?: RecordKind[];
  /** Nome do campo de busca para leitor de tela. */
  label?: string;
  placeholder?: string;
};

/* A busca compara pelo mesmo formato dos dois lados, então acento e maiúscula não atrapalham. */
const matches = (record: AppRecord, needle: string) =>
  !needle ||
  [record.name, record.reference ?? "", record.caption ?? ""].some((field) => slugify(field, 200).includes(needle));

// O seletor do que existe na aplicação (2026-09-10, a pedido, sobre uma referência de menção do usuário):
// a busca em cima, as abas por tipo, e a lista agrupada com o azulejo do domínio, o nome, o identificador e a
// linha de apoio. Pessoa entra com o rosto no lugar do azulejo, porque gente se reconhece pela cara.
//
// É a mesma peça em dois lugares: o `#` do comentário, que escreve o identificador no texto, e o vincular
// registro da ficha, que amarra o registro à tarefa. Um só desenho para as duas coisas, porque a pergunta é a
// mesma, "qual registro?", e o que muda é só o que se faz com a resposta.
//
// A aba "Todos" mostra os primeiros de cada tipo, e não uma lista corrida: com sessenta clientes e quarenta
// orçamentos, a ordem corrida enterrava as tarefas. Quem quer a lista inteira de um tipo abre a aba dele.
export function RecordPicker({ records, onPick, kinds, label = "Buscar na aplicação", placeholder = "Buscar por nome ou identificador" }: RecordPickerProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<RecordKind | "all">("all");
  const field = useRef<HTMLInputElement>(null);

  const available = useMemo(() => {
    const listed = kinds ?? recordKindValues;
    return listed.filter((kind) => records.some((record) => record.kind === kind));
  }, [kinds, records]);

  const groups = useMemo(() => {
    const needle = slugify(query, 200);
    const found = records.filter((record) => matches(record, needle));
    const listed = tab === "all" ? available : [tab];
    return listed
      .map((kind) => {
        const items = found.filter((record) => record.kind === kind);
        return { kind, items: tab === "all" ? items.slice(0, RECORDS_PER_KIND) : items, total: items.length };
      })
      .filter((group) => group.items.length > 0);
  }, [available, query, records, tab]);

  return (
    <div className={styles.picker}>
      <label className={styles.find} {...squircle("md")}>
        <MagnifyingGlassIcon aria-hidden="true" />
        <input
          ref={field}
          type="search"
          className={styles.input}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
      </label>

      {/* As abas por tipo, com "Todos" na frente: é uma escolha entre recortes da mesma lista, e não
          navegação, então `radiogroup` em vez de `tablist`. */}
      <div className={styles.tabs} role="radiogroup" aria-label="Tipo de registro">
        <button
          type="button"
          role="radio"
          aria-checked={tab === "all"}
          className={styles.tab}
          data-on={tab === "all" || undefined}
          onClick={() => setTab("all")}
        >
          Todos
        </button>
        {available.map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={tab === kind}
            className={styles.tab}
            data-on={tab === kind || undefined}
            onClick={() => setTab(kind)}
          >
            {recordKinds[kind].plural}
          </button>
        ))}
      </div>

      <div className={styles.results}>
        {groups.length === 0 ? (
          <div className={styles.empty}>
            <Text variant="footnote" tone="tertiary">
              Nada bateu com o que você procurou.
            </Text>
          </div>
        ) : (
          groups.map((group) => {
            const kind = recordKinds[group.kind];

            return (
              <section key={group.kind} className={styles.group}>
                {/* O nome do grupo numa ponta e, quando a aba "Todos" corta a lista, a contagem em etiqueta
                    na outra (2026-09-10, a pedido): separar com bolinha é coisa que a casa não usa. */}
                <div className={styles.groupHead}>
                  <Text as="h3" variant="caption1" weight="semibold" tone="secondary">
                    {kind.plural}
                  </Text>
                  {tab === "all" && group.total > group.items.length && (
                    <Badge tone="neutral" size="sm">
                      {group.items.length} de {group.total}
                    </Badge>
                  )}
                </div>
                <ul className={styles.list}>
                  {group.items.map((record) => (
                    <li key={record.key}>
                      <button type="button" className={styles.row} onClick={() => onPick(record)} {...squircle("md")}>
                        {/* Quem tem rosto mostra o rosto; um orçamento mostra as artes dos serviços dele; o
                            resto fica no azulejo do domínio. Tudo na mídia de registro da casa. */}
                        <RecordMediaView kind={record.kind} media={record.media} name={record.name} />
                        {/* O identificador vai em etiqueta, e a linha de apoio em texto: os dois lado a lado
                            sem nada separando, porque a etiqueta já se separa sozinha. */}
                        <span className={styles.copy}>
                          <Text as="span" variant="subheadline" weight="medium" truncate>
                            {record.name}
                          </Text>
                          {(record.reference || record.caption) && (
                            <span className={styles.meta}>
                              {record.reference && (
                                <Badge tone="neutral" size="sm" className={styles.reference}>
                                  {record.reference}
                                </Badge>
                              )}
                              {record.caption && (
                                <Text as="span" variant="caption1" tone="secondary" truncate>
                                  {record.caption}
                                </Text>
                              )}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
