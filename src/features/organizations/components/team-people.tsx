"use client";

import styled from "@emotion/styled";
import { PaperPlaneTiltIcon, TrashIcon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { invitableRoleOptions, memberRoleOptions, roleLabels } from "@/features/onboarding/labels";
import { callAction } from "@/lib/action";
import {
  cancelInviteAction,
  changeInviteRoleAction,
  changeMemberRoleAction,
  inviteMemberAction,
  removeMemberAction,
} from "../actions";
import type { MemberRole } from "../schemas";
import type { TeamPeople } from "../service";

/**
 * Quem está na equipe, quem foi convidado e o convite novo, num componente só (2026-09-21, a pedido de
 * convidar e ver os membros ao editar uma equipe). Antes isso existia apenas na página da equipe, e a gaveta
 * do seletor escondia a parte de gente quando estava editando, então convidar mais alguém obrigava a trocar
 * de equipe e ir até a configuração.
 *
 * Os blocos são os mesmos nos dois lugares; o que muda é a moldura em volta, que chega por `section`: a
 * página entrega o cartão de ajuste, a gaveta entrega a própria seção. A regra de quem pode o quê fica aqui
 * uma vez só, e a permissão de verdade é do banco, que recusa convite de quem não administra a equipe.
 */

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type TeamSectionProps = { title: string; aside?: ReactNode; children: ReactNode };

export type TeamPeoplePanelProps = TeamPeople & {
  organizationId: string;
  /** A moldura de cada bloco: o cartão da página de ajuste ou a seção da gaveta. */
  section: (props: TeamSectionProps) => ReactNode;
  /** A equipe ainda está sendo lida: os campos ficam desligados em vez de vazios e editáveis. */
  busy?: boolean;
};

const List = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-1);
`;

const Row = styled.div`
  display: flex;
  gap: var(--space-3);
  align-items: center;
  min-width: 0;
  min-height: 3.25rem;
  padding: var(--space-2);
  border-radius: var(--radius-md);
`;

const RowCopy = styled.div`
  display: grid;
  flex: 1;
  gap: var(--space-half);
  min-width: 0;
`;

const RowLine = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  align-items: center;
`;

/* A ponta direita tem largura fixa: o seletor de papel encolhe com o texto, e sem isso a coluna ficava
   irregular, um Membro curto ao lado de um Administrador longo. No celular ela volta a ser automática, para
   não roubar do nome. */
const RowEnd = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  gap: var(--space-1);
  align-items: center;
  justify-content: flex-end;
  width: 9rem;

  @media (max-width: 47.9375rem) {
    width: auto;
  }
`;

/* Dois campos lado a lado, empilhados no celular: a mesma proporção da gaveta e da página, para o convite
   ler igual nos dois lugares. */
const Pair = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-3);
  align-items: end;

  @media (max-width: 47.9375rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Send = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const Invite = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
`;

export function TeamPeoplePanel({
  organizationId,
  members,
  invites,
  viewer,
  section: Section,
  busy = false,
}: TeamPeoplePanelProps) {
  const { toast } = useToast();
  const [people, setPeople] = useState(members);
  const [pending, setPending] = useState(invites);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [inviting, setInviting] = useState(false);

  const canManage = viewer.role !== "member";
  /* Trocar o papel de quem está na equipe é só de quem é dono: a policy de update de `organization_members`
     exige owner, enquanto convidar, cancelar convite e remover gente valem também para administrador. Com um
     seletor de papel só para administrador, a opção estava na tela para quem o banco nunca deixa usá-la. */
  const canSetRole = viewer.role === "owner";
  const canInvite = !busy && emailPattern.test(email.trim()) && name.trim().length >= 2;
  const owners = people.filter((person) => person.role === "owner").length;

  const invite = async () => {
    if (!canInvite || inviting) return;
    setInviting(true);
    const result = await callAction(inviteMemberAction({ organizationId, email, name, role: "member" }));
    setInviting(false);
    if (!result.ok) {
      toast({ title: "Não foi possível convidar", description: result.error, tone: "danger" });
      return;
    }
    setPending((current) => [...current.filter((item) => item.email !== result.data.email), result.data]);
    toast({ title: "Convite enviado", description: `Avisamos ${email} por e-mail.`, tone: "success" });
    setEmail("");
    setName("");
  };

  const updateRole = async (userId: string, next: MemberRole) => {
    const previous = people;
    setPeople((current) => current.map((person) => (person.userId === userId ? { ...person, role: next } : person)));
    const result = await callAction(changeMemberRoleAction({ organizationId, userId, role: next }));
    if (!result.ok) {
      setPeople(previous);
      toast({ title: "Não foi possível trocar o papel", description: result.error, tone: "danger" });
    }
  };

  const dropMember = async (userId: string, label: string) => {
    const previous = people;
    setPeople((current) => current.filter((person) => person.userId !== userId));
    const result = await callAction(removeMemberAction({ organizationId, userId }));
    if (!result.ok) {
      setPeople(previous);
      toast({ title: "Não foi possível remover", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Pessoa removida", description: `${label} saiu da equipe.`, tone: "success" });
  };

  const updateInviteRole = async (inviteId: string, next: MemberRole) => {
    if (next === "owner") return;
    const previous = pending;
    setPending((current) => current.map((item) => (item.id === inviteId ? { ...item, role: next } : item)));
    const result = await callAction(changeInviteRoleAction({ organizationId, inviteId, role: next }));
    if (!result.ok) {
      setPending(previous);
      toast({ title: "Não foi possível trocar o papel", description: result.error, tone: "danger" });
    }
  };

  const dropInvite = async (inviteId: string, label: string) => {
    const previous = pending;
    setPending((current) => current.filter((item) => item.id !== inviteId));
    const result = await callAction(cancelInviteAction({ organizationId, inviteId }));
    if (!result.ok) {
      setPending(previous);
      toast({ title: "Não foi possível cancelar", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Convite cancelado", description: `${label} saiu da lista de pendentes.`, tone: "success" });
  };

  return (
    <>
      {canManage && (
        <Section title="Convidar">
          <Invite>
            <Pair>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={email}
                  placeholder="pessoa@dominio.com"
                  autoComplete="off"
                  inputMode="email"
                  disabled={busy}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label="Nome">
                <Input
                  type="text"
                  value={name}
                  placeholder="Nome da pessoa"
                  autoComplete="off"
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
            </Pair>
            <Send>
              <Button
                size="sm"
                radius="md"
                loading={inviting}
                disabled={!canInvite}
                iconStart={<PaperPlaneTiltIcon />}
                onClick={() => void invite()}
              >
                {inviting ? "Enviando" : "Convidar"}
              </Button>
            </Send>
          </Invite>
        </Section>
      )}

      <Section
        title="Pessoas"
        aside={
          <Badge tone="neutral" variant="soft" size="sm">
            {people.length} {people.length === 1 ? "pessoa" : "pessoas"}
          </Badge>
        }
      >
        <List>
          {people.map((person) => {
            const label = person.name ?? person.email ?? "Sem nome";
            const lastOwner = person.role === "owner" && owners === 1;
            const removable = canManage && person.userId !== viewer.userId && !lastOwner;
            const roleTag = (
              <Badge tone="neutral" size="sm">
                {roleLabels[person.role]}
              </Badge>
            );
            return (
              <Row key={person.userId}>
                <Avatar name={label} src={person.avatarUrl ?? undefined} seed={person.email ?? person.userId} size="md" />
                <RowCopy>
                  <RowLine>
                    <Text as="span" variant="subheadline" weight="medium" truncate>
                      {label}
                    </Text>
                    {person.userId === viewer.userId && (
                      <Badge tone="neutral" variant="soft" size="sm">
                        Você
                      </Badge>
                    )}
                  </RowLine>
                  <Text as="span" variant="footnote" tone="secondary" truncate>
                    {person.email}
                  </Text>
                </RowCopy>
                <RowEnd>
                  {canSetRole ? (
                    <Select
                      label={`Papel de ${label}`}
                      options={memberRoleOptions}
                      value={person.role}
                      size="sm"
                      disabled={lastOwner || busy}
                      onChange={(next) => void updateRole(person.userId, next)}
                      actions={
                        removable
                          ? [
                              {
                                label: "Remover da equipe",
                                tone: "danger",
                                icon: <TrashIcon weight="bold" aria-hidden="true" />,
                                onSelect: () => void dropMember(person.userId, label),
                              },
                            ]
                          : undefined
                      }
                    />
                  ) : removable && !busy ? (
                    /* Administrador vê o papel como etiqueta, e a etiqueta abre o que ele pode de fato: tirar
                       a pessoa da equipe. Enquanto a equipe salva, a mesma etiqueta fica só etiqueta. */
                    <DropdownMenu
                      label={`Opções de ${label}`}
                      triggerLabel={`Papel: ${roleLabels[person.role]}. Mais opções de ${label}`}
                      triggerContent={roleTag}
                      sections={[
                        {
                          id: "pessoa",
                          items: [
                            {
                              id: "remover",
                              label: "Remover da equipe",
                              icon: TrashIcon,
                              tone: "danger",
                              onSelect: () => void dropMember(person.userId, label),
                            },
                          ],
                        },
                      ]}
                    />
                  ) : (
                    roleTag
                  )}
                </RowEnd>
              </Row>
            );
          })}
        </List>
      </Section>

      {pending.length > 0 && (
        <Section title="Convites pendentes">
          <List>
            {pending.map((item) => {
              const label = item.name ?? item.email;
              return (
                <Row key={item.id}>
                  <Avatar name={label} seed={item.email} size="md" />
                  <RowCopy>
                    <RowLine>
                      <Text as="span" variant="subheadline" weight="medium" truncate>
                        {label}
                      </Text>
                      <Badge tone="warning" size="sm">
                        Pendente
                      </Badge>
                    </RowLine>
                    <Text as="span" variant="footnote" tone="secondary" truncate>
                      {item.email}
                    </Text>
                  </RowCopy>
                  <RowEnd>
                    {canManage ? (
                      <Select
                        label={`Papel de ${label}`}
                        options={invitableRoleOptions}
                        value={item.role}
                        size="sm"
                        disabled={busy}
                        onChange={(next) => void updateInviteRole(item.id, next)}
                        actions={[
                          {
                            label: "Cancelar convite",
                            tone: "danger",
                            icon: <TrashIcon weight="bold" aria-hidden="true" />,
                            onSelect: () => void dropInvite(item.id, label),
                          },
                        ]}
                      />
                    ) : (
                      <Badge tone="neutral" size="sm">
                        {roleLabels[item.role]}
                      </Badge>
                    )}
                  </RowEnd>
                </Row>
              );
            })}
          </List>
        </Section>
      )}
    </>
  );
}
