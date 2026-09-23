import "server-only";
import { dbMessage } from "@/lib/db/message";
import { promises as dns } from "node:dns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteConfig } from "@/lib/metadata";
import type { Database } from "@/types/database";
import type { ResumeLink, SaveAccountInput, SaveResumeInput, UserImageKind } from "./schemas";

/**
 * As configurações contra o banco: a conta de quem entra (nome e foto), o currículo dela, o domínio do
 * portfólio da equipe e a lista inteira de notificações. O que é de equipe (nome, área, pessoas, plano) já
 * mora em `organizations` e `billing`; aqui fica o que era item de menu sem regra por baixo.
 */
export type SettingsClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

const SAVE_FAILED = "Não foi possível salvar. Tente de novo em instantes.";

export const AVATAR_BUCKET = "user-avatars";

/** A conta de quem entra, como a página mostra. */
export type Account = {
  id: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  /** A foto larga atrás do rosto, no topo da página da conta; nula enquanto a pessoa não subir uma. */
  coverUrl: string | null;
};

/** O currículo, como a página edita e a pública desenha. */
export type Resume = {
  fullName: string;
  avatarUrl: string | null;
  headline: string;
  bio: string;
  location: string;
  skills: string[];
  links: ResumeLink[];
  resumeSlug: string;
  resumePublic: boolean;
};

const profileColumns = "id, full_name, email, avatar_url, cover_url, headline, bio, location, skills, links, resume_slug, resume_public";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  skills: string[];
  links: unknown;
  resume_slug: string | null;
  resume_public: boolean;
};

/* Os links vêm do jsonb: o zod fechou a forma na entrada, mas quem lê confere de novo, porque a coluna aceita
   qualquer lista e um dado torto não pode derrubar a página. */
function linksOf(value: unknown): ResumeLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) =>
    entry && typeof entry === "object" && typeof (entry as ResumeLink).label === "string" && typeof (entry as ResumeLink).url === "string"
      ? [{ label: (entry as ResumeLink).label, url: (entry as ResumeLink).url }]
      : [],
  );
}

async function profileOf(client: SettingsClient, userId: string): Promise<ProfileRow | null> {
  const { data } = await client.from("profiles").select(profileColumns).eq("id", userId).maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export async function getAccount(client: SettingsClient, userId: string): Promise<Account | null> {
  const row = await profileOf(client, userId);
  if (!row) return null;
  return { id: row.id, fullName: row.full_name ?? "", email: row.email, avatarUrl: row.avatar_url, coverUrl: row.cover_url };
}

export async function saveAccount(client: SettingsClient, userId: string, input: SaveAccountInput): Promise<ServiceResult<Account>> {
  const { error } = await client.from("profiles").update({ full_name: input.fullName }).eq("id", userId);
  if (error) return { ok: false, error: dbMessage(error, SAVE_FAILED) };

  /* O nome também mora nos metadados da sessão, que é de onde a concha o lê sem ir ao banco. */
  await client.auth.updateUser({ data: { full_name: input.fullName } });

  const account = await getAccount(client, userId);
  return account ? { ok: true, data: account } : { ok: false, error: SAVE_FAILED };
}

/** O trecho do endereço público depois do nome do balde, para apagar a foto anterior ao trocar. */
function storagePathOf(url: string | null) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const at = url.indexOf(marker);
  return at === -1 ? null : url.slice(at + marker.length);
}

const avatarExtensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

const userImageLabels: Record<UserImageKind, string> = { avatar: "foto", cover: "capa" };

/** Assina o endereço de subida da foto ou da capa: a pasta é o id da pessoa, que é de onde a policy tira a permissão. */
export async function createAvatarUpload(
  client: SettingsClient,
  userId: string,
  contentType: string,
  kind: UserImageKind = "avatar",
): Promise<ServiceResult<{ path: string; token: string }>> {
  const path = `${userId}/${kind}-${crypto.randomUUID()}.${avatarExtensions[contentType] ?? "png"}`;
  const { data, error } = await client.storage.from(AVATAR_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: `Não foi possível preparar o envio da ${userImageLabels[kind]}.` };
  return { ok: true, data: { path: data.path, token: data.token } };
}

/* A coluna de cada imagem, escrita por extenso para o tipo gerado do banco conferir a escrita. */
function userImagePatch(kind: UserImageKind, url: string | null) {
  return kind === "avatar" ? { avatar_url: url } : { cover_url: url };
}

function userImageUrlOf(row: ProfileRow | null, kind: UserImageKind) {
  return (kind === "avatar" ? row?.avatar_url : row?.cover_url) ?? null;
}

/** Grava o endereço da imagem no perfil (e, para a foto, na sessão) e apaga a anterior. */
export async function attachAvatar(
  client: SettingsClient,
  userId: string,
  path: string,
  kind: UserImageKind = "avatar",
): Promise<ServiceResult<string>> {
  if (!path.startsWith(`${userId}/`)) return { ok: false, error: SAVE_FAILED };

  const row = await profileOf(client, userId);
  const previous = storagePathOf(userImageUrlOf(row, kind));

  const {
    data: { publicUrl },
  } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  const { error } = await client.from("profiles").update(userImagePatch(kind, publicUrl)).eq("id", userId);
  if (error) return { ok: false, error: SAVE_FAILED };

  if (kind === "avatar") await client.auth.updateUser({ data: { avatar_url: publicUrl } });
  if (previous && previous !== path) await client.storage.from(AVATAR_BUCKET).remove([previous]);

  return { ok: true, data: publicUrl };
}

/** Tira a foto ou a capa do perfil e apaga o arquivo: é o × da tela, e não uma troca. */
export async function clearUserImage(client: SettingsClient, userId: string, kind: UserImageKind): Promise<ServiceResult<undefined>> {
  const row = await profileOf(client, userId);
  const previous = storagePathOf(userImageUrlOf(row, kind));

  const { error } = await client.from("profiles").update(userImagePatch(kind, null)).eq("id", userId);
  if (error) return { ok: false, error: SAVE_FAILED };

  if (kind === "avatar") await client.auth.updateUser({ data: { avatar_url: null } });
  if (previous) await client.storage.from(AVATAR_BUCKET).remove([previous]);

  return { ok: true, data: undefined };
}

export async function getResume(client: SettingsClient, userId: string): Promise<Resume | null> {
  const row = await profileOf(client, userId);
  if (!row) return null;

  return {
    fullName: row.full_name ?? "",
    avatarUrl: row.avatar_url,
    headline: row.headline ?? "",
    bio: row.bio ?? "",
    location: row.location ?? "",
    skills: row.skills ?? [],
    links: linksOf(row.links),
    resumeSlug: row.resume_slug ?? "",
    resumePublic: row.resume_public,
  };
}

export async function saveResume(client: SettingsClient, userId: string, input: SaveResumeInput): Promise<ServiceResult<Resume>> {
  /* Sem endereço não há currículo público: a chave desliga sozinha em vez de guardar um "público" sem porta. */
  const slug = input.resumeSlug || null;

  const { error } = await client
    .from("profiles")
    .update({
      headline: input.headline || null,
      bio: input.bio || null,
      location: input.location || null,
      skills: input.skills,
      links: input.links,
      resume_slug: slug,
      resume_public: Boolean(slug) && input.resumePublic,
    })
    .eq("id", userId);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Esse endereço já é de outra pessoa. Escolha outro." };
    return { ok: false, error: dbMessage(error, SAVE_FAILED) };
  }

  const resume = await getResume(client, userId);
  return resume ? { ok: true, data: resume } : { ok: false, error: SAVE_FAILED };
}

/** O domínio do portfólio da equipe, como a página mostra. */
export type CustomDomain = {
  domain: string | null;
  verifiedAt: string | null;
  /** Para onde o CNAME precisa apontar. */
  target: string;
  /** O endereço da casa, que sempre funciona. */
  fallbackUrl: string;
};

export const DOMAIN_TARGET = siteConfig.hosts.app;

export async function getCustomDomain(client: SettingsClient, organizationId: string): Promise<CustomDomain | null> {
  const { data } = await client.from("organizations").select("slug, custom_domain, custom_domain_verified_at").eq("id", organizationId).maybeSingle();
  if (!data) return null;
  return {
    domain: data.custom_domain,
    verifiedAt: data.custom_domain_verified_at,
    target: DOMAIN_TARGET,
    fallbackUrl: `${siteConfig.url}/p/${data.slug}`,
  };
}

/** Guarda o domínio (ou tira, com vazio). Trocar zera a conferência: o CNAME do novo ainda não foi visto. */
export async function setCustomDomain(client: SettingsClient, organizationId: string, domain: string | null): Promise<ServiceResult<CustomDomain>> {
  const { error } = await client
    .from("organizations")
    .update({ custom_domain: domain, custom_domain_verified_at: null })
    .eq("id", organizationId);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Esse domínio já está em uso por outra equipe." };
    return { ok: false, error: dbMessage(error, SAVE_FAILED) };
  }

  const current = await getCustomDomain(client, organizationId);
  return current ? { ok: true, data: current } : { ok: false, error: SAVE_FAILED };
}

/**
 * Confere o CNAME do domínio no DNS: ele precisa apontar para o endereço da casa. A conferência é feita
 * aqui, no servidor, e não pela tela, porque é ela que libera o portfólio naquele endereço.
 */
export async function verifyCustomDomain(client: SettingsClient, organizationId: string): Promise<ServiceResult<CustomDomain>> {
  const current = await getCustomDomain(client, organizationId);
  if (!current?.domain) return { ok: false, error: "Cadastre um domínio antes de conferir." };

  let records: string[] = [];
  try {
    records = await dns.resolveCname(current.domain);
  } catch {
    return { ok: false, error: `Ainda não achamos um CNAME em ${current.domain}. O DNS pode levar até 24 horas para propagar.` };
  }

  const points = records.some((record) => record.replace(/\.$/, "").toLowerCase() === DOMAIN_TARGET);
  if (!points) {
    return { ok: false, error: `O CNAME de ${current.domain} aponta para ${records.join(", ")}, e precisa apontar para ${DOMAIN_TARGET}.` };
  }

  const { error } = await client
    .from("organizations")
    .update({ custom_domain_verified_at: new Date().toISOString() })
    .eq("id", organizationId);

  if (error) return { ok: false, error: dbMessage(error, SAVE_FAILED) };

  const verified = await getCustomDomain(client, organizationId);
  return verified ? { ok: true, data: verified } : { ok: false, error: SAVE_FAILED };
}
