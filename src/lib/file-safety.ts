import { ApiError } from "@/lib/api";
import { downloadObject, getObjectMetadata } from "@/lib/storage";

export const MAX_SUPPORTING_FILE_BYTES = 10 * 1024 * 1024;

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

export async function validateStoredUpload(
  objectKey: string,
  mimeType: string,
  expectedSize: number,
): Promise<Uint8Array> {
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
  return bytes;
}
