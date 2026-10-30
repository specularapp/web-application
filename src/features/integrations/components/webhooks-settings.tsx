"use client";

import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  KeyIcon,
  PaperPlaneRightIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
  WebhooksLogoIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, DataTableDate, DataTableStatus, DataTableTitle, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { DropdownMenu, type DropdownSection } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import type { AiUsage } from "@/features/ai/summary";
import { SettingsPage, SettingsSection } from "@/features/settings/components/settings-page";
import { callAction } from "@/lib/action";
import {
  createWebhookAction,
  deleteWebhookAction,
  loadDeliveriesAction,
  redeliverWebhookAction,
  rotateWebhookSecretAction,
  setWebhookActiveAction,
  testWebhookAction,
  updateWebhookAction,
} from "../actions";
import { MAX_WEBHOOKS, eventLabel, webhookEvents, webhookName, type WebhookDeliveryView, type WebhookView } from "../catalog";
import { ago, Choices, CodeBlock, dateTime, normalize, SecretDialog, useCopy, type SecretReveal } from "./shared";
import styles from "./integrations.module.css";

type StatusFilter = "all" | "active" | "paused";

const allEvents = webhookEvents.map((event) => event.id);

/** A resposta de uma entrega em palavras, com o tom do glifo. */
function deliveryResult(delivery: WebhookDeliveryView | null) {
  if (!delivery) return { label: "Sem entregas", tone: "neutral", icon: ClockIcon } as const;
  if (delivery.status === "pending") return { label: "Aguardando envio", tone: "warning", icon: ClockIcon } as const;
  if (delivery.status === "delivered") return { label: `Entregue, HTTP ${delivery.responseStatus ?? ""}`.trim(), tone: "success", icon: CheckIcon } as const;
  return { label: delivery.responseStatus ? `Falhou, HTTP ${delivery.responseStatus}` : "Sem resposta", tone: "danger", icon: WarningCircleIcon } as const;
}

function DeliveryResult({ delivery }: { delivery: WebhookDeliveryView | null }) {
  const result = deliveryResult(delivery);
  return (
    <span className={styles.result} data-tone={result.tone}>
      <result.icon aria-hidden="true" weight="bold" />
      {result.label}
    </span>
  );
}

const verifyExample = `import { createHmac, timingSafeEqual } from "node:crypto";

// secret: o valor "whsec_..." mostrado ao criar ou girar o segredo
// body: o corpo da requisição exatamente como chegou, em texto
export function verify(secret, headers, body) {
  const id = headers["webhook-id"];
  const timestamp = headers["webhook-timestamp"];
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const expected = createHmac("sha256", key).update(\`\${id}.\${timestamp}.\${body}\`).digest();

  return headers["webhook-signature"].split(" ").some((signature) => {
    const received = Buffer.from(signature.replace(/^v1,/, ""), "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}`;

const payloadExample = `POST https://seu-sistema.com/webhooks/specular
Content-Type: application/json
User-Agent: Specular-Webhooks/1.0
X-Specular-Event: cliente.criado
X-Specular-Delivery: 1f0c7a52-...
webhook-id: 9b2e4c10-...
webhook-timestamp: 1793280000
webhook-signature: v1,K5oZfzN95Z9UVu1EsfQmfVNQhnkZ2pj9o9NDN/H/pI4=

{
  "id": "9b2e4c10-...",
  "event": "cliente.criado",
  "createdAt": "2026-10-29T18:00:00.000Z",
  "data": { "id": "...", "nome": "Ana Souza", "email": "ana@exemplo.com" }
}`;

/**
 * Os webhooks da equipe (2026-10-29, a pedido: "integração deixe completo tudo igual temos na Le Ange, crie uma
 * página dedicada para cada"). No alto o nome e a ação; a busca com o filtro de situação; a tabela com o destino, os
 * eventos, a situação e a última entrega; e embaixo como conferir a assinatura. A linha abre o detalhe, com as
 * entregas, o reenvio e o teste; o leque testa, edita, pausa, gira o segredo e apaga.
 */
export function WebhooksSettings({ webhooks: initial, canManage, ai }: { webhooks: WebhookView[]; canManage: boolean; ai: AiUsage }) {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<WebhookView | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reveal, setReveal] = useState<SecretReveal | null>(null);
  const [removing, setRemoving] = useState<WebhookView | null>(null);
  const [rotating, setRotating] = useState<WebhookView | null>(null);
  const [pending, setPending] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [lastTest, setLastTest] = useState<WebhookDeliveryView | null>(null);

  const opened = webhooks.find((webhook) => webhook.id === openId) ?? null;
  const full = webhooks.length >= MAX_WEBHOOKS;

  const visible = useMemo(() => {
    const search = normalize(query.trim());
    return webhooks.filter((webhook) => {
      if (status === "active" && !webhook.active) return false;
      if (status === "paused" && webhook.active) return false;
      if (!search) return true;
      return normalize([webhook.description, webhook.url, ...webhook.events, ...webhook.events.map(eventLabel)].join(" ")).includes(search);
    });
  }, [webhooks, query, status]);

  const replace = (next: WebhookView) => setWebhooks((current) => current.map((webhook) => (webhook.id === next.id ? { ...next, lastDelivery: next.lastDelivery ?? webhook.lastDelivery } : webhook)));

  const test = async (webhook: WebhookView) => {
    setTesting(webhook.id);
    const result = await callAction(testWebhookAction({ id: webhook.id }));
    setTesting(null);
    if (!result.ok) {
      toast({ title: "Não deu para testar", description: result.error, tone: "danger" });
      return;
    }
    setWebhooks((current) => current.map((item) => (item.id === webhook.id ? { ...item, lastDelivery: result.delivery } : item)));
    setLastTest(result.delivery);
    if (result.delivery.status === "delivered")
      toast({ title: "Teste entregue", description: `HTTP ${result.delivery.responseStatus} em ${result.delivery.durationMs} ms.`, tone: "success" });
    else toast({ title: "Teste não entregue", description: result.delivery.error ?? "O destino não confirmou o recebimento.", tone: "warning" });
  };

  const toggle = async (webhook: WebhookView) => {
    const result = await callAction(setWebhookActiveAction({ id: webhook.id, enabled: !webhook.active }));
    if (!result.ok) {
      toast({ title: webhook.active ? "Não deu para pausar" : "Não deu para ativar", description: result.error, tone: "danger" });
      return;
    }
    replace(result.webhook);
    toast({
      title: result.webhook.active ? "Webhook ativo" : "Webhook pausado",
      description: result.webhook.active ? `${webhookName(result.webhook)} volta a receber eventos.` : `${webhookName(result.webhook)} não recebe nada até ser ativado.`,
      tone: "success",
    });
  };

  const rotate = async () => {
    if (!rotating) return;
    setPending(true);
    const result = await callAction(rotateWebhookSecretAction({ id: rotating.id }));
    setPending(false);
    if (!result.ok) {
      toast({ title: "Não deu para girar o segredo", description: result.error, tone: "danger" });
      return;
    }
    replace(result.webhook);
    setRotating(null);
    setReveal({ title: "Segredo novo", description: webhookName(result.webhook), secret: result.secret });
  };

  const remove = async () => {
    if (!removing) return;
    setPending(true);
    const result = await callAction(deleteWebhookAction({ id: removing.id }));
    setPending(false);
    if (!result.ok) {
      toast({ title: "Não deu para apagar", description: result.error, tone: "danger" });
      return;
    }
    setWebhooks((current) => current.filter((webhook) => webhook.id !== removing.id));
    if (openId === removing.id) setOpenId(null);
    toast({ title: "Webhook apagado", description: webhookName(removing), tone: "success" });
    setRemoving(null);
  };

  const columns: DataTableColumn<WebhookView>[] = [
    {
      id: "name",
      header: "Webhook",
      sortable: true,
      sortValue: (webhook) => webhookName(webhook),
      cell: (webhook) => <DataTableTitle title={webhookName(webhook)} caption={webhook.description ? new URL(webhook.url).host : undefined} onClick={() => setOpenId(webhook.id)} />,
    },
    { id: "url", header: "Destino", hideBelow: "md", cell: (webhook) => <span className={styles.url}>{webhook.url}</span> },
    {
      id: "events",
      header: "Eventos",
      cell: (webhook) => (
        <Badge tone="neutral" size="sm">
          {webhook.events.length === allEvents.length ? `Todos, ${allEvents.length}` : webhook.events.length === 1 ? eventLabel(webhook.events[0]) : `${webhook.events.length} eventos`}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Situação",
      sortable: true,
      sortValue: (webhook) => (webhook.active ? 0 : 1),
      cell: (webhook) => <DataTableStatus tone={webhook.active ? "success" : "neutral"}>{webhook.active ? "Ativo" : "Pausado"}</DataTableStatus>,
    },
    { id: "result", header: "Última resposta", cell: (webhook) => <DeliveryResult delivery={webhook.lastDelivery} /> },
    {
      id: "latency",
      header: "Latência",
      hideBelow: "lg",
      align: "end",
      sortable: true,
      sortValue: (webhook) => webhook.lastDelivery?.durationMs ?? null,
      cell: (webhook) => <span className={styles.muted}>{webhook.lastDelivery?.durationMs != null ? `${webhook.lastDelivery.durationMs} ms` : "Sem medida"}</span>,
    },
    {
      id: "last",
      header: "Última entrega",
      hideBelow: "lg",
      sortable: true,
      sortValue: (webhook) => webhook.lastDelivery?.createdAt ?? null,
      cell: (webhook) => <span className={styles.muted}>{webhook.lastDelivery ? ago(webhook.lastDelivery.createdAt) : "Nunca"}</span>,
    },
    { id: "created", header: "Criado", hideBelow: "lg", sortable: true, sortValue: (webhook) => webhook.createdAt, cell: (webhook) => <DataTableDate iso={webhook.createdAt.slice(0, 10)} /> },
  ];

  const menuOf = (webhook: WebhookView) => (
    <DropdownMenu
      label={`Ações de ${webhookName(webhook)}`}
      triggerLabel={`Abrir ações de ${webhookName(webhook)}`}
      size="sm"
      sections={[
        {
          id: "view",
          items: [
            { id: "details", label: "Ver detalhes e entregas", icon: EyeIcon, onSelect: () => setOpenId(webhook.id) },
            ...(canManage && webhook.active ? [{ id: "test", label: "Enviar teste", icon: PaperPlaneRightIcon, onSelect: () => void test(webhook) }] : []),
          ],
        },
        ...(canManage
          ? [
              {
                id: "manage",
                items: [
                  { id: "edit", label: "Editar", icon: PencilSimpleIcon, onSelect: () => setEditing(webhook) },
                  { id: "toggle", label: webhook.active ? "Pausar" : "Ativar", icon: webhook.active ? PauseIcon : PlayIcon, onSelect: () => void toggle(webhook) },
                  { id: "rotate", label: "Girar segredo", icon: KeyIcon, onSelect: () => setRotating(webhook) },
                ],
              },
              { id: "danger", items: [{ id: "remove", label: "Apagar", icon: TrashIcon, tone: "danger" as const, onSelect: () => setRemoving(webhook) }] },
            ]
          : []),
      ]}
    />
  );

  const filterSections: DropdownSection[] = [
    {
      id: "status",
      label: "Situação",
      items: (
        [
          ["all", `Todos, ${webhooks.length}`],
          ["active", `Ativos, ${webhooks.filter((webhook) => webhook.active).length}`],
          ["paused", `Pausados, ${webhooks.filter((webhook) => !webhook.active).length}`],
        ] as const
      ).map(([value, label]) => ({ id: `status-${value}`, label, selected: status === value, keepOpen: true, onSelect: () => setStatus(value) })),
    },
  ];

  const createButton = canManage && (
    <Button size="sm" radius="md" iconStart={<PlusIcon />} disabled={full} onClick={() => setEditing("new")}>
      Novo webhook
    </Button>
  );

  return (
    <SettingsPage ai={ai}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <Text as="h2" variant="title2" weight="semibold">
            Webhooks
          </Text>
          <Text variant="footnote" tone="secondary">
            Um aviso assinado para o seu sistema a cada evento da casa: cliente criado, orçamento respondido, contrato enviado e assinado, pagamento recebido.
          </Text>
        </div>
        <div className={styles.heroActions}>{createButton}</div>
      </header>

      {webhooks.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState
            icon={WebhooksLogoIcon}
            title="Nenhum webhook"
            description="Cadastre um endereço seu para receber um aviso a cada cliente novo, orçamento respondido, contrato assinado e pagamento recebido."
          >
            {canManage && (
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={() => setEditing("new")}>
                Criar webhook
              </Button>
            )}
          </EmptyState>
        </div>
      ) : (
        <>
          <PageToolbar
            search={{ value: query, onChange: setQuery, placeholder: "Buscar webhook", label: "Buscar webhook pela descrição, endereço ou evento" }}
            filters={filterSections}
            activeFilters={status === "all" ? [] : [{ id: "status", label: status === "active" ? "Ativos" : "Pausados", icon: status === "active" ? PlayIcon : PauseIcon, onClear: () => setStatus("all") }]}
          />
          <DataTable
            label="Webhooks"
            rows={visible}
            rowKey={(webhook) => webhook.id}
            columns={columns}
            onRowClick={(webhook) => setOpenId(webhook.id)}
            actions={menuOf}
            empty={
              <Text variant="footnote" tone="secondary">
                Nenhum webhook com essa busca ou situação.
              </Text>
            }
          />
          <Text variant="footnote" tone="secondary">
            {webhooks.length} de {MAX_WEBHOOKS} webhooks
          </Text>
        </>
      )}

      {!canManage && (
        <Text variant="footnote" tone="secondary">
          Só o dono e os administradores do time cadastram, testam e apagam webhooks.
        </Text>
      )}

      <SettingsSection title="Como conferir a assinatura">
        <div className={styles.docs}>
          <Text variant="footnote" tone="secondary">
            Toda entrega é um POST em JSON assinado no padrão Standard Webhooks com HMAC SHA256. Responda com qualquer 2xx em até 8 segundos;
            redirecionamentos não são seguidos. O <code>webhook-id</code> é o mesmo em um reenvio, então use para descartar repetição.
          </Text>
          <CodeBlock title="O que chega" code={payloadExample} />
          <CodeBlock title="Conferir em Node.js" code={verifyExample} />
        </div>
      </SettingsSection>

      {editing && (
        <WebhookDialog
          webhook={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(webhook, secret) => {
            if (secret) {
              setWebhooks((current) => [...current, webhook]);
              setReveal({ title: "Webhook criado", description: webhookName(webhook), secret });
            } else {
              replace(webhook);
              toast({ title: "Webhook salvo", description: webhookName(webhook), tone: "success" });
            }
            setEditing(null);
          }}
        />
      )}

      {opened && (
        <WebhookDetails
          key={opened.id}
          webhook={opened}
          canManage={canManage}
          testing={testing === opened.id}
          lastTest={lastTest}
          onClose={() => setOpenId(null)}
          onTest={() => void test(opened)}
          onEdit={() => setEditing(opened)}
          onRotate={() => setRotating(opened)}
          onRemove={() => setRemoving(opened)}
          onDelivered={(delivery) => setWebhooks((current) => current.map((item) => (item.id === delivery.endpointId ? { ...item, lastDelivery: delivery } : item)))}
        />
      )}

      <SecretDialog reveal={reveal} onClose={() => setReveal(null)} />

      <ConfirmDialog
        open={rotating !== null}
        pending={pending}
        title="Girar o segredo?"
        description="As próximas entregas saem assinadas com um segredo novo, e o antigo para de bater na hora. Troque o segredo no sistema que recebe logo em seguida."
        confirmLabel="Girar segredo"
        pendingLabel="Girando"
        onClose={() => setRotating(null)}
        onConfirm={() => void rotate()}
      />

      <ConfirmDialog
        open={removing !== null}
        pending={pending}
        tone="danger"
        title="Apagar este webhook?"
        description={removing ? `${webhookName(removing)} para de receber eventos na hora, e o histórico de entregas sai junto.` : ""}
        confirmLabel="Apagar webhook"
        pendingLabel="Apagando"
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove()}
      />
    </SettingsPage>
  );
}

/** Cadastrar e editar: descrição, endereço, situação e os eventos, com atalhos para todos e para limpar. */
function WebhookDialog({ webhook, onClose, onSaved }: { webhook: WebhookView | null; onClose: () => void; onSaved: (webhook: WebhookView, secret?: string) => void }) {
  const [description, setDescription] = useState(webhook?.description ?? "");
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [active, setActive] = useState(webhook?.active ?? true);
  const [events, setEvents] = useState<string[]>(webhook?.events ?? allEvents);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const values = { description, url, active, events };
    if (webhook) {
      const result = await callAction(updateWebhookAction({ ...values, id: webhook.id }));
      setSaving(false);
      if (!result.ok) return setError({ message: result.error, field: result.field });
      onSaved(result.webhook);
    } else {
      const result = await callAction(createWebhookAction(values));
      setSaving(false);
      if (!result.ok) return setError({ message: result.error, field: result.field });
      onSaved(result.webhook, result.secret);
    }
  };

  const fieldError = (field: string) => (error && (error.field === field || (field === "url" && !error.field)) ? error.message : undefined);

  return (
    <Dialog open onClose={onClose} label={webhook ? "Editar webhook" : "Novo webhook"} size="lg" surface="solid" focusOnOpen={false}>
      <DialogHeader title={webhook ? "Editar webhook" : "Novo webhook"} description="Para onde vão os avisos e quais eventos" onClose={onClose} />
      <form onSubmit={(event) => void save(event)} noValidate className={styles.form}>
        <div className={styles.row}>
          <Field label="Descrição" error={fieldError("description")}>
            <Input value={description} maxLength={80} placeholder="Planilha de vendas" disabled={saving} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <Field label="Endereço" required error={fieldError("url")}>
            <Input
              type="url"
              inputMode="url"
              value={url}
              maxLength={500}
              placeholder="https://seu-sistema.com/webhooks"
              autoComplete="off"
              spellCheck={false}
              disabled={saving}
              invalid={Boolean(fieldError("url"))}
              onChange={(event) => setUrl(event.target.value)}
            />
          </Field>
        </div>
        <Text variant="caption1" tone="secondary" className={styles.hint}>
          Só https e endereço público, sem usuário e senha na URL.
        </Text>
        <Switch checked={active} disabled={saving} onChange={(event) => setActive(event.target.checked)}>
          Webhook ativo
        </Switch>
        {!active && (
          <Text variant="caption1" tone="secondary" className={styles.hint}>
            Pausado, o webhook não recebe nada, e o que acontecer nesse tempo não fica guardado para depois.
          </Text>
        )}
        <Choices
          legend="Eventos"
          options={webhookEvents}
          value={events}
          onChange={setEvents}
          disabled={saving}
          error={error?.field === "events" ? error.message : undefined}
          shortcuts={[
            { label: "Todos", ids: allEvents },
            { label: "Limpar", ids: [] },
          ]}
        />
        <DialogFooter mobile="always">
          <Button type="button" variant="ghost" size="sm" radius="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" radius="md" loading={saving}>
            {webhook ? "Salvar alterações" : "Criar webhook"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/**
 * O detalhe de um webhook: o cadastro, os eventos, a segurança e as entregas. A entrega abre embaixo da tabela com
 * o corpo enviado e o que o destino respondeu, e o reenvio sai dali.
 */
function WebhookDetails({
  webhook,
  canManage,
  testing,
  lastTest,
  onClose,
  onTest,
  onEdit,
  onRotate,
  onRemove,
  onDelivered,
}: {
  webhook: WebhookView;
  canManage: boolean;
  testing: boolean;
  lastTest: WebhookDeliveryView | null;
  onClose: () => void;
  onTest: () => void;
  onEdit: () => void;
  onRotate: () => void;
  onRemove: () => void;
  onDelivered: (delivery: WebhookDeliveryView) => void;
}) {
  const { toast } = useToast();
  const copy = useCopy();
  const [fetched, setFetched] = useState<WebhookDeliveryView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const read = (result: Awaited<ReturnType<typeof loadDeliveriesAction>> | { ok: false; error: string }) => {
    if (result.ok) setFetched(result.deliveries);
    else toast({ title: "Não deu para ler as entregas", description: result.error, tone: "danger" });
  };

  /* As entregas descem quando a janela abre; ela nasce de novo para cada webhook, pela chave. */
  useEffect(() => {
    let alive = true;
    void callAction(loadDeliveriesAction({ id: webhook.id })).then((result) => {
      if (!alive) return;
      if (result.ok) setFetched(result.deliveries);
      else {
        setFetched([]);
        toast({ title: "Não deu para ler as entregas", description: result.error, tone: "danger" });
      }
    });
    return () => {
      alive = false;
    };
  }, [webhook.id, toast]);

  const refresh = async () => {
    setLoading(true);
    read(await callAction(loadDeliveriesAction({ id: webhook.id })));
    setLoading(false);
  };

  /* Um teste enviado com a janela aberta entra no topo sem pedir a lista de novo. */
  const deliveries =
    fetched && lastTest && lastTest.endpointId === webhook.id && !fetched.some((item) => item.id === lastTest.id) ? [lastTest, ...fetched] : fetched;
  const selected = deliveries?.find((delivery) => delivery.id === selectedId) ?? null;

  const resend = async (delivery: WebhookDeliveryView) => {
    setResending(delivery.id);
    const result = await callAction(redeliverWebhookAction({ id: delivery.id }));
    setResending(null);
    if (!result.ok) {
      toast({ title: "Não deu para reenviar", description: result.error, tone: "danger" });
      return;
    }
    setFetched((current) => [result.delivery, ...(current ?? [])]);
    setSelectedId(result.delivery.id);
    onDelivered(result.delivery);
    if (result.delivery.status === "delivered") toast({ title: "Reenviada", description: `HTTP ${result.delivery.responseStatus} em ${result.delivery.durationMs} ms.`, tone: "success" });
    else toast({ title: "Reenvio não entregue", description: result.delivery.error ?? "O destino não confirmou o recebimento.", tone: "warning" });
  };

  const columns: DataTableColumn<WebhookDeliveryView>[] = [
    { id: "at", header: "Quando", cell: (delivery) => <span className={styles.muted}>{dateTime(delivery.createdAt)}</span> },
    { id: "event", header: "Evento", cell: (delivery) => <DataTableTitle title={eventLabel(delivery.event)} caption={delivery.redeliveryOf ? "Reenvio" : undefined} onClick={() => setSelectedId(delivery.id)} /> },
    { id: "result", header: "Resposta", cell: (delivery) => <DeliveryResult delivery={delivery} /> },
    { id: "latency", header: "Latência", align: "end", hideBelow: "md", cell: (delivery) => <span className={styles.muted}>{delivery.durationMs != null ? `${delivery.durationMs} ms` : "Sem medida"}</span> },
  ];

  return (
    <Dialog open onClose={onClose} label={`Webhook ${webhookName(webhook)}`} size="lg" surface="solid" focusOnOpen={false}>
      <>
          <DialogHeader
            title={webhookName(webhook)}
            description={webhook.url}
            before={
              <span className={styles.dialogMark} aria-hidden="true">
                <WebhooksLogoIcon />
              </span>
            }
            onClose={onClose}
          />
          <div className={styles.dialogBody}>
            <section className={styles.dialogSection} aria-label="Cadastro">
              <dl className={styles.facts}>
                <div>
                  <dt>Situação</dt>
                  <dd>
                    <DataTableStatus tone={webhook.active ? "success" : "neutral"}>{webhook.active ? "Ativo" : "Pausado"}</DataTableStatus>
                  </dd>
                </div>
                <div>
                  <dt>Endereço</dt>
                  <dd>
                    <code>{webhook.url}</code>
                  </dd>
                </div>
                <div>
                  <dt>Eventos</dt>
                  <dd className={styles.pills}>
                    {webhook.events.map((event) => (
                      <Badge key={event} tone="neutral" size="sm">
                        {eventLabel(event)}
                      </Badge>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>Assinatura</dt>
                  <dd>
                    HMAC SHA256, segredo versão {webhook.secretVersion}
                    {webhook.secretRotatedAt ? `, girado ${ago(webhook.secretRotatedAt)}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Identificador</dt>
                  <dd>
                    <code>{webhook.id}</code>
                  </dd>
                </div>
                <div>
                  <dt>Criado</dt>
                  <dd>{dateTime(webhook.createdAt)}</dd>
                </div>
              </dl>
            </section>

            <section className={styles.dialogSection} aria-labelledby="webhook-deliveries">
              <div className={styles.sectionHead}>
                <Text as="h3" id="webhook-deliveries" variant="subheadline" weight="semibold">
                  Entregas
                </Text>
                <Button variant="ghost" size="sm" radius="md" iconStart={<ArrowClockwiseIcon />} loading={loading} onClick={() => void refresh()}>
                  Atualizar
                </Button>
              </div>
              <DataTable
                label="Entregas do webhook"
                rows={deliveries ?? []}
                loading={deliveries === null}
                loadingRows={3}
                rowKey={(delivery) => delivery.id}
                columns={columns}
                onRowClick={(delivery) => setSelectedId(delivery.id)}
                empty={
                  <Text variant="footnote" tone="secondary">
                    Nenhuma entrega ainda. Envie um teste para ver como chega.
                  </Text>
                }
              />
              {selected && (
                <div className={styles.dialogSection} aria-live="polite">
                  <div className={styles.sectionHead}>
                    <Text as="h3" variant="subheadline" weight="semibold">
                      {eventLabel(selected.event)}, {dateTime(selected.createdAt)}
                    </Text>
                    <span className={styles.heroActions}>
                      <Button variant="ghost" size="sm" radius="md" onClick={() => setSelectedId(null)}>
                        Fechar entrega
                      </Button>
                      {canManage && (
                        <Button
                          variant="outline"
                          size="sm"
                          radius="md"
                          iconStart={<ArrowCounterClockwiseIcon />}
                          loading={resending === selected.id}
                          disabled={!webhook.active}
                          onClick={() => void resend(selected)}
                        >
                          Reenviar
                        </Button>
                      )}
                    </span>
                  </div>
                  {selected.error && <Text variant="footnote" className={styles.problem}>{selected.error}</Text>}
                  <dl className={styles.facts}>
                    <div>
                      <dt>Resposta</dt>
                      <dd>
                        <DeliveryResult delivery={selected} />
                      </dd>
                    </div>
                    <div>
                      <dt>Latência</dt>
                      <dd>{selected.durationMs != null ? `${selected.durationMs} ms` : "Sem medida"}</dd>
                    </div>
                    <div>
                      <dt>Id do evento</dt>
                      <dd>
                        <code>{selected.eventId}</code>
                      </dd>
                    </div>
                  </dl>
                  <div className={styles.codeHead}>
                    <Text as="span" variant="footnote" weight="semibold">
                      Corpo enviado
                    </Text>
                    <Button variant="ghost" size="sm" radius="md" onClick={() => void copy(JSON.stringify(selected.payload, null, 2))}>
                      Copiar
                    </Button>
                  </div>
                  <pre className={styles.code}>
                    {JSON.stringify(selected.payload, null, 2)}
                  </pre>
                  {selected.responseExcerpt && (
                    <>
                      <Text as="span" variant="footnote" weight="semibold">
                        Resposta do destino
                      </Text>
                      <pre className={styles.code}>
                        {selected.responseExcerpt}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </section>
          </div>
          <DialogFooter mobile="always">
            {canManage && (
              <Button variant="ghost" size="sm" radius="md" iconStart={<TrashIcon />} onClick={onRemove} className={styles.removeButton}>
                Apagar
              </Button>
            )}
            {canManage && (
              <Button variant="outline" size="sm" radius="md" iconStart={<KeyIcon />} onClick={onRotate}>
                Girar segredo
              </Button>
            )}
            {canManage && (
              <Button variant="outline" size="sm" radius="md" iconStart={<PencilSimpleIcon />} onClick={onEdit}>
                Editar
              </Button>
            )}
            {canManage && (
              <Button size="sm" radius="md" iconStart={<PaperPlaneRightIcon />} loading={testing} disabled={!webhook.active} onClick={onTest}>
                Enviar teste
              </Button>
            )}
          </DialogFooter>
        </>
    </Dialog>
  );
}
