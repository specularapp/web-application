"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Listbox, type ListboxPlacement } from "@/components/ui/listbox";
import { Pagination } from "@/components/ui/pagination";
import { Inline } from "@/components/ui/stack";
import { Toast } from "@/components/ui/toast";

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
