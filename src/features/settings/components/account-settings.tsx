"use client";

import type { Route } from "next";
import { PencilSimpleIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { industryLabels, roleLabels } from "@/features/onboarding/labels";
import type { Team, TeamMember } from "@/features/organizations/service";
import { saveAccountAction } from "../actions";
import { accountLimits } from "../schemas";
import type { Account } from "../service";
import { uploadAvatar } from "../upload";
import { SettingsFact, SettingsPage, SettingsSection } from "./settings-page";
import styles from "./settings.module.css";

/* A gaveta de editar equipe chega só quando alguém a abre: ela leva o seletor de imagem e o envio ao Storage. */
const CreateTeamPanel = dynamic(() => import("@/features/organizations/components/create-team-panel").then((module) => module.CreateTeamPanel));

export type AccountSettingsProps = { account: Account; team: Team | null; viewer: TeamMember };

/**
 * A conta de quem entra e a equipe em que está (2026-09-17). Em cima a pessoa: a foto, que sobe direto para
 * o Storage, o nome e o e-mail, que é de entrada e não se troca aqui. Embaixo a equipe: o que ela é, com o
 * editar abrindo a mesma gaveta do seletor de equipe, e o atalho para a página das pessoas.
 */
export function AccountSettings({ account, team, viewer }: AccountSettingsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(account.fullName);
  const [avatarUrl, setAvatarUrl] = useState(account.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState(false);

  const canManageTeam = viewer.role !== "member";
  const changed = name.trim() !== account.fullName;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !changed) return;
    setSaving(true);
    setError(null);
    const result = await saveAccountAction({ fullName: name });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast({ title: "Nome salvo", description: "É assim que a equipe passa a ver você.", tone: "success" });
    router.refresh();
  };

  const pick = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    const result = await uploadAvatar(file);
    setUploading(false);
    if (!result.ok) {
      toast({ title: "A foto não subiu", description: result.error, tone: "danger" });
      return;
    }
    setAvatarUrl(result.url);
    toast({ title: "Foto atualizada", description: "Ela já aparece no menu e nos documentos.", tone: "success" });
    router.refresh();
  };

  return (
    <SettingsPage title="Sua conta" description="Quem você é para a equipe e para os clientes, e a equipe em que você está.">
      <SettingsSection title="Você" description="A foto e o nome aparecem no menu, nas tarefas e nos documentos que você manda.">
        <div className={styles.identity}>
          <div className={styles.avatar}>
            <Avatar name={name || account.email || "Você"} src={avatarUrl ?? undefined} seed={account.email ?? account.id} size="lg" />
            <Button variant="outline" size="sm" radius="md" iconStart={<UploadSimpleIcon />} loading={uploading} onClick={() => fileInput.current?.click()}>
              {avatarUrl ? "Trocar foto" : "Enviar foto"}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={styles.fileInput}
              aria-label="Enviar a sua foto"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                void pick(file);
              }}
            />
          </div>

          <form className={styles.form} style={{ flex: 1, minWidth: "16rem" }} onSubmit={(event) => void save(event)} noValidate>
            <Field label="Nome" required error={error ?? undefined}>
              <Input type="text" value={name} maxLength={accountLimits.fullName} autoComplete="name" disabled={saving} invalid={Boolean(error)} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="E-mail" hint="É o e-mail de entrada; para trocar, fale com quem administra a conta">
              <Input type="email" value={account.email ?? ""} readOnly disabled />
            </Field>
            <div className={styles.actions}>
              <Button type="submit" size="sm" radius="md" loading={saving} disabled={!changed}>
                Salvar nome
              </Button>
            </div>
          </form>
        </div>
      </SettingsSection>

      {team && (
        <SettingsSection
          title="Equipe"
          description="O que a equipe é. Quem entra e quem sai fica na página de equipe."
          aside={
            canManageTeam ? (
              <Button variant="outline" size="sm" radius="md" iconStart={<PencilSimpleIcon />} onClick={() => setEditingTeam(true)}>
                Editar equipe
              </Button>
            ) : (
              <Badge tone="neutral" variant="soft" size="sm">
                {roleLabels[viewer.role]}
              </Badge>
            )
          }
        >
          <div className={styles.identity}>
            <Avatar name={team.name} src={team.logoUrl ?? undefined} size="lg" shape="squircle" />
            <dl className={styles.facts} style={{ flex: 1 }}>
              <SettingsFact label="Nome">{team.name}</SettingsFact>
              <SettingsFact label="Área de atuação">{team.industry ? industryLabels[team.industry] : "Não informada"}</SettingsFact>
              <SettingsFact label="Site">{team.website ? <TextLink href={team.website as Route} target="_blank" rel="noreferrer">{team.website.replace(/^https?:\/\//, "")}</TextLink> : "Sem site"}</SettingsFact>
              <SettingsFact label="Seu papel">{roleLabels[viewer.role]}</SettingsFact>
            </dl>
          </div>
          <Text variant="footnote" tone="secondary">
            Pessoas, convites e papéis ficam em <TextLink href="/configuracoes/equipe">Equipe</TextLink>. O plano e as faturas, em{" "}
            <TextLink href="/configuracoes/plano">Plano</TextLink>.
          </Text>
        </SettingsSection>
      )}

      {team && editingTeam && (
        <CreateTeamPanel
          open
          teamId={team.id}
          owner={{ name: viewer.name ?? account.fullName, email: viewer.email ?? account.email, avatarUrl: viewer.avatarUrl ?? avatarUrl }}
          onClose={() => {
            setEditingTeam(false);
            router.refresh();
          }}
        />
      )}
    </SettingsPage>
  );
}
