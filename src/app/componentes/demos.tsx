"use client";

import {
  BellIcon,
  CopyIcon,
  DotsThreeIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { CheckoutPanel } from "@/features/billing/components/checkout-panel";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Listbox, type ListboxPlacement } from "@/components/ui/listbox";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Inline, Stack } from "@/components/ui/stack";
import { RichTextView } from "@/components/ui/rich-text";
import { LazyRichTextEditor } from "@/components/ui/rich-text/lazy";
import { Text } from "@/components/ui/text";
import type { DocNode } from "@/lib/rich-doc";
import { Toast } from "@/components/ui/toast";
import { memberRoleOptions } from "@/features/onboarding/labels";
import styles from "./componentes.module.css";

const orderOptions = [
  { value: "recentes", label: "Mais recentes" },
  { value: "antigos", label: "Mais antigos" },
  { value: "valor", label: "Maior valor" },
  { value: "cliente", label: "Cliente A a Z" },
];

type ListboxDemoProps = {
  placement?: ListboxPlacement;
  prefix?: string;
  disabled?: boolean;
};

export function ListboxDemo({ placement, prefix, disabled }: ListboxDemoProps) {
  const [value, setValue] = useState("recentes");
  return (
    <Listbox
      label="Ordenar por"
      prefix={prefix}
      placement={placement}
      disabled={disabled}
      options={orderOptions}
      value={value}
      onChange={setValue}
    />
  );
}

export function SelectActionsDemo() {
  const { toast } = useToast();
  const [value, setValue] = useState<string>("member");

  return (
    <Select
      label="Papel de Joaquim"
      options={memberRoleOptions}
      value={value}
      size="sm"
      onChange={setValue}
      actions={[
        {
          label: "Remover do time",
          tone: "danger",
          icon: <TrashIcon weight="bold" aria-hidden="true" />,
          onSelect: () => toast({ title: "Ação da lista", description: "Aqui entraria a remoção", tone: "info" }),
        },
      ]}
    />
  );
}

export function DialogDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Abrir modal
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} label="Confirmar envio do orçamento" size="sm" surface="glass">
        <div className={styles.dialogDemo}>
          <Stack gap={1}>
            <Text as="h2" variant="title3">
              Confirmar envio
            </Text>
            <Text variant="subheadline" tone="secondary">
              Orçamento ORC-2026-0147
            </Text>
          </Stack>
          <div className={styles.dialogDemoBody}>
            <Text variant="body">
              O cliente receberá por e-mail o link seguro para visualizar e aprovar a proposta.
            </Text>
          </div>
          <Inline className={styles.dialogDemoFooter} gap={2} justify="end" wrap>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Enviar orçamento
            </Button>
          </Inline>
        </div>
      </Dialog>
    </>
  );
}

export function DropdownMenuDemo() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(true);
  const notify = (title: string) => toast({ title, description: "Ação demonstrada na vitrine", tone: "neutral" });

  return (
    <DropdownMenu
      label="Opções do orçamento"
      triggerLabel="Abrir opções do orçamento"
      icon={<DotsThreeIcon weight="bold" aria-hidden="true" />}
      sections={[
        {
          id: "actions",
          label: "Ações",
          items: [
            { id: "edit", label: "Editar orçamento", icon: PencilSimpleIcon, onSelect: () => notify("Editar orçamento") },
            { id: "copy", label: "Duplicar", icon: CopyIcon, onSelect: () => notify("Orçamento duplicado") },
            {
              id: "notifications",
              kind: "toggle",
              label: "Notificações",
              icon: BellIcon,
              checked: notifications,
              onChange: setNotifications,
            },
          ],
        },
        {
          id: "danger",
          items: [
            { id: "delete", label: "Excluir", icon: TrashIcon, tone: "danger", onSelect: () => notify("Ação de exclusão") },
          ],
        },
      ]}
    />
  );
}

type PaginationDemoProps = {
  total: number;
  withPageSize?: boolean;
};

export function PaginationDemo({ total, withPageSize = true }: PaginationDemoProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={setPage}
      onPageSizeChange={withPageSize ? changePageSize : undefined}
    />
  );
}

export function ToastDemo() {
  const { toast } = useToast();

  return (
    <Inline gap={2} wrap>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          toast({
            title: "Orçamento enviado",
            description: "O cliente recebeu o link por e-mail",
            tone: "success",
            action: { label: "Ver orçamento" },
          })
        }
      >
        Sucesso
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          toast({
            title: "Cobrança vence amanhã",
            description: "Padaria Aurora, R$ 6.250,00",
            tone: "warning",
            action: { label: "Lembrar cliente" },
          })
        }
      >
        Atenção
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          toast({
            title: "Pagamento recusado",
            description: "O cartão do cliente não autorizou a cobrança",
            tone: "danger",
            action: { label: "Tentar de novo" },
          })
        }
      >
        Erro, fica até agir
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          Array.from({ length: 5 }, (_, index) =>
            toast({
              title: `Contrato ${index + 1} assinado`,
              description: "Assinatura registrada com carimbo de tempo",
              tone: index % 2 ? "info" : "neutral",
            }),
          )
        }
      >
        Cinco de uma vez
      </Button>
    </Inline>
  );
}

export function ToastPreview() {
  return (
    <>
      <Toast
        tone="success"
        title="Orçamento aprovado"
        description="Estúdio Bravo aceitou a proposta de R$ 18.400,00"
        action={{ label: "Gerar contrato" }}
        onDismiss={() => undefined}
      />
      <Toast
        tone="danger"
        title="Falha ao enviar"
        description="O e-mail do cliente foi recusado pelo servidor"
        action={{ label: "Corrigir e-mail" }}
        onDismiss={() => undefined}
      />
    </>
  );
}

// A etapa de pagamento com o resumo de verdade e um lugar reservado no lugar do iframe do Stripe,
// que só monta com um segredo válido. Mesma porta de prévia do MfaEnroll.
export function CheckoutPreview() {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return (
      <Button variant="secondary" onClick={() => setVisible(true)}>
        Ver a etapa de pagamento
      </Button>
    );
  }

  return (
    <CheckoutPanel
      preview
      organizationId="00000000-0000-4000-8000-000000000001"
      intent={{
        mode: "setup",
        clientSecret: "seti_preview_secret_preview",
        plan: "pro",
        cycle: "monthly",
        subscriptionId: null,
        setupIntentId: "seti_preview",
        amountCents: 0,
        trialDays: 7,
      }}
      title="Guarde um cartão para começar"
      description="Nada é cobrado agora. Guardamos o cartão para a assinatura seguir sozinha quando o teste terminar."
      backLabel="Escolher outro plano"
      onBack={() => setVisible(false)}
      onDone={() => setVisible(false)}
    />
  );
}

/**
 * O texto rico da casa na vitrine (2026-09-22): o editor puro, sem caixa, com a bolha da seleção, e a
 * leitura do mesmo documento embaixo. É aqui que ele se confere com o olho, porque o lugar dele no produto
 * (a descrição da tarefa) fica atrás do login.
 */
export function RichTextDemo() {
  const [doc, setDoc] = useState<DocNode>(() => ({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Briefing da campanha" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Selecione este trecho para ver a bolha. " },
          { type: "text", marks: [{ type: "bold" }], text: "Negrito" },
          { type: "text", text: ", " },
          { type: "text", marks: [{ type: "italic" }], text: "itálico" },
          { type: "text", text: " e código no texto: " },
          { type: "text", marks: [{ type: "code" }], text: "npm run dev" },
        ],
      },
      {
        type: "taskList",
        content: [
          { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Fechar o escopo com o cliente" }] }] },
          { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Escrever a proposta" }] }] },
        ],
      },
      {
        type: "codeBlock",
        attrs: { language: "typescript" },
        content: [
          {
            type: "text",
            text: 'export const metadata = {\n  openGraph: {\n    images: [\n      {\n        url: "https://exemplo.com/capa.png",\n        width: 1200,\n        height: 630,\n      },\n    ],\n  },\n};',
          },
        ],
      },
    ],
  }));

  return (
    <Stack gap={4}>
      <LazyRichTextEditor value={doc} onChange={setDoc} label="Descrição de exemplo" placeholder="Escreva algo" />
      <Text variant="caption1" tone="tertiary">
        A mesma árvore, desenhada pela leitura estática
      </Text>
      <RichTextView doc={doc} />
    </Stack>
  );
}
