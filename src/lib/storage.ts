import { Storage } from "@google-cloud/storage";

const storage = new Storage();

/**
 * Fase 32: sobe mídia de exercício (vídeo/GIF) pro bucket GCS e devolve a
 * URL pública. Usa Application Default Credentials — nada de chave de
 * arquivo no repo: em produção é o service account anexado ao Cloud Run
 * (Terraform, infra/storage.tf); localmente, requer
 * `gcloud auth application-default login` uma vez.
 *
 * Bugs potenciais considerados antes de escrever esta função:
 * - não validar que o bucket está configurado — devolve um erro claro em vez
 *   de deixar o SDK do Google estourar uma mensagem genérica difícil de
 *   depurar.
 * - nome de objeto colidindo entre uploads — timestamp + sufixo aleatório
 *   evita sobrescrever mídia de outro exercício por coincidência.
 */
async function uploadToBucket(folder: string, buffer: Buffer, contentType: string, extension: string): Promise<string> {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error(
      "GCS_BUCKET_NAME não configurado. Rode 'gcloud auth application-default login' e defina a env var localmente, ou aplique infra/storage.tf em produção."
    );
  }

  const objectName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    metadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  return `https://storage.googleapis.com/${bucketName}/${objectName}`;
}

export async function uploadExerciseMedia(
  buffer: Buffer,
  contentType: string,
  extension: string
): Promise<string> {
  return uploadToBucket("exercises", buffer, contentType, extension);
}

/**
 * Fase 52: banner do carrossel de "Meu Treino Pessoal" (templates SELF
 * Treino em Casa/Premium) — mesmo bucket/mecanismo de uploadExerciseMedia,
 * só muda o prefixo do objeto (pasta separada, não mistura com mídia de
 * exercício).
 */
export async function uploadTemplateBanner(
  buffer: Buffer,
  contentType: string,
  extension: string
): Promise<string> {
  return uploadToBucket("banners", buffer, contentType, extension);
}
