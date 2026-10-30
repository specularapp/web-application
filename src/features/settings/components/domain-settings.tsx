"use client";

import {
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  CheckIcon,
  ClockIcon,
  CopySimpleIcon,
  GlobeHemisphereWestIcon,
  GlobeIcon,
  ListMagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { formatDistanceStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useMemo, useState, type FormEvent } from "react";
import { PageToolbar } from "@/components/layout/page-toolbar";
import { useToast } from "@/components/providers/toast-provider";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, DataTableDate, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import type { AiUsage } from "@/features/ai/summary";
import { usePlanGate } from "@/features/billing/components/plan-gate";
import { planBadges } from "@/features/billing/plans";
import { callAction } from "@/lib/action";
import { addDomainAction, removeDomainAction, verifyDomainAction } from "../actions";
import { MAX_DOMAINS, domainStatusOf, type DomainStatus, type DomainsOverview, type PortfolioDomain } from "../domains";
import { SettingsPage } from "./settings-page";
import styles from "./domain-settings.module.css";

const statuses: Record<DomainStatus, { label: string; tone: BadgeTone; icon: typeof CheckIcon }> = {
  active: { label: "Ativo", tone: "success", icon: CheckIcon },
  pending: { label: "Aguardando DNS", tone: "warning", icon: ClockIcon },
  failing: { label: "Não confere", tone: "danger", icon: WarningCircleIcon },
};

const ago = (iso: string) => formatDistanceStrict(parseISO(iso), new Date(), { locale: ptBR, addSuffix: true });

const normalize = (text: string) => text.toLocaleLowerCase("pt-BR");

/**
 * Os domínios do portfólio (2026-10-29, a pedido: "uma interface semelhante à da Cloudflare, para o cliente colocar
 * a URL do domínio dele e acessar o portfólio direto por ela"). No alto o nome da página com o que ela faz e as
 * duas ações; embaixo do texto, o endereço da casa, que sempre funciona; e a lista dos domínios em tabela, com a
 * situação de cada um, o registro de DNS que ele pede e quando foi conferido. A linha abre a configuração do
 * domínio (o registro para copiar, o que a última conferência achou e o botão de conferir); o leque confere,
 * abre e tira.
 */
export function DomainSettings({ overview, canManage, ai }: { overview: DomainsOverview; canManage: boolean; ai: AiUsage }) {
  const { toast } = useToast();
  const gate = usePlanGate();
  const [domains, setDomains] = useState(overview.domains);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PortfolioDomain | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const opened = domains.find((domain) => domain.id === openId) ?? null;
  const full = domains.length >= MAX_DOMAINS;

  const visible = useMemo(() => {
    const search = normalize(query.trim());
    return search ? domains.filter((domain) => domain.domain.includes(search)) : domains;
  }, [domains, query]);

  const replace = (next: PortfolioDomain) => setDomains((current) => current.map((domain) => (domain.id === next.id ? next : domain)));

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: text, tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: text, tone: "warning" });
    }
  };

  const startAdding = () => {
    if (!gate.allows("pro")) {
      gate.require("pro");
      return;
    }
    setAdding(true);
  };

  const verify = async (domain: PortfolioDomain) => {
    setChecking(domain.id);
    const result = await callAction(verifyDomainAction({ id: domain.id }));
    setChecking(null);
    if (!result.ok) {
      toast({ title: "Não deu para conferir", description: result.error, tone: "danger" });
      return;
    }
    replace(result.domain);
    if (result.domain.verifiedAt) toast({ title: "Domínio ativo", description: `${result.domain.domain} já abre o seu portfólio.`, tone: "success" });
    else toast({ title: "Ainda não confere", description: result.domain.checkError ?? "O DNS ainda não aponta para a casa.", tone: "warning" });
  };

  const remove = async () => {
    if (!removing) return;
    setPending(true);
    const result = await callAction(removeDomainAction({ id: removing.id }));
    setPending(false);
    if (!result.ok) {
      toast({ title: "Não deu para tirar", description: result.error, tone: "danger" });
      return;
    }
    setDomains((current) => current.filter((domain) => domain.id !== removing.id));
    if (openId === removing.id) setOpenId(null);
    toast({ title: "Domínio removido", description: `${removing.domain} não abre mais o portfólio.`, tone: "success" });
    setRemoving(null);
  };

  const columns: DataTableColumn<PortfolioDomain>[] = [
    {
      id: "domain",
      header: "Domínio",
      sortable: true,
      sortValue: (domain) => domain.domain,
      cell: (domain) => (
        <span className={styles.domainCell}>
          <a href={`https://${domain.domain}`} target="_blank" rel="noreferrer" className={styles.domainLink}>
            {domain.domain}
          </a>
          <Text as="span" variant="caption1" tone="tertiary">
            {domain.record.type === "A" ? "Raiz" : "Subdomínio"}
          </Text>
        </span>
      ),
    },
    {
      id: "status",
      header: "Situação",
      sortable: true,
      sortValue: (domain) => domainStatusOf(domain),
      cell: (domain) => {
        const status = statuses[domainStatusOf(domain)];
        return (
          <span className={styles.status} data-status={domainStatusOf(domain)}>
            <status.icon aria-hidden="true" weight="bold" />
            {status.label}
          </span>
        );
      },
    },
    {
      id: "record",
      header: "Registro de DNS",
      cell: (domain) => (
        <span className={styles.record}>
          <Badge tone="neutral" size="sm">
            {domain.record.type}
          </Badge>
          <code>{domain.record.name}</code>
          <span aria-hidden="true">→</span>
          <code>{domain.record.value}</code>
        </span>
      ),
    },
    {
      id: "checked",
      header: "Conferido",
      cell: (domain) => (
        <Text as="span" variant="footnote" tone="secondary">
          {domain.checkedAt ? ago(domain.checkedAt) : "Ainda não"}
        </Text>
      ),
    },
    { id: "created", header: "Adicionado", hideBelow: "lg", sortable: true, sortValue: (domain) => domain.createdAt, cell: (domain) => <DataTableDate iso={domain.createdAt.slice(0, 10)} /> },
  ];

  const menuOf = (domain: PortfolioDomain) => (
    <DropdownMenu
      label={`Ações de ${domain.domain}`}
      triggerLabel={`Abrir ações de ${domain.domain}`}
      size="sm"
      sections={[
        {
          id: "actions",
          items: [
            { id: "config", label: "Ver configuração de DNS", icon: ListMagnifyingGlassIcon, onSelect: () => setOpenId(domain.id) },
            ...(canManage ? [{ id: "verify", label: "Conferir agora", icon: ArrowClockwiseIcon, onSelect: () => void verify(domain) }] : []),
            { id: "open", label: "Abrir no navegador", icon: ArrowSquareOutIcon, onSelect: () => window.open(`https://${domain.domain}`, "_blank", "noopener") },
            { id: "copy", label: "Copiar endereço", icon: CopySimpleIcon, onSelect: () => void copy(`https://${domain.domain}`) },
          ],
        },
        ...(canManage ? [{ id: "danger", items: [{ id: "remove", label: "Tirar domínio", icon: TrashIcon, tone: "danger" as const, onSelect: () => setRemoving(domain) }] }] : []),
      ]}
    />
  );

  return (
    <SettingsPage ai={ai}>
      {/* O alto da página, como no painel de domínios da Cloudflare: o nome com o plano, o endereço que sempre
          funciona e as duas ações na ponta */}
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.heroTitle}>
            <Text as="h2" variant="title2" weight="semibold">
              Domínios
            </Text>
            <Badge tone="neutral" variant="soft" size="sm">
              {planBadges.pro}
            </Badge>
          </div>
          <span className={styles.house}>
            <GlobeHemisphereWestIcon aria-hidden="true" />
            <Text as="span" variant="footnote" tone="secondary">
              Endereço da casa
            </Text>
            <a href={overview.fallbackUrl} target="_blank" rel="noreferrer" className={styles.houseLink}>
              {overview.fallbackUrl.replace(/^https?:\/\//, "")}
            </a>
            <IconButton label="Copiar o endereço da casa" variant="ghost" size="sm" onClick={() => void copy(overview.fallbackUrl)}>
              <CopySimpleIcon />
            </IconButton>
          </span>
        </div>
        <div className={styles.heroActions}>
          <Button variant="outline" size="sm" radius="md" iconStart={<ArrowSquareOutIcon />} href={overview.fallbackUrl} target="_blank" rel="noreferrer">
            Ver portfólio
          </Button>
          {canManage && (
            <Button size="sm" radius="md" iconStart={<PlusIcon />} disabled={full} onClick={startAdding}>
              Adicionar domínio
            </Button>
          )}
        </div>
      </header>

      {domains.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState
            icon={GlobeIcon}
            title="Nenhum domínio ainda"
            description="Cadastre o seu domínio, aponte o DNS para a casa e o portfólio passa a abrir nele, com certificado e tudo."
          >
            {canManage && (
              <Button size="sm" radius="md" iconStart={<PlusIcon />} onClick={startAdding}>
                Adicionar domínio
              </Button>
            )}
          </EmptyState>
        </div>
      ) : (
        <>
          <PageToolbar search={{ value: query, onChange: setQuery, placeholder: "Pesquisar por nome de domínio", label: "Pesquisar os domínios pelo nome" }} />
          <DataTable
            label="Domínios do portfólio"
            rows={visible}
            rowKey={(domain) => domain.id}
            columns={columns}
            onRowClick={(domain) => setOpenId(domain.id)}
            actions={menuOf}
            empty={
              <Text variant="footnote" tone="secondary">
                Nenhum domínio com esse nome.
              </Text>
            }
          />
          {full && (
            <Text variant="footnote" tone="secondary">
              Cada equipe cadastra até {MAX_DOMAINS} domínios.
            </Text>
          )}
        </>
      )}

      {!canManage && (
        <Text variant="footnote" tone="secondary">
          Só o dono e os administradores do time cadastram e tiram domínios.
        </Text>
      )}

      {adding && (
        <AddDomainDialog
          onClose={() => setAdding(false)}
          onAdded={(domain) => {
            setDomains((current) => [...current, domain]);
            setAdding(false);
            setOpenId(domain.id);
          }}
          onPlan={() => (setAdding(false), gate.require("pro"))}
        />
      )}

      <DomainDialog
        domain={opened}
        canManage={canManage}
        checking={opened !== null && checking === opened.id}
        onClose={() => setOpenId(null)}
        onVerify={() => opened && void verify(opened)}
        onRemove={() => opened && setRemoving(opened)}
        onCopy={(text) => void copy(text)}
      />

      <ConfirmDialog
        open={removing !== null}
        pending={pending}
        tone="danger"
        title="Tirar este domínio?"
        description={removing ? `${removing.domain} deixa de abrir o portfólio na hora. O registro de DNS no seu provedor pode ficar ou sair, você escolhe.` : ""}
        confirmLabel="Tirar domínio"
        pendingLabel="Tirando"
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove()}
      />
    </SettingsPage>
  );
}

/** A janela de cadastrar: só o nome do domínio. Ao salvar, abre a configuração dele, que é o próximo passo. */
function AddDomainDialog({ onClose, onAdded, onPlan }: { onClose: () => void; onAdded: (domain: PortfolioDomain) => void; onPlan: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !value.trim()) return;
    setSaving(true);
    setError(null);
    const result = await callAction(addDomainAction({ domain: value }));
    setSaving(false);
    if (!result.ok) {
      if ("plan" in result) return onPlan();
      setError(result.error);
      return;
    }
    onAdded(result.domain);
  };

  return (
    <Dialog open onClose={onClose} label="Adicionar domínio" size="sm" surface="solid">
      <DialogHeader title="Adicionar domínio" description="O endereço onde o portfólio vai abrir" onClose={onClose} />
      <form onSubmit={(event) => void save(event)} noValidate>
        <div className={styles.form}>
          <Field label="Domínio" error={error ?? undefined}>
            <Input
              type="text"
              value={value}
              placeholder="seuestudio.com.br"
              autoComplete="off"
              spellCheck={false}
              inputMode="url"
              disabled={saving}
              invalid={Boolean(error)}
              iconStart={<GlobeIcon />}
              onChange={(event) => setValue(event.target.value.toLowerCase())}
            />
          </Field>
          <Text variant="caption1" tone="secondary">
            Sem https, como seuestudio.com.br ou www.seuestudio.com.br. Para os dois abrirem, cadastre os dois.
          </Text>
        </div>
        <DialogFooter mobile="always">
          <Button type="button" variant="ghost" size="sm" radius="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" radius="md" loading={saving} disabled={!value.trim()}>
            Adicionar
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/**
 * A configuração de um domínio: a situação, o registro de DNS para criar no provedor (tipo, nome e valor, cada um
 * com copiar), o que a última conferência achou e as ações de conferir e tirar.
 */
function DomainDialog({
  domain,
  canManage,
  checking,
  onClose,
  onVerify,
  onRemove,
  onCopy,
}: {
  domain: PortfolioDomain | null;
  canManage: boolean;
  checking: boolean;
  onClose: () => void;
  onVerify: () => void;
  onRemove: () => void;
  onCopy: (text: string) => void;
}) {
  const state = domain ? domainStatusOf(domain) : "pending";
  const status = statuses[state];

  return (
    <Dialog open={domain !== null} onClose={onClose} label={domain ? `Configuração de ${domain.domain}` : "Configuração do domínio"} size="md" surface="solid" focusOnOpen={false}>
      {domain && (
        <>
          <DialogHeader
            title={domain.domain}
            description={domain.record.type === "A" ? "Domínio raiz" : "Subdomínio"}
            before={
              <span className={styles.dialogMark} aria-hidden="true">
                <GlobeIcon />
              </span>
            }
            onClose={onClose}
          />
          <div className={styles.dialogBody}>
            <div className={styles.dialogStatus} data-status={state}>
              <Badge tone={status.tone} size="sm" icon={<status.icon />}>
                {status.label}
              </Badge>
              <Text as="span" variant="footnote" tone="secondary">
                {state === "active"
                  ? `Abre o portfólio desde ${ago(domain.verifiedAt ?? domain.createdAt)}`
                  : domain.checkedAt
                    ? `Conferido ${ago(domain.checkedAt)}`
                    : "Ainda não conferido"}
              </Text>
            </div>

            {state === "failing" && domain.checkError && (
              <Text variant="footnote" className={styles.problem}>
                {domain.checkError}
              </Text>
            )}

            <section className={styles.dns} aria-label="Registro de DNS">
              <Text as="h3" variant="subheadline" weight="semibold">
                Registro de DNS
              </Text>
              <Text variant="footnote" tone="secondary">
                No painel do seu provedor de domínio (Registro.br, Cloudflare, GoDaddy, Hostinger), crie o registro abaixo.
                A propagação leva de minutos a 24 horas; depois é só conferir.
              </Text>
              <dl className={styles.dnsTable}>
                {(
                  [
                    ["Tipo", domain.record.type],
                    ["Nome", domain.record.name],
                    ["Valor", domain.record.value],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      <code>{value}</code>
                      <IconButton label={`Copiar ${label.toLocaleLowerCase("pt-BR")}`} variant="ghost" size="sm" onClick={() => onCopy(value)}>
                        <CopySimpleIcon />
                      </IconButton>
                    </dd>
                  </div>
                ))}
              </dl>
              <Text variant="caption1" tone="tertiary">
                Na Cloudflare, deixe a nuvem cinza (só DNS) até o domínio ficar ativo.
              </Text>
            </section>
          </div>
          <DialogFooter mobile="always">
            {canManage && (
              <Button variant="ghost" size="sm" radius="md" iconStart={<TrashIcon />} onClick={onRemove} className={styles.removeButton}>
                Tirar domínio
              </Button>
            )}
            {state === "active" && (
              <Button variant="outline" size="sm" radius="md" iconStart={<ArrowSquareOutIcon />} href={`https://${domain.domain}`} target="_blank" rel="noreferrer">
                Abrir
              </Button>
            )}
            {canManage && (
              <Button size="sm" radius="md" variant={state === "active" ? "outline" : "primary"} iconStart={<ArrowClockwiseIcon />} loading={checking} onClick={onVerify}>
                Conferir agora
              </Button>
            )}
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}
