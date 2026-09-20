"use client";

/**
 * A imagem escolhida pela pessoa, reduzida e convertida para WebP no navegador, antes de subir para o
 * armazenamento (2026-09-20, a pedido). Toda subida da casa passa por aqui: rosto e logo de cliente, arte de
 * catálogo, capa e logo de projeto, foto de cobrança, logo e banner do time, foto de quem entra.
 *
 * O ganho é dos dois lados. No disco, uma foto de câmera de 6 MB vira algo entre 80 e 300 KB, e o balde
 * guarda o que a tela precisa em vez do que o celular gerou. Na rede, a imagem que chega é a que já cabe no
 * maior lugar em que ela aparece, então o navegador não baixa três mil pixels para desenhar quarenta.
 *
 * A conversão acontece no navegador, e não no servidor: o arquivo já vai direto do navegador para o Storage
 * com endereço assinado (ver `features/uploads/`), então reduzir antes é o único ponto do caminho em que o
 * byte economizado nunca chega a viajar.
 */

/** O maior arquivo que vale a pena abrir no navegador. Acima disso o celular trava ao decodificar. */
export const SOURCE_MAX_BYTES = 25 * 1024 * 1024;

export type ImagePreset = "avatar" | "logo" | "cover" | "banner" | "photo";

type Recipe = {
  /** A caixa em que a imagem precisa caber. Nunca aumenta: uma imagem menor que a caixa fica como está. */
  width: number;
  height: number;
  /** De 0 a 1, o que o WebP guarda. Quanto mais chapada a imagem, mais alto, porque borda dura marca. */
  quality: number;
  /**
   * Se a transparência precisa sobreviver quando o navegador não grava WebP. Logo e rosto recortado caem
   * para PNG, que guarda o canal; foto cai para JPEG, que é muito menor e não tem o que guardar.
   */
  alpha: boolean;
};

/**
 * A receita de cada lugar, tirada do maior tamanho em que a imagem aparece, com folga para tela retina. A
 * capa mantém os 1440 por 810 que a ficha de projeto já usava desde que o armazenamento nasceu.
 */
export const imagePresets: Record<ImagePreset, Recipe> = {
  avatar: { width: 512, height: 512, quality: 0.86, alpha: true },
  logo: { width: 512, height: 512, quality: 0.92, alpha: true },
  cover: { width: 1440, height: 810, quality: 0.82, alpha: false },
  banner: { width: 2048, height: 768, quality: 0.82, alpha: false },
  photo: { width: 1600, height: 1600, quality: 0.85, alpha: false },
};

/* A imagem decodificada já na orientação certa, pelo `createImageBitmap`, que lê a orientação do arquivo;
   onde ele não existe, o `<img>` cru resolve. Sem isto, foto de celular entra deitada. */
async function loadSource(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* cai para o <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = document.createElement("img");
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function paint(width: number, height: number, source: CanvasImageSource) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Sem canvas");
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

/**
 * De uma vez só, reduzir uma foto de quatro mil pixels para um rosto de quinhentos serrilha a borda: o
 * `drawImage` amostra poucos pixels do original e o resto se perde. Caindo pela metade a cada passo, cada
 * redução lê vizinhos de verdade e o resultado chega liso, que é o que a regra de não perder qualidade
 * visual pede.
 */
function scaleTo(source: CanvasImageSource, from: { width: number; height: number }, to: { width: number; height: number }) {
  let current = source;
  let { width, height } = from;

  while (width > to.width * 2 && height > to.height * 2) {
    width = Math.round(width / 2);
    height = Math.round(height / 2);
    current = paint(width, height, current);
  }

  return paint(to.width, to.height, current);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((done) => canvas.toBlob(done, type, quality));
}

/** O mesmo nome, com a extensão do que saiu: é o que aparece no painel de rede de quem depura. */
function renamed(name: string, type: string) {
  const base = name.replace(/\.[^.]+$/, "") || "imagem";
  return `${base}.${type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg"}`;
}

/**
 * A imagem pronta para subir. Levanta quando o navegador não consegue abrir o arquivo, e quem chama decide
 * o que dizer; `imageForUpload` é a porta que não levanta.
 */
export async function compressImage(file: File, preset: ImagePreset): Promise<File> {
  const recipe = imagePresets[preset];
  const source = await loadSource(file);
  const width = "naturalWidth" in source ? source.naturalWidth : source.width;
  const height = "naturalHeight" in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, recipe.width / width, recipe.height / height);

  /* Já é WebP e já cabe na caixa: nada a fazer, e reencodar só somaria perda de geração. É isto que deixa a
     ficha de projeto reduzir a capa para mostrar a prévia sem a subida reduzir de novo depois. */
  if (scale === 1 && file.type === "image/webp") {
    if ("close" in source) source.close();
    return file;
  }

  const canvas = scaleTo(source, { width, height }, { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) });
  if ("close" in source) source.close();

  /* Onde o navegador não grava WebP ele devolve PNG calado, então o tipo do que voltou é que decide. */
  const encoded = await toBlob(canvas, "image/webp", recipe.quality);
  const ready = encoded?.type === "image/webp" ? encoded : await toBlob(canvas, recipe.alpha ? "image/png" : "image/jpeg", recipe.quality);
  if (!ready) throw new Error("Sem imagem");

  return new File([ready], renamed(file.name, ready.type), { type: ready.type });
}

/**
 * A imagem pronta para subir, sem derrubar o envio: se o navegador não abrir o arquivo, o original segue
 * como está e quem recusa é a conferência de tipo e de tamanho logo adiante. Perder a foto por causa de um
 * canvas indisponível seria pior que guardá-la maior.
 */
export async function imageForUpload(file: File, preset: ImagePreset): Promise<File> {
  try {
    return await compressImage(file, preset);
  } catch {
    return file;
  }
}
