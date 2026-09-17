import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { imageExtensions, uploadTargets, type ImageContentType, type UploadTarget } from "./schemas";

/**
 * A regra da subida de imagem, igual para todo domínio. Roda no servidor, com o cliente de quem pediu, então
 * a RLS é quem decide: a policy dos baldes (`can_manage_org_file`) só deixa escrever dentro da pasta da
 * organização, e a tabela de destino já tem a sua.
 *
 * São três passos, e o do meio não passa por aqui: o servidor assina o endereço, o navegador manda o arquivo
 * direto para o Storage, e o servidor grava o endereço público na linha. Passar o arquivo por dentro da
 * Server Action esbarraria no limite de corpo da requisição e ainda ocuparia o processo, que é a mesma razão
 * pela qual a logo do time já subia assim.
 */

export type UploadClient = SupabaseClient<Database>;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

const PREPARE_FAILED = "Não foi possível preparar o envio da imagem.";
const SAVE_FAILED = "Não foi possível salvar a imagem.";
const NOT_FOUND = "Registro não encontrado.";

/**
 * O trecho do endereço público depois do nome do balde, que é o caminho do arquivo. É o que permite apagar o
 * anterior ao trocar: sem isso cada troca deixaria um arquivo órfão ocupando espaço para sempre.
 */
function storagePathOf(url: string | null | undefined, bucket: string) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const at = url.indexOf(marker);
  return at === -1 ? null : url.slice(at + marker.length);
}

/**
 * Onde cada alvo lê e grava o endereço da imagem. Um par por alvo, com a tabela e a coluna escritas por
 * extenso, e não montadas em texto: só assim o tipo gerado do banco confere a escrita, e um nome de coluna
 * errado para de compilar em vez de falhar calado na hora de salvar.
 */
const columns = {
  "client-avatar": {
    read: (client: UploadClient, id: string, org: string) =>
      client.from("clients").select("avatar_url").eq("id", id).eq("organization_id", org).maybeSingle(),
    write: (client: UploadClient, id: string, org: string, url: string | null) =>
      client.from("clients").update({ avatar_url: url }).eq("id", id).eq("organization_id", org),
  },
  "client-logo": {
    read: (client: UploadClient, id: string, org: string) =>
      client.from("clients").select("company_logo_url").eq("id", id).eq("organization_id", org).maybeSingle(),
    write: (client: UploadClient, id: string, org: string, url: string | null) =>
      client.from("clients").update({ company_logo_url: url }).eq("id", id).eq("organization_id", org),
  },
  "catalog-image": {
    read: (client: UploadClient, id: string, org: string) =>
      client.from("catalog_items").select("image_url").eq("id", id).eq("organization_id", org).maybeSingle(),
    write: (client: UploadClient, id: string, org: string, url: string | null) =>
      client.from("catalog_items").update({ image_url: url }).eq("id", id).eq("organization_id", org),
  },
  "project-cover": {
    read: (client: UploadClient, id: string, org: string) =>
      client.from("projects").select("cover_url").eq("id", id).eq("organization_id", org).maybeSingle(),
    write: (client: UploadClient, id: string, org: string, url: string | null) =>
      client.from("projects").update({ cover_url: url }).eq("id", id).eq("organization_id", org),
  },
} as const;

/** O registro precisa existir e ser da organização: é dele que sai a pasta, e é ele que vai receber o endereço. */
async function findRecord(client: UploadClient, organizationId: string, target: UploadTarget, recordId: string) {
  const { data } = await columns[target].read(client, recordId, organizationId);
  if (!data) return null;

  const held = Object.values(data)[0];
  return { current: storagePathOf(typeof held === "string" ? held : null, uploadTargets[target].bucket) };
}

/**
 * Assina o endereço de subida. O caminho começa com o id da organização porque é dele que a policy tira a
 * permissão, e leva um identificador aleatório porque o navegador e a borda guardam imagem por endereço: o
 * mesmo nome de arquivo mostraria a imagem antiga depois da troca.
 */
export async function createImageUpload(
  client: UploadClient,
  input: { organizationId: string; target: UploadTarget; recordId: string; contentType: ImageContentType },
): Promise<ServiceResult<{ path: string; token: string }>> {
  const { bucket, folder } = uploadTargets[input.target];

  const record = await findRecord(client, input.organizationId, input.target, input.recordId);
  if (!record) return { ok: false, error: NOT_FOUND };

  const path = `${input.organizationId}/${folder}/${input.recordId}-${crypto.randomUUID()}.${imageExtensions[input.contentType]}`;
  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data) return { ok: false, error: PREPARE_FAILED };
  return { ok: true, data: { path: data.path, token: data.token } };
}

/** Grava o endereço público na coluna do registro e apaga o arquivo que estava lá antes. */
export async function attachImage(
  client: UploadClient,
  input: { organizationId: string; target: UploadTarget; recordId: string; path: string },
): Promise<ServiceResult<string>> {
  const { bucket } = uploadTargets[input.target];

  /* O caminho vem do cliente, então ele é conferido aqui também: a policy do banco já barraria a escrita
     fora da pasta, mas a gravação do endereço na linha não passa por ela. */
  if (!input.path.startsWith(`${input.organizationId}/`)) return { ok: false, error: SAVE_FAILED };

  const record = await findRecord(client, input.organizationId, input.target, input.recordId);
  if (!record) return { ok: false, error: NOT_FOUND };

  const {
    data: { publicUrl },
  } = client.storage.from(bucket).getPublicUrl(input.path);

  const { error } = await columns[input.target].write(client, input.recordId, input.organizationId, publicUrl);

  if (error) return { ok: false, error: SAVE_FAILED };

  if (record.current && record.current !== input.path) {
    await client.storage.from(bucket).remove([record.current]);
  }

  return { ok: true, data: publicUrl };
}

/** Tira a imagem do registro e apaga o arquivo: é o × da tela, e não uma troca. */
export async function clearImage(
  client: UploadClient,
  input: { organizationId: string; target: UploadTarget; recordId: string },
): Promise<ServiceResult<undefined>> {
  const { bucket } = uploadTargets[input.target];

  const record = await findRecord(client, input.organizationId, input.target, input.recordId);
  if (!record) return { ok: false, error: NOT_FOUND };

  const { error } = await columns[input.target].write(client, input.recordId, input.organizationId, null);

  if (error) return { ok: false, error: SAVE_FAILED };

  if (record.current) await client.storage.from(bucket).remove([record.current]);

  return { ok: true, data: undefined };
}
