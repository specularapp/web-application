"use client";

import { CheckCircleIcon, DownloadSimpleIcon, SignatureIcon, XIcon } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useId, useState } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { SignaturePad } from "@/components/ui/signature-pad";
import { Text } from "@/components/ui/text";
import { signatureStamp } from "@/features/quotes/signature";
import { callAction } from "@/lib/action";
import { squircle } from "@/lib/corners";
import { signContractAction } from "../actions";
import { ContractDocument, partyRoles } from "../document";
import { contractLimits } from "../schemas";
import type { Contract, ContractParty } from "../summary";
import { PdfPages } from "./pdf-pages-lazy";
import { SignatureFieldMark } from "./signature-field-mark";
import styles from "./contract-public-view.module.css";

export type ContractPublicViewProps = {
  contract: Contract;
  /** A parte dona do link: é ela que assina aqui. */
  party: ContractParty;
};

const longDate = (iso: string) => format(parseISO(iso), "d 'de' MMMM", { locale: ptBR });

// A página que a parte abre pelo link do e-mail (2026-09-14): só o documento, centrado, e o container
// flutuante de vidro no rodapé com o que dá para fazer, na receita da página pública do orçamento. O
// documento é a folha escrita, ou as páginas do PDF anexado com o traço de quem já assinou carimbado no
// campo dela. Assinar abre a janela com o nome e o quadro de desenhar; a assinatura registrada volta para a
// folha na hora, e a situação do contrato anda junto. Quem já assinou, ou quem abriu um contrato encerrado,
// vê o aviso no lugar do botão.
export function ContractPublicView({ contract: initial, party: initialParty }: ContractPublicViewProps) {
  const { toast } = useToast();
  const [contract, setContract] = useState(initial);
  const [party, setParty] = useState(initialParty);
  const [signing, setSigning] = useState(false);
  const [name, setName] = useState(party.name);
  const [trace, setTrace] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const titleId = useId();

  const open = contract.status === "sent" || contract.status === "partial";
  const expired = Boolean(contract.expiresAt && contract.expiresAt < format(new Date(), "yyyy-MM-dd"));
  const canSign = open && !party.signedAt && !expired;
  const downloadUrl = `/contrato/${party.token}/pdf`;

  const notice = contract.status === "cancelled" ? "Este contrato foi cancelado pela equipe." : contract.status === "signed" ? "Assinado por todas as partes." : party.signedAt ? "Você já assinou. Falta a outra parte." : expired ? "O prazo para assinar terminou. Peça um novo convite à equipe." : contract.status === "draft" ? "Este contrato ainda não foi enviado para assinatura." : null;

  const sign = async () => {
    if (!trace) {
      toast({ title: "Falta o traço", description: "Desenhe sua assinatura no quadro antes de confirmar.", tone: "warning" });
      return;
    }
    setPending(true);
    const result = await callAction(signContractAction({ token: party.token, name, signature: trace }));
    setPending(false);
    if (!result.ok) {
      toast({ title: "Não deu para assinar", description: result.error, tone: "danger" });
      return;
    }
    const signedAt = new Date().toISOString();
    const signedParty = { ...party, signedAt, signatureUrl: trace };
    setParty(signedParty);
    setContract((current) => ({
      ...current,
      status: result.status,
      signedAt: result.completed ? signedAt : current.signedAt,
      parties: current.parties.map((entry) => (entry.id === party.id ? signedParty : entry)),
    }));
    setSigning(false);
    toast({
      title: result.completed ? "Contrato assinado por todas as partes" : "Assinatura registrada",
      description: result.completed
        ? result.emailed
          ? "A cópia assinada foi enviada por e-mail para as duas partes."
          : "O registro ficou. O e-mail com a cópia não saiu neste ambiente."
        : "Assim que a outra parte assinar, vocês recebem a cópia por e-mail.",
      tone: "success",
    });
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div className={styles.heading}>
          <Text as="p" variant="caption1" tone="secondary">
            {contract.reference}
          </Text>
          <Text as="h1" variant="title3" weight="semibold">
            {contract.title}
          </Text>
          <Text as="p" variant="footnote" tone="secondary">
            Para {party.name}, como {partyRoles[party.role].toLowerCase()}
            {contract.expiresAt && open ? `, até ${longDate(contract.expiresAt)}` : ""}
          </Text>
        </div>
        {notice && (
          <Badge tone={contract.status === "signed" ? "success" : contract.status === "cancelled" || expired ? "danger" : "neutral"} size="md" icon={contract.status === "signed" ? <CheckCircleIcon /> : undefined}>
            {notice}
          </Badge>
        )}
      </header>

      <div className={styles.paper}>
        {contract.file ? (
          <PdfPages
            src={`/api/contratos/${contract.id}/arquivo`}
            overlay={(page) =>
              contract.fields
                .filter((field) => field.page === page)
                .map((field) => {
                  const owner = contract.parties.find((entry) => entry.id === field.partyId);
                  return owner ? <SignatureFieldMark key={field.id} field={field} party={owner} highlighted={owner.id === party.id && canSign} /> : null;
                })
            }
          />
        ) : (
          <ContractDocument contract={contract} />
        )}
      </div>

      {/* O container flutuante, na receita da página pública do orçamento: baixar o PDF e assinar. */}
      <div className={styles.toolbar} role="toolbar" aria-label="Ações do contrato">
        <Button variant="ghost" size="sm" radius="md" iconStart={<DownloadSimpleIcon />} href={downloadUrl}>
          Baixar PDF
        </Button>
        {canSign && (
          <Button size="sm" radius="md" iconStart={<SignatureIcon />} onClick={() => setSigning(true)}>
            Assinar
          </Button>
        )}
      </div>

      <Dialog open={signing} onClose={() => !pending && setSigning(false)} label="Assinar o contrato" size="md" focusOnOpen={false}>
        <SignSheet
          titleId={titleId}
          party={party}
          name={name}
          pending={pending}
          onName={setName}
          onTrace={setTrace}
          onClose={() => setSigning(false)}
          onConfirm={sign}
          signedAtPreview={contract.parties.find((entry) => entry.signedAt && entry.id !== party.id)?.signedAt ?? null}
        />
      </Dialog>
    </main>
  );
}

type SignSheetProps = {
  titleId: string;
  party: ContractParty;
  name: string;
  pending: boolean;
  onName: (value: string) => void;
  onTrace: (value: string | null) => void;
  onClose: () => void;
  onConfirm: () => void;
  signedAtPreview: string | null;
};

/* O miolo da janela de assinar: o nome como assina, o quadro do traço e o aviso do que a assinatura vale. No
   celular confirmar e sair moram na barra flutuante. */
function SignSheet({ titleId, party, name, pending, onName, onTrace, onClose, onConfirm, signedAtPreview }: SignSheetProps) {
  useFloatingActionsRegistration({
    primary: { label: pending ? "Assinando" : "Confirmar assinatura", icon: <SignatureIcon weight="bold" />, loading: pending, onClick: onConfirm },
    cancel: { label: "Cancelar", onClick: onClose },
  });

  return (
    <div className={styles.sheet} aria-labelledby={titleId}>
      <header className={styles.sheetHead}>
        <div>
          <Text as="h2" id={titleId} variant="headline" weight="semibold">
            Assinar como {partyRoles[party.role].toLowerCase()}
          </Text>
          <Text variant="footnote" tone="secondary">
            A assinatura fica registrada com seu nome, data e hora.
          </Text>
        </div>
        <IconButton label="Fechar" variant="ghost" size="sm" disabled={pending} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      <Field label="Seu nome, como assina" required>
        <Input type="text" value={name} maxLength={contractLimits.signerName} autoComplete="name" disabled={pending} onChange={(event) => onName(event.target.value)} />
      </Field>

      <SignaturePad onChange={onTrace} disabled={pending} />

      <div className={styles.terms} {...squircle("md")}>
        <Text variant="caption1" tone="secondary">
          Ao confirmar, você declara que leu o documento e concorda com ele. O registro guarda a data e a hora ({signatureStamp(new Date().toISOString())}) e o endereço pessoal deste convite.
          {signedAtPreview ? ` A outra parte assinou em ${signatureStamp(signedAtPreview)}.` : ""}
        </Text>
      </div>

      <footer className={styles.sheetFoot}>
        <Button variant="outline" size="sm" radius="md" disabled={pending} onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" radius="md" iconStart={<SignatureIcon />} loading={pending} onClick={onConfirm}>
          {pending ? "Assinando" : "Confirmar assinatura"}
        </Button>
      </footer>
    </div>
  );
}
