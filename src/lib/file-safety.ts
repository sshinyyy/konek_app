import { ApiError } from "@/lib/api";
import { downloadObject, getObjectMetadata } from "@/lib/storage";

export const MAX_SUPPORTING_FILE_BYTES = 10 * 1024 * 1024;

export type ScannedUpload = { bytes: Uint8Array; clean: boolean };

export function fileExtensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      throw new ApiError(422, "The uploaded file type is not allowed.");
  }
}

export function hasExpectedFileSignature(mimeType: string, bytes: Uint8Array): boolean {
  switch (mimeType) {
    case "application/pdf":
      return bytes.length >= 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return (
        bytes.length >= 8 &&
        [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
      );
    case "image/webp":
      return (
        bytes.length >= 12 &&
        new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
      );
    default:
      return false;
  }
}

export async function scanStoredUpload(
  objectKey: string,
  mimeType: string,
  expectedSize: number,
): Promise<ScannedUpload> {
  const metadata = await getObjectMetadata(objectKey);
  if (
    !metadata ||
    metadata.contentLength !== expectedSize ||
    metadata.contentLength > MAX_SUPPORTING_FILE_BYTES ||
    metadata.contentType !== mimeType
  ) {
    throw new ApiError(422, "The uploaded file metadata does not match the request.");
  }

  const bytes = await downloadObject(objectKey);
  if (
    bytes.byteLength !== expectedSize ||
    !hasExpectedFileSignature(mimeType, bytes)
  ) {
    throw new ApiError(422, "The uploaded file content does not match its allowed file type.");
  }

  const scannerUrl = process.env.FILE_SCAN_URL;
  const scannerToken = process.env.FILE_SCAN_TOKEN;
  if (!scannerUrl || !scannerToken) {
    throw new ApiError(503, "Uploaded-file safety checks are not configured.");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(scannerUrl);
  } catch {
    throw new ApiError(503, "Uploaded-file safety checks are not configured.");
  }
  if (
    endpoint.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && endpoint.hostname === "localhost")
  ) {
    throw new ApiError(503, "Uploaded-file safety checks are not configured.");
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${scannerToken}`,
        "Content-Type": mimeType,
      },
      body: Buffer.from(bytes),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError(503, "Uploaded-file safety checks are temporarily unavailable.");
  }
  if (!response.ok) {
    throw new ApiError(503, "Uploaded-file safety checks are temporarily unavailable.");
  }

  const result = (await response.json().catch(() => null)) as { clean?: unknown } | null;
  if (!result || typeof result.clean !== "boolean") {
    throw new ApiError(503, "Uploaded-file safety checks are temporarily unavailable.");
  }
  return { bytes, clean: result.clean };
}
