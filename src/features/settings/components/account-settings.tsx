"use client";

import {
  ArrowSquareOutIcon,
  ArrowUpRightIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  CameraIcon,
  CopySimpleIcon,
  CrownIcon,
  FireIcon,
  FolderOpenIcon,
  GlobeIcon,
  IdentificationCardIcon,
  ImageSquareIcon,
  MapPinIcon,
  MedalIcon,
  PencilSimpleIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  TrophyIcon,
  UserIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Route } from "next";
import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { avatarHue } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FieldAffix } from "@/components/ui/field-shell";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Profile, ProfileEvent, ProfileEvents, ProfileList, ProfileProgress, ProfileRow, ProfileTags, type ProfileAction } from "@/components/ui/profile";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "@/components/ui/tag-input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import type { AiUsage } from "@/features/ai/summary";
import type { PointsSummary } from "@/features/gamification/summary";
import { roleLabels } from "@/features/onboarding/labels";
import { memberProjectStatuses } from "@/features/organizations/constants";
import type { Team, TeamMember } from "@/features/organizations/service";
import type { TeamMember as MemberSummary } from "@/features/organizations/summary";
import { callAction } from "@/lib/action";
import { siteConfig } from "@/lib/metadata";
import { compactMoney } from "@/lib/utils/format";
import { slugify } from "@/lib/utils/slug";
import { saveAccountAction, saveResumeAction } from "../actions";
import { hostOf, networkOf } from "../links";
import { accountLimits, resumeLimits, type ResumeLink, type UserImageKind } from "../schemas";
import type { Account, Resume } from "../service";
import { removeUserImage, uploadAvatar } from "../upload";
import { SettingsFact, SettingsPage, SettingsSection } from "./settings-page";
import styles from "./account-settings.module.css";
import shared from "./settings.module.css";

export type AccountSettingsProps = {
  account: Account;
  /** O currículo da pessoa, de onde saem o título, a cidade, o sobre, as habilidades e os links; nulo sem perfil. */
  resume: Resume | null;
  viewer: TeamMember;
  team: Team | null;
  /** A pessoa no resumo da equipe, com o papel, os números, os projetos e a atividade; nula fora da lista de membros. */
  member: MemberSummary | null;
  points: PointsSummary;
  streak: { days: number; since: string };
  ai: AiUsage;
};

/* O papel de acesso em etiqueta, com o mesmo glifo e tom do perfil de membro da equipe. */
const accessMeta: Record<TeamMember["role"], { icon: Icon; tone: BadgeTone }> = {
  owner: { icon: CrownIcon, tone: "yellow" },
  admin: { icon: ShieldCheckIcon, tone: "info" },
  member: { icon: UserIcon, tone: "neutral" },
};

const number = new Intl.NumberFormat("pt-BR");
const longDate = (iso: string) => format(parseISO(iso), "d 'de' MMM. 'de' yyyy", { locale: ptBR });
const monthYear = (iso: string) => format(parseISO(iso), "MMM. 'de' yyyy", { locale: ptBR });
const shortStamp = (iso: string) => format(parseISO(iso), "d MMM., HH:mm", { locale: ptBR });

/** Quantas habilidades o cabeçalho mostra antes do "+N". */
const SHOWN_SKILLS = 8;

/** O que a página edita: o nome, da conta, e o currículo inteiro. */
type Values = {
  fullName: string;
  headline: string;
  location: string;
  bio: string;
  skills: string[];
  links: ResumeLink[];
  resumeSlug: string;
  resumePublic: boolean;
};

const resumeValuesOf = (resume: Resume | null) => ({
  headline: resume?.headline ?? "",
  location: resume?.location ?? "",
  bio: resume?.bio ?? "",
  skills: resume?.skills ?? [],
  links: resume?.links ?? [],
  resumeSlug: resume?.resumeSlug ?? "",
  resumePublic: resume?.resumePublic ?? false,
});

const valuesOf = (account: Account, resume: Resume | null): Values => ({ fullName: account.fullName, ...resumeValuesOf(resume) });

/* O que vai para o servidor: texto sem espaço nas pontas e sem link vazio. É também o que decide se algo mudou. */
const normalize = (values: Values): Values => ({
  ...values,
  fullName: values.fullName.trim(),
  headline: values.headline.trim(),
  location: values.location.trim(),
  bio: values.bio.trim(),
  links: values.links.map((link) => ({ label: link.label.trim(), url: link.url.trim() })).filter((link) => link.label || link.url),
});

const resumeOf = ({ headline, location, bio, skills, links, resumeSlug, resumePublic }: Values) => ({ headline, location, bio, skills, links, resumeSlug, resumePublic });

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const imageTitles: Record<UserImageKind, { failed: string; done: string; doneCopy: string }> = {
  avatar: { failed: "Não deu para enviar a foto", done: "Foto atualizada", doneCopy: "Ela já aparece no menu e nos documentos." },
  cover: { failed: "Não deu para enviar a capa", done: "Capa atualizada", doneCopy: "Ela fica no topo do seu perfil." },
};

/**
 * A conta é a página da pessoa, refeita em 2026-09-20 sobre três referências de perfil (a de rede social, a
 * ficha de contato e a de perfil profissional), só com peças que já existiam ou que ganharam lugar nos
 * primitivos da casa. O cabeçalho é o `Profile`, o mesmo do cliente e do membro da equipe, agora com a capa
 * de verdade por cima do matiz e os botões de trocar capa e foto no lugar em que as redes os põem; o nome
 * com o papel e, quando o currículo está no ar, a etiqueta de público; o e-mail e o que a pessoa faz; a
 * cidade, a equipe e desde quando; as habilidades em pílulas; os números que o bloco de equipe do painel
 * já mede; e os botões de ir ao currículo público, ao portfólio e às conquistas. Na ponta do nome, Cancelar
 * e Salvar valem para a página inteira.
 *
 * Embaixo, as duas colunas das referências: à esquerda o que se edita (apresentação, habilidades, links e
 * redes desenhados como cartões na cor de cada rede, os projetos em que a pessoa está) e à direita o que se
 * lê (detalhes, o endereço público do currículo, as conquistas e a atividade recente). Tudo o que o
 * cabeçalho mostra sai dos campos ao vivo, então a pessoa vê o perfil mudar enquanto digita. A foto e a
 * capa sobem na hora, fora do Salvar: são arquivo, e não campo.
 */
export function AccountSettings({ account, resume: initialResume, viewer, team, member, points, streak, ai }: AccountSettingsProps) {
  const { toast } = useToast();
  const photoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(() => normalize(valuesOf(account, initialResume)));
  const [values, setValues] = useState<Values>(saved);
  const [images, setImages] = useState<Record<UserImageKind, string | null>>({ avatar: account.avatarUrl, cover: account.coverUrl });
  const [uploading, setUploading] = useState<UserImageKind | null>(null);
  const [confirmingCover, setConfirmingCover] = useState(false);
  const [removingCover, setRemovingCover] = useState(false);
  const [editingLinks, setEditingLinks] = useState(saved.links.length === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);

  const seed = account.email ?? account.id;
  const access = accessMeta[viewer.role];
  const changed = !same(normalize(values), saved);
  const name = values.fullName.trim() || "Você";
  const publicHost = siteConfig.url.replace(/^https?:\/\//, "");
  const publicUrl = saved.resumePublic && saved.resumeSlug ? `${siteConfig.url}/cv/${saved.resumeSlug}` : null;
  const shownLinks = values.links.filter((link) => hostOf(link.url));
  const location = values.location.trim();

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (error) setError(null);
  };

  const reset = () => {
    setValues(saved);
    setError(null);
  };

  const setLink = (index: number, patch: Partial<ResumeLink>) => set("links", values.links.map((link, position) => (position === index ? { ...link, ...patch } : link)));

  /* O endereço puxa o nome: quem cola o link do Instagram não precisa escrever "Instagram" ao lado. */
  const setLinkUrl = (index: number, url: string) => {
    const network = networkOf(url);
    const current = values.links[index];
    setLink(index, { url, label: current.label || (network.id === "site" ? "" : network.label) });
  };

  /* Nome e currículo moram em tabelas e ações diferentes; a página salva os dois de uma vez, e só o que
     mudou, para um erro de um lado não desfazer o outro. */
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !changed) return;
    setSaving(true);
    setError(null);

    const next = normalize(values);

    if (next.fullName !== saved.fullName) {
      const result = await callAction(saveAccountAction({ fullName: next.fullName }));
      if (!result.ok) {
        setSaving(false);
        setError({ field: result.field ?? "fullName", message: result.error });
        return;
      }
    }

    let stored = next;
    if (!same(resumeOf(next), resumeOf(saved))) {
      const result = await callAction(saveResumeAction(resumeOf(next)));
      if (!result.ok) {
        setSaving(false);
        setError({ field: result.field, message: result.error });
        return;
      }
      stored = { fullName: next.fullName, ...resumeValuesOf(result.resume) };
    }

    setSaving(false);
    setSaved(stored);
    setValues(stored);
    if (stored.links.length > 0) setEditingLinks(false);
    toast({ title: "Perfil salvo", description: "É assim que a equipe e os clientes passam a ver você.", tone: "success" });
  };

  const pick = async (kind: UserImageKind, file: File | null) => {
    if (!file) return;
    setUploading(kind);
    const result = await uploadAvatar(file, kind);
    setUploading(null);
    if (!result.ok) {
      toast({ title: imageTitles[kind].failed, description: result.error, tone: "danger" });
      return;
    }
    setImages((current) => ({ ...current, [kind]: result.url }));
    toast({ title: imageTitles[kind].done, description: imageTitles[kind].doneCopy, tone: "success" });
  };

  const removeCover = async () => {
    setRemovingCover(true);
    const result = await removeUserImage("cover");
    setRemovingCover(false);
    setConfirmingCover(false);
    if (!result.ok) {
      toast({ title: "Não deu para tirar a capa", description: result.error, tone: "danger" });
      return;
    }
    setImages((current) => ({ ...current, cover: null }));
    toast({ title: "Capa removida", description: "O topo do perfil voltou para a sua cor.", tone: "success" });
  };

  const copy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: "Link copiado", description: publicUrl, tone: "success" });
    } catch {
      toast({ title: "Não deu para copiar", description: publicUrl, tone: "warning" });
    }
  };

  const errorOf = (field: string) => (error?.field === field ? error.message : undefined);

  const actions: ProfileAction[] = [
    ...(publicUrl ? [{ label: "Currículo público", icon: IdentificationCardIcon, href: publicUrl, primary: true, external: true }] : []),
    { label: "Portfólio", icon: GlobeIcon, href: "/portfolio", primary: !publicUrl },
    { label: "Conquistas", icon: TrophyIcon, href: "/conquistas" },
  ];

  const stats = member
    ? [
        { label: "Entregues", value: String(member.metrics.deliveredProjects) },
        { label: "Faturamento", value: compactMoney(member.metrics.revenue) },
        { label: "Em andamento", value: String(member.metrics.activeProjects) },
        { label: "Tarefas abertas", value: String(member.metrics.openTasks) },
      ]
    : [
        { label: "Pontos", value: number.format(points.points) },
        { label: "Posição", value: `#${number.format(points.rank)}` },
        { label: "Sequência", value: `${number.format(streak.days)} ${streak.days === 1 ? "dia" : "dias"}` },
      ];

  const achievements: { id: string; icon: Icon; hue: string; label: string; value: string; caption: string }[] = [
    { id: "points", icon: TrophyIcon, hue: "var(--sys-yellow)", label: "Pontos", value: number.format(points.points), caption: `${number.format(points.dailyPoints)} por dia no ritmo atual` },
    { id: "rank", icon: MedalIcon, hue: "var(--sys-indigo)", label: "Posição", value: `#${number.format(points.rank)}`, caption: "Entre todas as pessoas da Specular" },
    { id: "streak", icon: FireIcon, hue: "var(--sys-orange)", label: "Sequência", value: `${number.format(streak.days)} ${streak.days === 1 ? "dia" : "dias"}`, caption: `Desde ${longDate(streak.since)}` },
  ];

  return (
    <SettingsPage ai={ai}>
      <form className={styles.form} onSubmit={(event) => void save(event)} noValidate>
        <div className={styles.frame}>
          <Profile
            hue={avatarHue(seed)}
            cover={images.cover}
            coverAction={
              <span className={styles.glass}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  radius="md"
                  iconStart={<ImageSquareIcon />}
                  loading={uploading === "cover"}
                  background="var(--glass-layer-bg)"
                  foreground="var(--color-label)"
                  onClick={() => coverInput.current?.click()}
                >
                  {images.cover ? "Trocar capa" : "Adicionar capa"}
                </Button>
                {images.cover && (
                  <IconButton
                    label="Tirar capa"
                    variant="outline"
                    size="sm"
                    radius="md"
                    background="var(--glass-layer-bg)"
                    foreground="var(--color-label)"
                    disabled={uploading === "cover"}
                    onClick={() => setConfirmingCover(true)}
                  >
                    <TrashIcon />
                  </IconButton>
                )}
              </span>
            }
            avatar={{ name, src: images.avatar ?? undefined, seed }}
            photoAction={
              <span className={styles.photoButton}>
                <IconButton label={images.avatar ? "Trocar foto" : "Enviar foto"} size="sm" radius="full" loading={uploading === "avatar"} onClick={() => photoInput.current?.click()}>
                  <CameraIcon weight="fill" />
                </IconButton>
              </span>
            }
            title={name}
            badges={
              <>
                <Badge tone={access.tone} size="sm" icon={<access.icon />}>
                  {roleLabels[viewer.role]}
                </Badge>
                {publicUrl && (
                  <Badge tone="success" size="sm" icon={<IdentificationCardIcon />}>
                    Currículo público
                  </Badge>
                )}
              </>
            }
            menu={
              <span className={styles.menu}>
                <Button type="button" variant="ghost" size="sm" radius="md" disabled={!changed || saving} onClick={reset}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" radius="md" loading={saving} disabled={!changed}>
                  Salvar
                </Button>
              </span>
            }
            handle={account.email ?? undefined}
            subtitle={values.headline.trim() || undefined}
            stats={stats}
            actions={actions}
          >
            <div className={styles.meta}>
              {location && (
                <Text as="span" variant="footnote" tone="secondary" className={styles.metaItem}>
                  <MapPinIcon aria-hidden="true" />
                  {location}
                </Text>
              )}
              {team && (
                <Text as="span" variant="footnote" tone="secondary" className={styles.metaItem}>
                  <BuildingsIcon aria-hidden="true" />
                  {team.name}
                </Text>
              )}
              <Text as="span" variant="footnote" tone="secondary" className={styles.metaItem}>
                <CalendarBlankIcon aria-hidden="true" />
                Na Specular desde {monthYear(streak.since)}
              </Text>
            </div>
            {values.skills.length > 0 && (
              <ProfileTags>
                {values.skills.slice(0, SHOWN_SKILLS).map((skill) => (
                  <Badge key={skill} size="sm">
                    {skill}
                  </Badge>
                ))}
                {values.skills.length > SHOWN_SKILLS && (
                  <Badge size="sm" tone="neutral">
                    +{values.skills.length - SHOWN_SKILLS}
                  </Badge>
                )}
              </ProfileTags>
            )}
          </Profile>
        </div>

        <input
          ref={photoInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={shared.fileInput}
          aria-label="Enviar a sua foto"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = "";
            void pick("avatar", file);
          }}
        />
        <input
          ref={coverInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={shared.fileInput}
          aria-label="Enviar a capa do perfil"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = "";
            void pick("cover", file);
          }}
        />

        <div className={styles.columns}>
          <div className={styles.column}>
            <SettingsSection title="Apresentação">
              <Field label="Nome" required error={errorOf("fullName")}>
                <Input type="text" value={values.fullName} maxLength={accountLimits.fullName} autoComplete="name" disabled={saving} invalid={Boolean(errorOf("fullName"))} onChange={(event) => set("fullName", event.target.value)} />
              </Field>
              <div className={shared.pair}>
                <Field label="Título" error={errorOf("headline")}>
                  <Input type="text" value={values.headline} maxLength={resumeLimits.headline} placeholder="Designer de produto" disabled={saving} invalid={Boolean(errorOf("headline"))} onChange={(event) => set("headline", event.target.value)} />
                </Field>
                <Field label="Cidade" error={errorOf("location")}>
                  <Input type="text" value={values.location} maxLength={resumeLimits.location} placeholder="São Paulo, SP" autoComplete="address-level2" disabled={saving} invalid={Boolean(errorOf("location"))} onChange={(event) => set("location", event.target.value)} />
                </Field>
              </div>
              <Field label="Sobre você" error={errorOf("bio")}>
                <Textarea rows={6} value={values.bio} maxLength={resumeLimits.bio} placeholder="Como você trabalha, com quem já trabalhou, o que gosta de fazer." disabled={saving} invalid={Boolean(errorOf("bio"))} onChange={(event) => set("bio", event.target.value)} />
              </Field>
              {error && !error.field && (
                <Text variant="footnote" tone="danger" role="alert">
                  {error.message}
                </Text>
              )}
            </SettingsSection>

            <SettingsSection title="Habilidades">
              <Field label="Habilidades" error={errorOf("skills")}>
                <TagInput value={values.skills} placeholder="Figma, Next.js, direção de arte" max={resumeLimits.skills} maxLength={resumeLimits.skill} disabled={saving} onChange={(skills) => set("skills", skills)} />
              </Field>
            </SettingsSection>

            <SettingsSection
              title="Links e redes"
              aside={
                editingLinks ? (
                  <span className={styles.menu}>
                    {values.links.length < resumeLimits.links && (
                      <Button type="button" variant="outline" size="sm" radius="md" iconStart={<PlusIcon />} disabled={saving} onClick={() => set("links", [...values.links, { label: "", url: "" }])}>
                        Adicionar
                      </Button>
                    )}
                    {shownLinks.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" radius="md" onClick={() => setEditingLinks(false)}>
                        Concluir
                      </Button>
                    )}
                  </span>
                ) : (
                  <Button type="button" variant="outline" size="sm" radius="md" iconStart={<PencilSimpleIcon />} onClick={() => setEditingLinks(true)}>
                    Editar
                  </Button>
                )
              }
            >
              {editingLinks ? (
                values.links.length === 0 ? (
                  <Text variant="footnote" tone="secondary">
                    Nenhum link ainda. Cole o endereço do seu Instagram, LinkedIn, Behance ou site.
                  </Text>
                ) : (
                  <div className={shared.list}>
                    {values.links.map((link, index) => {
                      const network = networkOf(link.url);
                      return (
                        <div key={index} className={shared.pair}>
                          <Field label="Nome" error={errorOf(`links.${index}.label`)}>
                            <Input type="text" value={link.label} maxLength={resumeLimits.linkLabel} placeholder={network.label} disabled={saving} onChange={(event) => setLink(index, { label: event.target.value })} />
                          </Field>
                          <Field label="Endereço" error={errorOf(`links.${index}.url`)}>
                            <Input
                              type="url"
                              value={link.url}
                              placeholder="https://"
                              inputMode="url"
                              spellCheck={false}
                              disabled={saving}
                              invalid={Boolean(errorOf(`links.${index}.url`))}
                              iconStart={<network.icon weight="fill" className={styles.linkIcon} style={{ "--link-hue": network.hue } as CSSProperties} />}
                              iconEnd={
                                <IconButton label="Tirar link" variant="ghost" size="sm" disabled={saving} onClick={() => set("links", values.links.filter((_, position) => position !== index))}>
                                  <XIcon />
                                </IconButton>
                              }
                              onChange={(event) => setLinkUrl(index, event.target.value)}
                            />
                          </Field>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <ul className={styles.links}>
                  {shownLinks.map((link, index) => {
                    const network = networkOf(link.url);
                    return (
                      <li key={`${link.url}-${index}`}>
                        <a href={link.url} target="_blank" rel="noreferrer" className={styles.link} style={{ "--link-hue": network.hue } as CSSProperties}>
                          <span className={styles.linkGlyph} aria-hidden="true">
                            <network.icon weight="fill" />
                          </span>
                          <span className={styles.linkCopy}>
                            <Text as="span" variant="subheadline" weight="semibold" truncate>
                              {link.label || network.label}
                            </Text>
                            <Text as="span" variant="footnote" tone="secondary" truncate>
                              {hostOf(link.url)}
                            </Text>
                          </span>
                          <ArrowUpRightIcon className={styles.linkArrow} weight="bold" aria-hidden="true" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SettingsSection>

            {member && member.projects.length > 0 && (
              <SettingsSection title="Projetos em que você está">
                <ProfileList>
                  {member.projects.map((project) => {
                    const status = memberProjectStatuses[project.status];
                    return (
                      <ProfileRow
                        key={project.id}
                        href={`/projetos/${project.id}` as Route}
                        icon={FolderOpenIcon}
                        title={project.name}
                        caption={<ProfileProgress value={project.progress} done={project.status === "done"} />}
                        end={
                          <Badge tone={status.tone} size="sm">
                            {status.label}
                          </Badge>
                        }
                      />
                    );
                  })}
                </ProfileList>
              </SettingsSection>
            )}
          </div>

          <div className={styles.column}>
            <SettingsSection title="Detalhes">
              <dl className={shared.facts}>
                <SettingsFact label="E-mail">{account.email ?? "Não informado"}</SettingsFact>
                <SettingsFact label="Acesso">{roleLabels[viewer.role]}</SettingsFact>
                <SettingsFact label="Equipe">{team?.name ?? "Sem equipe"}</SettingsFact>
                {member && <SettingsFact label="Função">{member.role}</SettingsFact>}
                {member && <SettingsFact label="Na equipe desde">{longDate(member.joinedAt)}</SettingsFact>}
                <SettingsFact label="Na Specular desde">{longDate(streak.since)}</SettingsFact>
                <SettingsFact label="Currículo">{publicUrl ? `${publicHost}/cv/${saved.resumeSlug}` : "Só você vê"}</SettingsFact>
              </dl>
            </SettingsSection>

            <SettingsSection title="Endereço público">
              <Field label="Endereço" error={errorOf("resumeSlug")}>
                <Input
                  type="text"
                  value={values.resumeSlug}
                  maxLength={40}
                  placeholder={slugify(values.fullName || "seu-nome", 40)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={saving}
                  invalid={Boolean(errorOf("resumeSlug"))}
                  iconStart={<FieldAffix data-tone="muted">{publicHost}/cv/</FieldAffix>}
                  onChange={(event) => set("resumeSlug", slugify(event.target.value, 40))}
                />
              </Field>
              <div className={styles.toggle}>
                <span className={shared.rowCopy}>
                  <Text as="span" variant="subheadline" weight="medium">
                    Currículo público
                  </Text>
                  <Text as="span" variant="footnote" tone="secondary">
                    {values.resumeSlug ? "Quem tiver o link abre, sem conta." : "Preencha o endereço para poder ligar."}
                  </Text>
                </span>
                <Switch size="sm" aria-label="Currículo público" checked={values.resumePublic} disabled={saving || !values.resumeSlug} onChange={(event) => set("resumePublic", event.target.checked)} />
              </div>
              {publicUrl && (
                <div className={shared.code}>
                  <code>{publicUrl}</code>
                  <IconButton label="Copiar link" variant="ghost" size="sm" radius="md" onClick={() => void copy()}>
                    <CopySimpleIcon />
                  </IconButton>
                  <IconButton label="Abrir currículo" variant="ghost" size="sm" radius="md" href={publicUrl} target="_blank" rel="noreferrer">
                    <ArrowSquareOutIcon />
                  </IconButton>
                </div>
              )}
            </SettingsSection>

            <SettingsSection
              title="Conquistas"
              aside={
                <Button variant="outline" size="sm" radius="md" href="/conquistas">
                  Ver tudo
                </Button>
              }
            >
              <div className={shared.list}>
                {achievements.map((entry) => (
                  <div key={entry.id} className={shared.row}>
                    <span className={shared.glyph} style={{ "--item-hue": entry.hue } as CSSProperties} aria-hidden="true">
                      <entry.icon weight="duotone" />
                    </span>
                    <span className={shared.rowCopy}>
                      <Text as="span" variant="subheadline" weight="medium">
                        {entry.label}
                      </Text>
                      <Text as="span" variant="footnote" tone="secondary" truncate>
                        {entry.caption}
                      </Text>
                    </span>
                    <Text as="span" variant="title3" weight="semibold" numeric className={shared.rowEnd}>
                      {entry.value}
                    </Text>
                  </div>
                ))}
              </div>
            </SettingsSection>

            {member && member.activity.length > 0 && (
              <SettingsSection title="Atividade recente">
                <ProfileEvents>
                  {member.activity.map((event) => (
                    <ProfileEvent key={event.id} avatar={{ name, src: images.avatar ?? undefined, seed }} actor={name.split(" ")[0]} action={event.action} stamp={shortStamp(event.at)} />
                  ))}
                </ProfileEvents>
              </SettingsSection>
            )}
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmingCover}
        title="Tirar a capa?"
        description="O topo do perfil volta para a sua cor. A imagem é apagada e não dá para recuperar."
        confirmLabel="Tirar capa"
        pendingLabel="Tirando"
        pending={removingCover}
        onClose={() => setConfirmingCover(false)}
        onConfirm={() => void removeCover()}
      />
    </SettingsPage>
  );
}
