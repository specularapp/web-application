"use client";

import { TrashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { CheckoutPanel } from "@/features/billing/components/checkout-panel";
import { Listbox, type ListboxPlacement } from "@/components/ui/listbox";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Inline } from "@/components/ui/stack";
import { Toast } from "@/components/ui/toast";
import { memberRoleOptions } from "@/features/onboarding/labels";

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
