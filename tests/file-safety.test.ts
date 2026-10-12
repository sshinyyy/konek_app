import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_SUPPORTING_FILE_BYTES } from "@/lib/file-safety";
import {
  fileExtensionForMime,
  hasExpectedFileSignature,
  validateStoredUpload,
} from "@/lib/file-safety";
import { downloadObject, getObjectMetadata } from "@/lib/storage";

vi.mock("@/lib/storage", () => ({
  downloadObject: vi.fn(),
  getObjectMetadata: vi.fn(),
}));

const pdfHeader = new TextEncoder().encode("%PDF-1.7");

describe("uploaded file signature validation", () => {
  it("uses only canonical extensions for allowed content types", () => {
    expect(fileExtensionForMime("application/pdf")).toBe("pdf");
    expect(fileExtensionForMime("image/jpeg")).toBe("jpg");
    expect(fileExtensionForMime("image/png")).toBe("png");
    expect(fileExtensionForMime("image/webp")).toBe("webp");
    expect(() => fileExtensionForMime("../../private")).toThrow();
  });

  it("recognizes only the allowed file signatures", () => {
    expect(hasExpectedFileSignature("application/pdf", pdfHeader)).toBe(true);
    expect(hasExpectedFileSignature("image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff]))).toBe(true);
    expect(
      hasExpectedFileSignature("image/png", Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])),
    ).toBe(true);
    expect(
      hasExpectedFileSignature(
        "image/webp",
        Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
      ),
    ).toBe(true);
    expect(hasExpectedFileSignature("image/png", pdfHeader)).toBe(false);
    expect(hasExpectedFileSignature("image/svg+xml", pdfHeader)).toBe(false);
  });
});

describe("stored upload validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getObjectMetadata).mockResolvedValue({
      contentLength: pdfHeader.byteLength,
      contentType: "application/pdf",
    });
    vi.mocked(downloadObject).mockResolvedValue(pdfHeader);
  });

  it("returns bytes after checking stored metadata, size, and signature", async () => {
    const result = await validateStoredUpload("quarantine/test.pdf", "application/pdf", pdfHeader.length);
    expect(result).toEqual(pdfHeader);
    expect(getObjectMetadata).toHaveBeenCalledWith("quarantine/test.pdf");
    expect(downloadObject).toHaveBeenCalledWith("quarantine/test.pdf");
  });

  it("rejects mismatched metadata before downloading the file", async () => {
    vi.mocked(getObjectMetadata).mockResolvedValue({
      contentLength: pdfHeader.length + 1,
      contentType: "application/pdf",
    });
    await expect(
      validateStoredUpload("quarantine/test.pdf", "application/pdf", pdfHeader.length),
    ).rejects.toMatchObject({ status: 422 });
    expect(downloadObject).not.toHaveBeenCalled();
  });

  it("rejects files larger than the server limit before downloading", async () => {
    vi.mocked(getObjectMetadata).mockResolvedValue({
      contentLength: MAX_SUPPORTING_FILE_BYTES + 1,
      contentType: "application/pdf",
    });
    await expect(
      validateStoredUpload(
        "quarantine/oversized.pdf",
        "application/pdf",
        MAX_SUPPORTING_FILE_BYTES + 1,
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(downloadObject).not.toHaveBeenCalled();
  });

  it("rejects a file whose declared type does not match its bytes", async () => {
    vi.mocked(downloadObject).mockResolvedValue(pdfHeader);
    vi.mocked(getObjectMetadata).mockResolvedValue({
      contentLength: pdfHeader.length,
      contentType: "image/png",
    });
    await expect(
      validateStoredUpload("quarantine/test.png", "image/png", pdfHeader.length),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("rejects a file whose actual bytes do not match its declared type", async () => {
    vi.mocked(getObjectMetadata).mockResolvedValue({
      contentLength: pdfHeader.length,
      contentType: "image/png",
    });
    await expect(
      validateStoredUpload("quarantine/test.png", "image/png", pdfHeader.length),
    ).rejects.toMatchObject({ status: 422 });
  });
});
