"use client";

import { PaperPlaneTiltIcon, TrashIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { invitableRoleOptions, memberRoleOptions, roleLabels } from "@/features/onboarding/labels";
import {
  cancelInviteAction,
  changeInviteRoleAction,
  changeMemberRoleAction,
  inviteMemberAction,
  removeMemberAction,
} from "@/features/organizations/actions";
import type { MemberRole } from "@/features/organizations/schemas";
import type { TeamState } from "@/features/organizations/service";
import { callAction } from "@/lib/action";
import { SettingsPage, SettingsSection } from "./settings-page";
import styles from "./settings.module.css";

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * A página da equipe (2026-09-17): quem está dentro, com o papel de cada um, quem foi convidado e ainda não
 * entrou, e o convite novo. É a etapa de membros dos primeiros passos vivendo como página: a mesma regra
 * (proprietário não é papel travado, o único limite é o time nunca ficar sem nenhum), sem o avançar e sem a
 * prévia. Quem é membro vê a lista e não mexe; quem administra convida, troca papel e remove.
 */
export function TeamSettings({ team, members, invites, viewer }: TeamState) {
  const { toast } = useToast();
  const [people, setPeople] = useState(members);
  const [pending, setPending] = useState(invites);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [inviting, setInviting] = useState(false);

  const canManage = viewer.role !== "member";
  const canInvite = emailPattern.test(email.trim()) && name.trim().length >= 2;
  const owners = people.filter((person) => person.role === "owner").length;

  if (!team) {
    return (
      <SettingsPage title="Equipe">
        <EmptyState icon={UsersThreeIcon} title="Você ainda não está numa equipe" description="Crie a sua pelo seletor de equipe, no topo do menu." />
      </SettingsPage>
    );
  }

  const invite = async () => {
    if (!canInvite || inviting) return;
    setInviting(true);
    const result = await callAction(inviteMemberAction({ organizationId: team.id, email, name, role: "member" }));
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
    const result = await callAction(changeMemberRoleAction({ organizationId: team.id, userId, role: next }));
    if (!result.ok) {
      setPeople(previous);
      toast({ title: "Não foi possível trocar o papel", description: result.error, tone: "danger" });
    }
  };

  const dropMember = async (userId: string, label: string) => {
    const previous = people;
    setPeople((current) => current.filter((person) => person.userId !== userId));
    const result = await callAction(removeMemberAction({ organizationId: team.id, userId }));
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
    const result = await callAction(changeInviteRoleAction({ organizationId: team.id, inviteId, role: next }));
    if (!result.ok) {
      setPending(previous);
      toast({ title: "Não foi possível trocar o papel", description: result.error, tone: "danger" });
    }
  };

  const dropInvite = async (inviteId: string, label: string) => {
    const previous = pending;
    setPending((current) => current.filter((item) => item.id !== inviteId));
    const result = await callAction(cancelInviteAction({ organizationId: team.id, inviteId }));
    if (!result.ok) {
      setPending(previous);
      toast({ title: "Não foi possível cancelar", description: result.error, tone: "danger" });
      return;
    }
    toast({ title: "Convite cancelado", description: `${label} saiu da lista de pendentes.`, tone: "success" });
  };

  return (
    <SettingsPage
      title="Equipe"
      description={`${team.name}: quem está dentro, o papel de cada um e quem ainda vai entrar.`}
      aside={
        <Badge tone="neutral" variant="soft" size="sm">
          {people.length} {people.length === 1 ? "pessoa" : "pessoas"}
        </Badge>
      }
    >
      {canManage && (
        <SettingsSection title="Convidar" description="Quem recebe o convite entra como membro; o papel se troca depois, na lista.">
          <div className={styles.pair}>
            <Field label="E-mail">
              <Input type="email" value={email} placeholder="pessoa@dominio.com" autoComplete="off" inputMode="email" onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label="Nome">
              <Input type="text" value={name} placeholder="Nome da pessoa" autoComplete="off" onChange={(event) => setName(event.target.value)} />
            </Field>
          </div>
          <div className={styles.actions}>
            <Button size="sm" radius="md" loading={inviting} disabled={!canInvite} iconStart={<PaperPlaneTiltIcon />} onClick={() => void invite()}>
              {inviting ? "Enviando" : "Convidar"}
            </Button>
          </div>
        </SettingsSection>
      )}

      <SettingsSection title="Pessoas" description={canManage ? "Troque o papel pelo seletor; remover está no mesmo leque." : "Só quem administra troca papéis e remove pessoas."}>
        <div className={styles.list}>
          {people.map((person) => {
            const label = person.name ?? person.email ?? "Sem nome";
            const lastOwner = person.role === "owner" && owners === 1;
            const removable = canManage && person.userId !== viewer.userId && !lastOwner;
            return (
              <div key={person.userId} className={styles.row}>
                <Avatar name={label} src={person.avatarUrl ?? undefined} seed={person.email ?? person.userId} size="md" />
                <div className={styles.rowCopy}>
                  <div className={styles.rowLine}>
                    <Text as="span" variant="subheadline" weight="medium" truncate>
                      {label}
                    </Text>
                    {person.userId === viewer.userId && (
                      <Badge tone="neutral" variant="soft" size="sm">
                        Você
                      </Badge>
                    )}
                  </div>
                  <Text as="span" variant="footnote" tone="secondary" truncate>
                    {person.email}
                  </Text>
                </div>
                <span className={styles.rowEnd}>
                  {canManage ? (
                    <Select
                      label={`Papel de ${label}`}
                      options={memberRoleOptions}
                      value={person.role}
                      size="sm"
                      disabled={lastOwner}
                      onChange={(next) => void updateRole(person.userId, next)}
                      actions={
                        removable
                          ? [{ label: "Remover da equipe", tone: "danger", icon: <TrashIcon weight="bold" aria-hidden="true" />, onSelect: () => void dropMember(person.userId, label) }]
                          : undefined
                      }
                    />
                  ) : (
                    <Badge tone="neutral" size="sm">
                      {roleLabels[person.role]}
                    </Badge>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      {pending.length > 0 && (
        <SettingsSection title="Convites pendentes" description="Quem foi chamado e ainda não entrou. O convite vale por sete dias.">
          <div className={styles.list}>
            {pending.map((item) => {
              const label = item.name ?? item.email;
              return (
                <div key={item.id} className={styles.row}>
                  <Avatar name={label} seed={item.email} size="md" />
                  <div className={styles.rowCopy}>
                    <div className={styles.rowLine}>
                      <Text as="span" variant="subheadline" weight="medium" truncate>
                        {label}
                      </Text>
                      <Badge tone="warning" size="sm">
                        Pendente
                      </Badge>
                    </div>
                    <Text as="span" variant="footnote" tone="secondary" truncate>
                      {item.email}
                    </Text>
                  </div>
                  <span className={styles.rowEnd}>
                    {canManage ? (
                      <Select
                        label={`Papel de ${label}`}
                        options={invitableRoleOptions}
                        value={item.role}
                        size="sm"
                        onChange={(next) => void updateInviteRole(item.id, next)}
                        actions={[{ label: "Cancelar convite", tone: "danger", icon: <TrashIcon weight="bold" aria-hidden="true" />, onSelect: () => void dropInvite(item.id, label) }]}
                      />
                    ) : (
                      <Badge tone="neutral" size="sm">
                        {roleLabels[item.role]}
                      </Badge>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </SettingsSection>
      )}
    </SettingsPage>
  );
}
