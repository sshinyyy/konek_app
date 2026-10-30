const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const MAX_SUPPORTING_FILE_BYTES = 10 * 1024 * 1024;

export function getSupportingFileMimeType(file: Pick<File, "name" | "type">): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const expectedType = MIME_TYPES_BY_EXTENSION[extension];
  if (!expectedType || (file.type && file.type !== expectedType)) return null;
  return expectedType;
}

export function getSupportingFileIssue(file: Pick<File, "name" | "type" | "size">): string | null {
  if (!getSupportingFileMimeType(file)) return "Choose a PDF, JPG, PNG, or WebP file.";
  if (file.size < 1) return "The selected file is empty.";
  if (file.size > MAX_SUPPORTING_FILE_BYTES) return "Each supporting file must be 10 MB or smaller.";
  return null;
}
