"use client";

import { ArrowLeftIcon, ArrowRightIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import {
  cancelInviteAction,
  changeInviteRoleAction,
  changeMemberRoleAction,
  finishOnboardingAction,
  inviteMemberAction,
  removeMemberAction,
} from "@/features/organizations/actions";
import type { MemberRole } from "@/features/organizations/schemas";
import type { Team, TeamInvite, TeamMember } from "@/features/organizations/service";
import { invitableRoleOptions, memberRoleOptions } from "../labels";
import styles from "./onboarding.module.css";

type MembersStepProps = {
  team: Team;
  members: TeamMember[];
  invites: TeamInvite[];
  currentUser: TeamMember;
  demo?: boolean;
  onBack: () => void;
};

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function MembersStep({ team, members, invites, currentUser, demo = false, onBack }: MembersStepProps) {
  const { toast } = useToast();
  const router = useRouter();
  // O time recém criado ainda não veio do servidor com a lista pronta, e a pessoa precisa se ver ali.
  const [people, setPeople] = useState(() => (members.length > 0 ? members : [currentUser]));
  const [pending, setPending] = useState(invites);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const canInvite = emailPattern.test(email.trim()) && name.trim().length >= 2;

  // Convite sempre entra como membro; quem quiser dar mais acesso troca o papel na lista de baixo.
  const invite = async () => {
    if (!canInvite || inviting) return;
    setInviting(true);

    if (demo) {
      setPending((current) => [
        ...current.filter((item) => item.email !== email),
        { id: crypto.randomUUID(), name, email, role: "member" },
      ]);
    } else {
      const result = await inviteMemberAction({ organizationId: team.id, email, name, role: "member" });
      if (!result.ok) {
        toast({ title: "Não foi possível convidar", description: result.error, tone: "danger" });
        setInviting(false);
        return;
      }
      // Convidar o mesmo e-mail de novo troca a linha pendente no banco, então a lista troca junto.
      setPending((current) => [...current.filter((item) => item.email !== result.data.email), result.data]);
      toast({ title: "Convite enviado", description: `Avisamos ${email} por e-mail`, tone: "success" });
    }

    setEmail("");
    setName("");
    setInviting(false);
  };

  const updateRole = async (userId: string, next: MemberRole) => {
    const previous = people;
    setPeople((current) => current.map((person) => (person.userId === userId ? { ...person, role: next } : person)));
    if (demo) return;

    const result = await changeMemberRoleAction({ organizationId: team.id, userId, role: next });
    if (!result.ok) {
      setPeople(previous);
      toast({ title: "Não foi possível trocar o papel", description: result.error, tone: "danger" });
    }
  };

  const dropMember = async (userId: string) => {
    const previous = people;
    setPeople((current) => current.filter((person) => person.userId !== userId));
    if (demo) return;

    const result = await removeMemberAction({ organizationId: team.id, userId });
    if (!result.ok) {
      setPeople(previous);
      toast({ title: "Não foi possível remover", description: result.error, tone: "danger" });
    }
  };

  const updateInviteRole = async (inviteId: string, next: MemberRole) => {
    if (next === "owner") return;
    const previous = pending;
    setPending((current) => current.map((item) => (item.id === inviteId ? { ...item, role: next } : item)));
    if (demo) return;

    const result = await changeInviteRoleAction({ organizationId: team.id, inviteId, role: next });
    if (!result.ok) {
      setPending(previous);
      toast({ title: "Não foi possível trocar o papel", description: result.error, tone: "danger" });
    }
  };

  const dropInvite = async (inviteId: string) => {
    const previous = pending;
    setPending((current) => current.filter((item) => item.id !== inviteId));
    if (demo) return;

    const result = await cancelInviteAction({ organizationId: team.id, inviteId });
    if (!result.ok) {
      setPending(previous);
      toast({ title: "Não foi possível cancelar", description: result.error, tone: "danger" });
    }
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);

    if (demo) {
      setFinishing(false);
      toast({ title: "Prévia", description: "Aqui entra a escolha do plano", tone: "info" });
      return;
    }

    const result = await finishOnboardingAction({ organizationId: team.id });
    if (!result.ok) {
      toast({ title: "Não foi possível concluir", description: result.error, tone: "danger" });
      setFinishing(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className={styles.step}>
      <div className={styles.form}>
        <div className={styles.pair}>
          <Field label="E-mail">
            <Input
              type="email"
              name="invite-email"
              value={email}
              placeholder="pessoa@dominio.com"
              autoComplete="off"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label="Nome">
            <Input
              type="text"
              name="invite-name"
              value={name}
              placeholder="Nome da pessoa"
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        </div>

        <Button
          variant="secondary"
          size="md"
          fullWidth
          loading={inviting}
          disabled={!canInvite}
          iconStart={<PaperPlaneTiltIcon />}
          onClick={() => void invite()}
        >
          {inviting ? "Enviando" : "Convidar"}
        </Button>
      </div>

      <Separator />

      <div className={styles.list}>
        <Text variant="footnote" tone="secondary">
          Membros da equipe
        </Text>

        {people.map((person) => {
          const label = person.name ?? person.email ?? "Sem nome";
          const removable = person.userId !== currentUser.userId && person.role !== "owner";
          return (
            <div key={person.userId} className={styles.member}>
              <Avatar name={label} src={person.avatarUrl ?? undefined} seed={person.email ?? person.userId} size="md" />
              <div className={styles.memberText}>
                <div className={styles.memberName}>
                  <Text variant="subheadline" weight="medium" truncate>
                    {label}
                  </Text>
                </div>
                <Text variant="footnote" tone="secondary" truncate>
                  {person.email}
                </Text>
              </div>
              <span className={styles.role}>
                <Select
                  label={`Papel de ${label}`}
                  options={memberRoleOptions}
                  value={person.role}
                  size="sm"
                  disabled={person.role === "owner"}
                  onChange={(next) => void updateRole(person.userId, next)}
                  actions={
                    removable
                      ? [
                          {
                            label: "Remover do time",
                            tone: "danger",
                            onSelect: () => void dropMember(person.userId),
                          },
                        ]
                      : undefined
                  }
                />
              </span>
            </div>
          );
        })}

        {pending.map((item) => {
          const label = item.name ?? item.email;
          return (
            <div key={item.id} className={styles.member}>
              <Avatar name={label} seed={item.email} size="md" />
              <div className={styles.memberText}>
                <div className={styles.memberName}>
                  <Text variant="subheadline" weight="medium" truncate>
                    {label}
                  </Text>
                  <Badge tone="warning" size="sm">
                    Pendente
                  </Badge>
                </div>
                <Text variant="footnote" tone="secondary" truncate>
                  {item.email}
                </Text>
              </div>
              <span className={styles.role}>
                <Select
                  label={`Papel de ${label}`}
                  options={invitableRoleOptions}
                  value={item.role}
                  size="sm"
                  onChange={(next) => void updateInviteRole(item.id, next)}
                  actions={[
                    { label: "Cancelar convite", tone: "danger", onSelect: () => void dropInvite(item.id) },
                  ]}
                />
              </span>
            </div>
          );
        })}
      </div>

      <div className={styles.actions}>
        <IconButton label="Voltar para os dados do time" variant="secondary" className={styles.back} onClick={onBack}>
          <ArrowLeftIcon />
        </IconButton>
        <Button size="lg" loading={finishing} iconEnd={<ArrowRightIcon />} onClick={() => void finish()}>
          {finishing ? "Concluindo" : "Avançar"}
        </Button>
      </div>
    </div>
  );
}
