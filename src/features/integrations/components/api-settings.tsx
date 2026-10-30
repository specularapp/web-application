"use client";

import {
  ArrowClockwiseIcon,
  ArrowsClockwiseIcon,
  CodeIcon,
  CopySimpleIcon,
  EyeIcon,
  KeyIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlusIcon,
  ProhibitIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, DataTableDate, DataTableStatus, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import type { AiUsage } from "@/features/ai/summary";
import { SettingsPage, SettingsSection } from "@/features/settings/components/settings-page";
import { callAction } from "@/lib/action";
import {
  createApiKeyAction,
  deleteApiKeyAction,
  loadApiRequestsAction,
  revokeApiKeyAction,
  rotateApiKeyAction,
  setApiKeyEnabledAction,
  updateApiKeyAction,
} from "../actions";
import {
  DEFAULT_RATE_LIMIT,
  MAX_API_KEYS,
  accessCodeLabel,
  apiKeyStatus,
  apiKeyStatusLabel,
  apiScopes,
  scopeLabel,
  type ApiKeyStatus,
  type ApiKeyView,
  type ApiRequestView,
} from "../catalog";
import { ago, Choices, CodeBlock, dateTime, normalize, SecretDialog, useCopy, type SecretReveal } from "./shared";
import styles from "./integrations.module.css";

type StatusFilter = ApiKeyStatus | "all";

const statusTone: Record<ApiKeyStatus, BadgeTone> = { active: "success", paused: "neutral", expired: "warning", revoked: "danger" };

const allScopes = apiScopes.map((scope) => scope.id);
const readScopes = allScopes.filter((scope) => scope.endsWith(":ler"));

const dateOnly = (iso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

const curlOf = (baseUrl: string, key = "$SPECULAR_API_KEY") => `curl --request GET "${baseUrl}/clientes?page=1" \\
  --header "Authorization: Bearer ${key}" \\
  --header "Accept: application/json"`;

const errorCodes = [
  ["401", "Chave ausente, inválida, revogada, expirada ou pausada; ou quem criou a chave saiu da equipe."],
  ["403", "A chave não tem a permissão que a rota pede, o IP não está liberado, ou a rota só aceita a sessão de uma pessoa."],
  ["422", "O corpo não passou na validação. Confira os campos e os tipos."],
  ["429", "Passou do limite por minuto da chave. Espere o tempo do cabeçalho Retry-After."],
  ["400 e 500", "A regra recusou a operação, com o motivo em error, ou algo falhou do nosso lado."],
] as const;

/**
 * A API da equipe (2026-10-29, a pedido: "integração deixe completo tudo igual temos na Le Ange, crie uma página
 * dedicada para cada"). No alto o nome e a ação; a busca com o filtro de situação; a tabela das chaves com as
 * permissões, a validade, o limite e o último uso; o registro das chamadas feitas com chave; e como usar, com a
 * base, a autenticação, o exemplo e as rotas de cada permissão. O valor da chave aparece uma vez, ao criar e ao
 * renovar.
 */
export function ApiSettings({
  keys: initialKeys,
  requests: initialRequests,
  baseUrl,
  canManage,
  ai,
}: {
  keys: ApiKeyView[];
  requests: ApiRequestView[];
  baseUrl: string;
  canManage: boolean;
  ai: AiUsage;
}) {
  const { toast } = useToast();
  const copy = useCopy();
  const [keys, setKeys] = useState(initialKeys);
  const [requests, setRequests] = useState(initialRequests);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<ApiKeyView | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reveal, setReveal] = useState<SecretReveal | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "rotate" | "revoke" | "delete"; key: ApiKeyView } | null>(null);
  const [pending, setPending] = useState(false);
  const [requestKey, setRequestKey] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const opened = keys.find((key) => key.id === openId) ?? null;
  const inUse = keys.filter((key) => !key.revokedAt).length;
  const full = inUse >= MAX_API_KEYS;
  const nameOf = (id: string) => keys.find((key) => key.id === id)?.name ?? "Chave excluída";

  const visible = useMemo(() => {
    const search = normalize(query.trim());
    return keys.filter((key) => {
      if (status !== "all" && apiKeyStatus(key) !== status) return false;
      if (!search) return true;
      return normalize([key.name, key.description, key.prefix, ...key.scopes, ...key.scopes.map(scopeLabel)].join(" ")).includes(search);
    });
  }, [keys, query, status]);

  const shownRequests = requestKey === "all" ? requests : requests.filter((request) => request.keyId === requestKey);

  const replace = (next: ApiKeyView) => setKeys((current) => current.map((key) => (key.id === next.id ? next : key)));

  const reload = async () => {
    setRefreshing(true);
    const result = await callAction(loadApiRequestsAction({}));
    setRefreshing(false);
    if (!result.ok) {
      toast({ title: "Não deu para atualizar", description: result.error, tone: "danger" });
      return;
    }
    setRequests(result.requests);
  };

  const toggle = async (key: ApiKeyView) => {
    const result = await callAction(setApiKeyEnabledAction({ id: key.id, enabled: !key.enabled }));
    if (!result.ok) {
      toast({ title: key.enabled ? "Não deu para pausar" : "Não deu para reativar", description: result.error, tone: "danger" });
      return;
    }
    replace(result.key);
    toast({ title: result.key.enabled ? "Chave reativada" : "Chave pausada", description: result.key.enabled ? `${key.name} volta a abrir a API.` : `${key.name} recebe 401 até ser reativada.`, tone: "success" });
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, key } = confirm;
    setPending(true);
    if (kind === "rotate") {
      const result = await callAction(rotateApiKeyAction({ id: key.id }));
      setPending(false);
      if (!result.ok) return toast({ title: "Não deu para renovar", description: result.error, tone: "danger" });
      replace(result.key);
      setConfirm(null);
      setReveal({ title: "Chave renovada", description: result.key.name, secret: result.secret, example: { label: "Exemplo com a chave", code: curlOf(baseUrl, result.secret) } });
      return;
    }
    if (kind === "revoke") {
      const result = await callAction(revokeApiKeyAction({ id: key.id }));
      setPending(false);
      if (!result.ok) return toast({ title: "Não deu para revogar", description: result.error, tone: "danger" });
      replace(result.key);
      setConfirm(null);
      toast({ title: "Chave revogada", description: `${key.name} não abre mais a API.`, tone: "success" });
      return;
    }
    const result = await callAction(deleteApiKeyAction({ id: key.id }));
    setPending(false);
    if (!result.ok) return toast({ title: "Não deu para excluir", description: result.error, tone: "danger" });
    setKeys((current) => current.filter((item) => item.id !== key.id));
    setRequests((current) => current.filter((request) => request.keyId !== key.id));
    if (openId === key.id) setOpenId(null);
    setConfirm(null);
    toast({ title: "Chave excluída", description: key.name, tone: "success" });
  };

  const columns: DataTableColumn<ApiKeyView>[] = [
    { id: "name", header: "Chave", sortable: true, sortValue: (key) => key.name, cell: (key) => <DataTableTitle title={key.name} caption={`${key.prefix}…`} onClick={() => setOpenId(key.id)} /> },
    {
      id: "status",
      header: "Situação",
      sortable: true,
      sortValue: (key) => apiKeyStatus(key),
      cell: (key) => <DataTableStatus tone={statusTone[apiKeyStatus(key)]}>{apiKeyStatusLabel[apiKeyStatus(key)]}</DataTableStatus>,
    },
    {
      id: "scopes",
      header: "Permissões",
      cell: (key) => (
        <Badge tone="neutral" size="sm">
          {key.scopes.length === allScopes.length ? `Todas, ${allScopes.length}` : key.scopes.length === 1 ? scopeLabel(key.scopes[0]) : `${key.scopes.length} permissões`}
        </Badge>
      ),
    },
    {
      id: "expires",
      header: "Validade",
      hideBelow: "md",
      sortable: true,
      sortValue: (key) => key.expiresAt,
      cell: (key) => <span className={styles.muted}>{key.expiresAt ? dateOnly(key.expiresAt) : "Sem prazo"}</span>,
    },
    { id: "limit", header: "Limite", hideBelow: "lg", align: "end", sortable: true, sortValue: (key) => key.rateLimit, cell: (key) => <span className={styles.muted}>{key.rateLimit}/min</span> },
    {
      id: "used",
      header: "Último uso",
      sortable: true,
      sortValue: (key) => key.lastUsedAt,
      cell: (key) => <span className={styles.muted}>{key.lastUsedAt ? ago(key.lastUsedAt) : "Nunca usada"}</span>,
    },
    { id: "created", header: "Criada", hideBelow: "lg", sortable: true, sortValue: (key) => key.createdAt, cell: (key) => <DataTableDate iso={key.createdAt.slice(0, 10)} /> },
  ];

  const menuOf = (key: ApiKeyView) => {
    const revoked = Boolean(key.revokedAt);
    return (
      <DropdownMenu
        label={`Ações de ${key.name}`}
        triggerLabel={`Abrir ações de ${key.name}`}
        size="sm"
        sections={[
          {
            id: "view",
            items: [
              { id: "details", label: "Ver detalhes e uso", icon: EyeIcon, onSelect: () => setOpenId(key.id) },
              { id: "copy", label: "Copiar identificador", icon: CopySimpleIcon, onSelect: () => void copy(key.id) },
            ],
          },
          ...(canManage && !revoked
            ? [
                {
                  id: "manage",
                  items: [
                    { id: "edit", label: "Editar chave", icon: PencilSimpleIcon, onSelect: () => setEditing(key) },
                    { id: "toggle", label: key.enabled ? "Pausar chave" : "Reativar chave", icon: key.enabled ? PauseIcon : PlayIcon, onSelect: () => void toggle(key) },
                    { id: "rotate", label: "Renovar chave", icon: ArrowsClockwiseIcon, onSelect: () => setConfirm({ kind: "rotate", key }) },
                  ],
                },
              ]
            : []),
          ...(canManage
            ? [
                {
                  id: "danger",
                  items: [
                    ...(revoked ? [] : [{ id: "revoke", label: "Revogar chave", icon: ProhibitIcon, tone: "danger" as const, onSelect: () => setConfirm({ kind: "revoke", key }) }]),
                    { id: "delete", label: "Excluir chave", icon: TrashIcon, tone: "danger" as const, onSelect: () => setConfirm({ kind: "delete", key }) },
                  ],
                },
              ]
            : []),
        ]}
      />
    );
  };

  const filterSections: DropdownSection[] = [
    {
      id: "status",
      label: "Situação",
      items: (["all", "active", "paused", "expired", "revoked"] as const).map((value) => ({
        id: `status-${value}`,
        label: value === "all" ? `Todas, ${keys.length}` : `${apiKeyStatusLabel[value]}s, ${keys.filter((key) => apiKeyStatus(key) === value).length}`,
        selected: status === value,
        keepOpen: true,
        onSelect: () => setStatus(value),
      })),
    },
  ];

  const requestColumns: DataTableColumn<ApiRequestView>[] = [
    { id: "at", header: "Quando", cell: (request) => <span className={styles.muted}>{dateTime(request.createdAt)}</span> },
    { id: "key", header: "Chave", cell: (request) => <span className={styles.muted}>{nameOf(request.keyId)}</span> },
    { id: "method", header: "Método", cell: (request) => <span className={styles.method}>{request.method}</span> },
    { id: "path", header: "Endereço", cell: (request) => <span className={styles.url}>{request.path}</span> },
    {
      id: "result",
      header: "Resultado",
      cell: (request) => (
        <DataTableStatus tone={request.status === 200 ? "success" : request.status === 429 ? "warning" : "danger"}>
          {request.status === 200 ? "Liberada" : `${request.status}, ${request.code ? (accessCodeLabel[request.code] ?? request.code) : "Recusada"}`}
        </DataTableStatus>
      ),
    },
    { id: "ip", header: "IP", hideBelow: "lg", cell: (request) => <span className={styles.muted}>{request.ip ?? "Sem IP"}</span> },
  ];

  return (
    <SettingsPage ai={ai}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <Text as="h2" variant="title2" weight="semibold">
            API
          </Text>
          <Text variant="footnote" tone="secondary">
            Chaves para outro sistema (planilha, painel, n8n) ler e escrever os dados da equipe pela API, cada uma com as próprias permissões, validade e limite.
          </Text>
        </div>
        <div className={styles.heroActions}>
          {canManage && (
            <Button size="sm" radius="md" iconStart={<PlusIcon />} disabled={full} onClick={() => setEditing("new")}>
              Nova chave
            </Button>
          )}
        </div>
      </header>

      {!canManage ? (
        <Text variant="footnote" tone="secondary">
          Só o dono e os administradores do time veem e criam chaves de API. A documentação de uso fica abaixo.
        </Text>
      ) : keys.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState icon={KeyIcon} title="Nenhuma chave de API" description="Crie uma chave para outro sistema (planilha, painel, automação) ler e escrever os dados da equipe.">
            <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setEditing("new")}>
              Criar chave
            </Button>
          </EmptyState>
        </div>
      ) : (
        <>
          <PageToolbar
            search={{ value: query, onChange: setQuery, placeholder: "Buscar chave", label: "Buscar chave pelo nome, prefixo ou permissão" }}
            filters={filterSections}
            activeFilters={status === "all" ? [] : [{ id: "status", label: `${apiKeyStatusLabel[status]}s`, icon: KeyIcon, onClear: () => setStatus("all") }]}
          />
          <DataTable
            label="Chaves de API"
            rows={visible}
            rowKey={(key) => key.id}
            columns={columns}
            onRowClick={(key) => setOpenId(key.id)}
            actions={menuOf}
            empty={
              <Text variant="footnote" tone="secondary">
                Nenhuma chave com essa busca ou situação.
              </Text>
            }
          />
          <Text variant="footnote" tone="secondary">
            {inUse} de {MAX_API_KEYS} chaves em uso{full ? ". Revogue uma para criar outra" : ""}
          </Text>
        </>
      )}

      {canManage && (
        <SettingsSection
          title="Chamadas recentes"
          aside={
            <Button variant="outline" size="sm" radius="md" iconStart={<ArrowClockwiseIcon />} loading={refreshing} onClick={() => void reload()}>
              Atualizar
            </Button>
          }
        >
          <div className={styles.docs}>
            {keys.length > 0 && (
              <Select
                label="Filtrar por chave"
                value={requestKey}
                onChange={setRequestKey}
                size="sm"
                options={[{ value: "all", label: "Todas as chaves" }, ...keys.map((key) => ({ value: key.id, label: key.name, caption: `${key.prefix}…` }))]}
              />
            )}
            <DataTable
              label="Chamadas feitas com chave de API"
              rows={shownRequests}
              rowKey={(request) => String(request.id)}
              columns={requestColumns}
              empty={
                <Text variant="footnote" tone="secondary">
                  Nenhuma chamada ainda. Toda chamada feita com uma chave passa a aparecer aqui, liberada ou recusada, por trinta dias.
                </Text>
              }
            />
          </div>
        </SettingsSection>
      )}

      <SettingsSection title="Como usar">
        <ApiDocs baseUrl={baseUrl} />
      </SettingsSection>

      {editing && (
        <ApiKeyDialog
          apiKey={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(key, secret) => {
            if (secret) {
              setKeys((current) => [key, ...current]);
              setReveal({ title: "Chave criada", description: key.name, secret, example: { label: "Exemplo com a chave", code: curlOf(baseUrl, secret) } });
            } else {
              replace(key);
              toast({ title: "Chave salva", description: key.name, tone: "success" });
            }
            setEditing(null);
          }}
        />
      )}

      {opened && (
        <ApiKeyDetails
          apiKey={opened}
          requests={requests.filter((request) => request.keyId === opened.id)}
          canManage={canManage}
          onClose={() => setOpenId(null)}
          onEdit={() => setEditing(opened)}
          onRotate={() => setConfirm({ kind: "rotate", key: opened })}
          onRevoke={() => setConfirm({ kind: "revoke", key: opened })}
        />
      )}

      <SecretDialog reveal={reveal} onClose={() => setReveal(null)} />

      <ConfirmDialog
        open={confirm !== null}
        pending={pending}
        tone={confirm?.kind === "rotate" ? "default" : "danger"}
        title={confirm?.kind === "rotate" ? "Renovar esta chave?" : confirm?.kind === "revoke" ? "Revogar esta chave?" : "Excluir esta chave?"}
        description={
          !confirm
            ? ""
            : confirm.kind === "rotate"
              ? `O valor atual de ${confirm.key.name} para de funcionar na hora e um novo aparece uma vez. Nome, permissões e limites ficam.`
              : confirm.kind === "revoke"
                ? `${confirm.key.name} para de abrir a API na hora e não volta mais. Ela fica na lista, com o registro de chamadas.`
                : `${confirm.key.name} sai da lista junto com o registro de chamadas dela. Se estiver em uso, para de funcionar na hora.`
        }
        confirmLabel={confirm?.kind === "rotate" ? "Renovar chave" : confirm?.kind === "revoke" ? "Revogar chave" : "Excluir chave"}
        pendingLabel={confirm?.kind === "rotate" ? "Renovando" : confirm?.kind === "revoke" ? "Revogando" : "Excluindo"}
        onClose={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
      />
    </SettingsPage>
  );
}

/** A documentação de uso: a base, a autenticação, o exemplo, as rotas por permissão e o que cada erro quer dizer. */
function ApiDocs({ baseUrl }: { baseUrl: string }) {
  const copy = useCopy();
  return (
    <div className={styles.docs}>
      <dl className={styles.facts}>
        <div>
          <dt>Base</dt>
          <dd>
            <code>{baseUrl}</code>
            <Button variant="ghost" size="sm" radius="md" iconStart={<CopySimpleIcon />} onClick={() => void copy(baseUrl)}>
              Copiar
            </Button>
          </dd>
        </div>
        <div>
          <dt>Autenticação</dt>
          <dd>
            <code>Authorization: Bearer spk_live_…</code>
          </dd>
        </div>
        <div>
          <dt>Formato</dt>
          <dd>JSON em UTF-8, no corpo e na resposta; erros voltam como {"{ error, code }"}.</dd>
        </div>
      </dl>

      <CodeBlock title="Primeira chamada" code={curlOf(baseUrl)} copyLabel="Copiar exemplo" />

      <div className={styles.docBlock}>
        <Text as="h3" variant="subheadline" weight="semibold">
          Rotas por permissão
        </Text>
        <Text variant="footnote" tone="secondary">
          A chave só abre a rota cuja permissão ela tem. As rotas que não estão aqui aceitam só a sessão de uma pessoa, e a chave recebe 403.
        </Text>
        <div className={styles.endpoints}>
          {apiScopes.map((scope) => (
            <div key={scope.id} role="group" aria-label={scope.label}>
              <div className={styles.scopeHead}>
                <Text as="span" variant="footnote" weight="semibold">
                  {scope.label}
                </Text>
                <code>{scope.id}</code>
              </div>
              {scope.endpoints.map((endpoint) => (
                <div key={`${endpoint.method} ${endpoint.path}`} className={styles.endpoint}>
                  <span className={styles.method}>{endpoint.method}</span>
                  <code>{endpoint.path}</code>
                  <span>{endpoint.description}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.docBlock}>
        <Text as="h3" variant="subheadline" weight="semibold">
          Quando algo dá errado
        </Text>
        <ul className={styles.codes}>
          {errorCodes.map(([code, text]) => (
            <li key={code}>
              <code>{code}</code> {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

type Expiry = "keep" | "none" | "30" | "90" | "365";

const expiryOf = (choice: Expiry, current: string | null) => {
  if (choice === "keep") return current;
  if (choice === "none") return null;
  return new Date(Date.now() + Number(choice) * 86_400_000).toISOString();
};

/** Criar e editar: nome, descrição, permissões, validade, limite por minuto, IPs liberados e a chave ligada. */
function ApiKeyDialog({ apiKey, onClose, onSaved }: { apiKey: ApiKeyView | null; onClose: () => void; onSaved: (key: ApiKeyView, secret?: string) => void }) {
  const [name, setName] = useState(apiKey?.name ?? "");
  const [description, setDescription] = useState(apiKey?.description ?? "");
  const [scopes, setScopes] = useState<string[]>(apiKey?.scopes ?? readScopes);
  const [expiry, setExpiry] = useState<Expiry>(apiKey ? (apiKey.expiresAt ? "keep" : "none") : "90");
  const [rateLimit, setRateLimit] = useState(String(apiKey?.rateLimit ?? DEFAULT_RATE_LIMIT));
  const [ips, setIps] = useState((apiKey?.allowedIps ?? []).join("\n"));
  const [enabled, setEnabled] = useState(apiKey?.enabled ?? true);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const expiryOptions: { value: Expiry; label: string }[] = [
    ...(apiKey?.expiresAt ? [{ value: "keep" as const, label: `Manter até ${dateOnly(apiKey.expiresAt)}` }] : []),
    { value: "none", label: "Sem prazo" },
    { value: "30", label: "30 dias a partir de hoje" },
    { value: "90", label: "90 dias a partir de hoje" },
    { value: "365", label: "1 ano a partir de hoje" },
  ];

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const values = {
      name,
      description,
      scopes,
      enabled,
      expiresAt: expiryOf(expiry, apiKey?.expiresAt ?? null),
      rateLimit: Number(rateLimit),
      allowedIps: ips
        .split(/\s+/)
        .map((ip) => ip.trim())
        .filter(Boolean),
    };
    if (apiKey) {
      const result = await callAction(updateApiKeyAction({ ...values, id: apiKey.id }));
      setSaving(false);
      if (!result.ok) return setError({ message: result.error, field: result.field });
      onSaved(result.key);
    } else {
      const result = await callAction(createApiKeyAction(values));
      setSaving(false);
      if (!result.ok) return setError({ message: result.error, field: result.field });
      onSaved(result.key, result.secret);
    }
  };

  const fieldError = (field: string) => (error && (error.field?.split(".")[0] === field || (field === "name" && !error.field)) ? error.message : undefined);

  return (
    <Dialog open onClose={onClose} label={apiKey ? "Editar chave" : "Nova chave"} size="lg" surface="solid" focusOnOpen={false}>
      <DialogHeader title={apiKey ? "Editar chave" : "Nova chave de API"} description="Quem usa, o que pode e por quanto tempo" onClose={onClose} />
      <form onSubmit={(event) => void save(event)} noValidate className={styles.form}>
        <div className={styles.row}>
          <Field label="Nome" required error={fieldError("name")}>
            <Input value={name} maxLength={60} placeholder="Planilha financeira" disabled={saving} invalid={Boolean(fieldError("name"))} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Validade" error={fieldError("expiresAt")}>
            <Select label="Validade" value={expiry} onChange={setExpiry} options={expiryOptions} disabled={saving} />
          </Field>
        </div>
        <Field label="Descrição" error={fieldError("description")}>
          <Textarea value={description} rows={2} maxLength={500} placeholder="Para que serve e quem cuida dela" disabled={saving} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Choices
          legend="Permissões"
          options={apiScopes}
          value={scopes}
          onChange={setScopes}
          disabled={saving}
          error={fieldError("scopes")}
          shortcuts={[
            { label: "Todas", ids: allScopes },
            { label: "Só consultar", ids: readScopes },
            { label: "Limpar", ids: [] },
          ]}
        />
        <div className={styles.row}>
          <Field label="Chamadas por minuto" error={fieldError("rateLimit")}>
            <Input type="number" inputMode="numeric" min={1} max={1000} value={rateLimit} disabled={saving} onChange={(event) => setRateLimit(event.target.value)} />
          </Field>
          <Field label="IPs liberados" error={fieldError("allowedIps")}>
            <Textarea value={ips} rows={2} placeholder="Um por linha; vazio libera qualquer IP" spellCheck={false} disabled={saving} onChange={(event) => setIps(event.target.value)} />
          </Field>
        </div>
        <Switch checked={enabled} disabled={saving} onChange={(event) => setEnabled(event.target.checked)}>
          Chave habilitada
        </Switch>
        <DialogFooter mobile="always">
          <Button type="button" variant="ghost" size="sm" radius="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" radius="md" loading={saving}>
            {apiKey ? "Salvar alterações" : "Criar chave"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/** O detalhe de uma chave: o cadastro, o acesso, a atividade e as últimas chamadas dela. */
function ApiKeyDetails({
  apiKey,
  requests,
  canManage,
  onClose,
  onEdit,
  onRotate,
  onRevoke,
}: {
  apiKey: ApiKeyView;
  requests: ApiRequestView[];
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRotate: () => void;
  onRevoke: () => void;
}) {
  const state = apiKeyStatus(apiKey);
  const allowed = requests.filter((request) => request.status === 200).length;
  const facts: [string, ReactNode][] = [
    ["Situação", <DataTableStatus key="status" tone={statusTone[state]}>{apiKeyStatusLabel[state]}</DataTableStatus>],
    ["Prefixo", <code key="prefix">{apiKey.prefix}…</code>],
    ["Identificador", <code key="id">{apiKey.id}</code>],
    ["Validade", apiKey.expiresAt ? dateTime(apiKey.expiresAt) : "Sem prazo"],
    ["Limite", `${apiKey.rateLimit} chamadas por minuto`],
    ["IPs liberados", apiKey.allowedIps.length ? apiKey.allowedIps.join(", ") : "Qualquer IP"],
    ["Último uso", apiKey.lastUsedAt ? `${dateTime(apiKey.lastUsedAt)}${apiKey.lastUsedIp ? `, de ${apiKey.lastUsedIp}` : ""}` : "Nunca usada"],
    ["Chamadas", `${requests.length} nos últimos trinta dias, ${allowed} liberadas`],
    ["Criada", dateTime(apiKey.createdAt)],
    ...(apiKey.rotatedAt ? ([["Renovada", dateTime(apiKey.rotatedAt)]] as [string, string][]) : []),
    ...(apiKey.revokedAt ? ([["Revogada", dateTime(apiKey.revokedAt)]] as [string, string][]) : []),
  ];

  return (
    <Dialog open onClose={onClose} label={`Chave ${apiKey.name}`} size="lg" surface="solid" focusOnOpen={false}>
      <DialogHeader
        title={apiKey.name}
        description={apiKey.description || "Chave de API"}
        before={
          <span className={styles.dialogMark} aria-hidden="true">
            <CodeIcon />
          </span>
        }
        onClose={onClose}
      />
      <div className={styles.dialogBody}>
        <dl className={styles.facts}>
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <section className={styles.dialogSection} aria-labelledby="key-scopes">
          <Text as="h3" id="key-scopes" variant="subheadline" weight="semibold">
            O que a chave permite
          </Text>
          <div className={styles.endpoints}>
            {apiScopes
              .filter((scope) => apiKey.scopes.includes(scope.id))
              .map((scope) => (
                <div key={scope.id} role="group" aria-label={scope.label}>
                  <div className={styles.scopeHead}>
                    <Text as="span" variant="footnote" weight="semibold">
                      {scope.label}
                    </Text>
                    <code>{scope.id}</code>
                  </div>
                  {scope.endpoints.map((endpoint) => (
                    <div key={`${endpoint.method} ${endpoint.path}`} className={styles.endpoint}>
                      <span className={styles.method}>{endpoint.method}</span>
                      <code>{endpoint.path}</code>
                      <span>{endpoint.description}</span>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </section>

        <section className={styles.dialogSection} aria-labelledby="key-requests">
          <Text as="h3" id="key-requests" variant="subheadline" weight="semibold">
            Últimas chamadas
          </Text>
          {requests.length === 0 ? (
            <Text variant="footnote" tone="secondary">
              Nenhuma chamada com esta chave nos últimos trinta dias.
            </Text>
          ) : (
            <ul className={styles.codes}>
              {requests.slice(0, 8).map((request) => (
                <li key={request.id}>
                  <code>{request.method}</code> {request.path}, {request.status === 200 ? "liberada" : (accessCodeLabel[request.code ?? ""] ?? `HTTP ${request.status}`).toLocaleLowerCase("pt-BR")}, {ago(request.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {canManage && !apiKey.revokedAt && (
        <DialogFooter mobile="always">
          <Button variant="ghost" size="sm" radius="md" iconStart={<ProhibitIcon />} onClick={onRevoke} className={styles.removeButton}>
            Revogar
          </Button>
          <Button variant="outline" size="sm" radius="md" iconStart={<ArrowsClockwiseIcon />} onClick={onRotate}>
            Renovar
          </Button>
          <Button size="sm" radius="md" iconStart={<PencilSimpleIcon />} onClick={onEdit}>
            Editar
          </Button>
        </DialogFooter>
      )}
    </Dialog>
  );
}
