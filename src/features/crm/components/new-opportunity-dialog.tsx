"use client";

import { XIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useFloatingActionsRegistration } from "@/components/layout/floating-actions";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { onlyDigits } from "@/lib/masks";
import { saveOpportunityAction } from "../actions";
import { sourceLabels, temperatureLabels } from "../labels";
import { opportunityLimits, temperatureValues } from "../schemas";
import { crmStageMeta, type CrmStage } from "../stages";
import { opportunitySourceValues, type OpportunitySource, type OpportunityTemperature } from "../summary";
import styles from "./new-opportunity-dialog.module.css";

export type NewOpportunityDialogProps = {
  open: boolean;
  onClose: () => void;
  /** As etapas deste quadro: são as únicas em que a venda pode nascer. */
  stages: CrmStage[];
  /** A etapa em que ela nasce: a coluna cujo "+" foi tocado, ou a primeira do quadro. */
  stage: CrmStage;
  /** O funil do quadro; nulo no quadro de todas, que manda para o balde. */
  funnelId?: string | null;
  /** A oportunidade nasceu: o quadro se refaz. */
  onCreated: (id: string) => void;
};

/** A chance com que uma venda nova entra: metade, até alguém dizer o contrário na ficha. */
const DEFAULT_PROBABILITY = 50;

const sourceOptions = opportunitySourceValues.map((value) => ({ value, label: sourceLabels[value] }));
const temperatureOptions = temperatureValues.map((value) => ({ value, label: temperatureLabels[value] }));

/**
 * Nova oportunidade: o formulário curto do que **precisa** existir para uma venda ter lugar no funil, e nada
 * além. Título, de quem é (o nome, porque lead novo ainda não é cadastro), a etapa, o valor, por onde chegou
 * e a temperatura. Contato, cidade, previsão, responsável e etiquetas ficam para a ficha, que é onde a venda é
 * trabalhada; pedir tudo isso na criação faria a pessoa desistir no meio de anotar um lead que acabou de
 * chegar pelo WhatsApp.
 *
 * O "+" de cada coluna abre daqui já com a etapa dela escolhida, e a barra abre com a primeira do quadro.
 */
export function NewOpportunityDialog({ open, onClose, stages, stage, funnelId = null, onCreated }: NewOpportunityDialogProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);

  return (
    <Dialog open={open} onClose={onClose} label="Nova oportunidade" size="sm" surface="glass" scrim={mobile} focusOnOpen={!mobile}>
      <OpportunityForm stages={stages} stage={stage} funnelId={funnelId} onClose={onClose} onCreated={onCreated} />
    </Dialog>
  );
}

function OpportunityForm({ stages, stage, funnelId, onClose, onCreated }: Omit<NewOpportunityDialogProps, "open">) {
  const router = useRouter();
  const { toast } = useToast();
  const titleId = useId();

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [chosenStage, setChosenStage] = useState<CrmStage>(stage);
  const [value, setValue] = useState("");
  const [source, setSource] = useState<OpportunitySource>("whatsapp");
  const [temperature, setTemperature] = useState<OpportunityTemperature>("warm");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);

  const filled = title.trim().length >= 2 && clientName.trim().length >= 2;

  const create = async () => {
    if (saving || !filled) return;
    setSaving(true);
    setError(null);

    const result = await saveOpportunityAction({
      funnelId,
      title: title.trim(),
      description: "",
      clientId: null,
      clientName: clientName.trim(),
      clientCompany: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      stage: chosenStage,
      value: Number(value || 0),
      temperature,
      probability: DEFAULT_PROBABILITY,
      city: "",
      state: "",
      expectedAt: "",
      ownerId: null,
      tags: [],
      source,
      partnerCode: "",
      nextStepLabel: "",
      nextStepAt: "",
    });

    setSaving(false);

    if (!result.ok) {
      setError({ field: result.field, message: result.error });
      toast({ title: "Não deu para criar", description: result.error, tone: "danger" });
      return;
    }

    toast({ title: "Oportunidade criada", description: `Ela entrou em ${crmStageMeta[chosenStage].label}.`, tone: "success" });
    onCreated(result.id);
    router.refresh();
  };

  useFloatingActionsRegistration({
    primary: { label: saving ? "Criando" : "Criar oportunidade", loading: saving, disabled: !filled, onClick: () => void create() },
    cancel: { label: "Cancelar", onClick: onClose },
  });

  const errorOf = (field: string) => (error?.field === field ? error.message : undefined);

  return (
    <div className={styles.dialog} aria-labelledby={titleId}>
      <header className={styles.head}>
        <Text as="h2" id={titleId} variant="headline" weight="semibold">
          Nova oportunidade
        </Text>
        <IconButton label="Fechar" variant="ghost" size="sm" disabled={saving} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>

      <div className={styles.body}>
        <Field label="O que está em jogo" error={errorOf("title")} required>
          <Input
            type="text"
            value={title}
            maxLength={opportunityLimits.title}
            placeholder="Site institucional para a Aurora"
            disabled={saving}
            invalid={Boolean(errorOf("title"))}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <Field label="De quem é" hint="O nome de quem pediu; o cadastro vem depois, pela ficha" error={errorOf("clientName")} required>
          <Input
            type="text"
            value={clientName}
            maxLength={opportunityLimits.clientName}
            placeholder="Camila Ferreira"
            disabled={saving}
            invalid={Boolean(errorOf("clientName"))}
            onChange={(event) => setClientName(event.target.value)}
          />
        </Field>

        <div className={styles.pair}>
          <Field label="Etapa">
            <Select
              label="Etapa"
              value={chosenStage}
              disabled={saving}
              options={stages.map((id) => ({ value: id, label: crmStageMeta[id].label }))}
              onChange={setChosenStage}
            />
          </Field>

          <Field label="Valor" hint="Em branco é a combinar" error={errorOf("value")}>
            <Input type="text" mask="currency" inputMode="numeric" value={value} placeholder="0,00" disabled={saving} onChange={(event) => setValue(onlyDigits(event.target.value))} />
          </Field>
        </div>

        <div className={styles.pair}>
          <Field label="Por onde chegou">
            <Select label="Origem" value={source} disabled={saving} options={sourceOptions} onChange={setSource} />
          </Field>

          <Field label="Temperatura">
            <Select label="Temperatura" value={temperature} disabled={saving} options={temperatureOptions} onChange={setTemperature} />
          </Field>
        </div>
      </div>

      {/* No celular criar e cancelar moram na barra flutuante, acima da bandeja, e o rodapé some. */}
      <footer className={styles.foot}>
        <Button variant="ghost" size="sm" radius="md" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" radius="md" loading={saving} disabled={!filled} onClick={() => void create()}>
          Criar oportunidade
        </Button>
      </footer>
    </div>
  );
}
