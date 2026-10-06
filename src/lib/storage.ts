import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | undefined;

function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is not configured");
  return bucket;
}

function getClient(): S3Client {
  if (client) return client;
  const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error("S3-compatible storage is not fully configured");
  }
  client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  });
  return client;
}

export async function createUploadUrl(key: string, contentType: string, sizeBytes: number) {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
    ServerSideEncryption: "AES256",
  });
  return getSignedUrl(getClient(), command, { expiresIn: 300 });
}

export async function uploadPdf(key: string, content: Uint8Array): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: content,
      ContentType: "application/pdf",
      ServerSideEncryption: "AES256",
    }),
  );
}

export async function createDownloadUrl(key: string): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: 60 },
  );
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return true;
  } catch (error) {
    if (error instanceof Error && "$metadata" in error) {
      const status = (error as Error & { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404) return false;
    }

    throw error;
  }
}

export async function downloadObject(key: string): Promise<Uint8Array> {
  const result = await getClient().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
  if (!result.Body) throw new Error(`Object ${key} has no response body`);
  return result.Body.transformToByteArray();
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}
