"use client";

import { CopySimpleIcon, CreditCardIcon, EnvelopeSimpleIcon, FlowArrowIcon, PlugsConnectedIcon, SparkleIcon, type Icon } from "@phosphor-icons/react";
import type { Route } from "next";
import type { CSSProperties } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { IntegrationsSettings as IntegrationsData } from "../queries";
import type { AiUsage } from "@/features/ai/summary";
import { SettingsPage, SettingsSection } from "./settings-page";
import styles from "./settings.module.css";

type Card = {
  id: string;
  icon: Icon;
  hue: string;
  title: string;
  description: string;
  status: { label: string; tone: BadgeTone };
  action?: { label: string; href: Route };
};

/**
 * O que está ligado na casa (2026-09-17). A página diz a verdade sobre cada ligação e nada além: o que está
 * configurado no servidor, o que está conectado para esta equipe, e os dois pontos de entrada para quem
 * automatiza por fora (o webhook do n8n e a API que o aplicativo usa). Sem "em breve": ligação que não
 * existe não aparece.
 */
export function IntegrationsSettings({ integrations, ai }: { integrations: IntegrationsData; ai: AiUsage }) {
  const { toast } = useToast();
  /* `ai` é o uso no ciclo, para o topo; o que está ligado chama `assistant` para as duas coisas não se
     confundirem na mesma função. */
  const { stripe, email, ai: assistant, webhook, api } = integrations;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: text, tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: text, tone: "warning" });
    }
  };

  const cards: Card[] = [
    {
      id: "stripe",
      icon: CreditCardIcon,
      hue: "var(--sys-indigo)",
      title: "Stripe",
      description: "Cobra a assinatura do plano e guarda o cartão da equipe.",
      status: !stripe.configured ? { label: "Não configurado", tone: "neutral" } : stripe.connected ? { label: "Conectado", tone: "success" } : { label: "Pronto para usar", tone: "info" },
      action: { label: "Plano e assinatura", href: "/configuracoes/plano" },
    },
    {
      id: "email",
      icon: EnvelopeSimpleIcon,
      hue: "var(--sys-teal)",
      title: "E-mail",
      description: "Manda orçamentos, contratos, cobranças e convites pela Resend.",
      status: email.configured ? { label: "Ligado", tone: "success" } : { label: "Não configurado", tone: "neutral" },
    },
    {
      id: "ai",
      icon: SparkleIcon,
      hue: "var(--sys-purple)",
      title: "Inteligência artificial",
      description: "O assistente da concha e a reescrita de texto nos documentos.",
      status: assistant.configured ? { label: "Ligado", tone: "success" } : { label: "Não configurado", tone: "neutral" },
      action: { label: "Abrir assistente", href: "/ia" },
    },
    {
      id: "automations",
      icon: FlowArrowIcon,
      hue: "var(--sys-orange)",
      title: "Automações",
      description: "Fluxos da casa que mandam e-mail e chamam webhooks quando algo acontece.",
      status: { label: "Ligado", tone: "success" },
      action: { label: "Ver automações", href: "/automacoes" },
    },
  ];

  return (
    <SettingsPage ai={ai}>
      <SettingsSection title="Serviços">
        <div className={styles.cards}>
          {cards.map((card) => (
            <article key={card.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.glyph} style={{ "--item-hue": card.hue } as CSSProperties} aria-hidden="true">
                  <card.icon weight="duotone" />
                </span>
                <div className={styles.cardCopy}>
                  <Text as="h3" variant="subheadline" weight="semibold">
                    {card.title}
                  </Text>
                  <Badge tone={card.status.tone} size="sm">
                    {card.status.label}
                  </Badge>
                </div>
              </div>
              <Text variant="footnote" tone="secondary">
                {card.description}
              </Text>
              {card.action && (
                <div>
                  <Button variant="outline" size="sm" radius="md" href={card.action.href}>
                    {card.action.label}
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Webhook de entrada">
        <div className={styles.code}>
          <code>POST {webhook.url}</code>
          <Button variant="ghost" size="sm" radius="md" iconStart={<CopySimpleIcon />} onClick={() => void copy(webhook.url)}>
            Copiar
          </Button>
        </div>
        <Text variant="footnote" tone="secondary">
          Cabeçalho <code>{webhook.header}</code> com o segredo combinado no servidor (<code>N8N_WEBHOOK_SECRET</code>). Corpo em JSON. Pedido sem o segredo certo é recusado.
        </Text>
      </SettingsSection>

      <SettingsSection title="API">
        <div className={styles.code}>
          <code>{api.baseUrl}/&lt;dominio&gt;</code>
          <Button variant="ghost" size="sm" radius="md" iconStart={<CopySimpleIcon />} onClick={() => void copy(api.baseUrl)}>
            Copiar
          </Button>
        </div>
        <Text variant="footnote" tone="secondary">
          <PlugsConnectedIcon style={{ verticalAlign: "-0.125em" }} aria-hidden="true" /> Autenticação por <code>Authorization: Bearer &lt;token da sessão&gt;</code>. Domínios: clientes, catalogo, projetos, tarefas, crm, orcamentos, contratos, cobrancas, financeiro, automacoes, ia, organizacoes, planos, painel.
        </Text>
      </SettingsSection>
    </SettingsPage>
  );
}
