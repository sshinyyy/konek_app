import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_SUPPORTING_FILE_BYTES } from "@/lib/file-safety";
import {
  fileExtensionForMime,
  hasExpectedFileSignature,
  scanStoredUpload,
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

describe("private scanner integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("FILE_SCAN_URL", "https://scanner.example.test/scan");
    vi.stubEnv("FILE_SCAN_TOKEN", "test-token");
    vi.stubEnv("NODE_ENV", "test");
    vi.mocked(getObjectMetadata).mockResolvedValue({
      contentLength: pdfHeader.byteLength,
      contentType: "application/pdf",
    });
    vi.mocked(downloadObject).mockResolvedValue(pdfHeader);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ clean: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  it("sends correctly validated bytes to the scanner", async () => {
    const result = await scanStoredUpload("quarantine/test.pdf", "application/pdf", pdfHeader.length);
    expect(result.clean).toBe(true);
    expect(result.bytes).toEqual(pdfHeader);
    expect(fetch).toHaveBeenCalledWith(
      new URL("https://scanner.example.test/scan"),
      expect.objectContaining({ method: "POST", body: expect.any(Buffer) }),
    );
  });

  it("rejects mismatched metadata before contacting the scanner", async () => {
    vi.mocked(getObjectMetadata).mockResolvedValue({
      contentLength: pdfHeader.length + 1,
      contentType: "application/pdf",
    });
    await expect(
      scanStoredUpload("quarantine/test.pdf", "application/pdf", pdfHeader.length),
    ).rejects.toMatchObject({ status: 422 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects files larger than the server limit before downloading or scanning", async () => {
    vi.mocked(getObjectMetadata).mockResolvedValue({
      contentLength: MAX_SUPPORTING_FILE_BYTES + 1,
      contentType: "application/pdf",
    });
    await expect(
      scanStoredUpload(
        "quarantine/oversized.pdf",
        "application/pdf",
        MAX_SUPPORTING_FILE_BYTES + 1,
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(downloadObject).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a file whose declared type does not match its bytes", async () => {
    vi.mocked(downloadObject).mockResolvedValue(pdfHeader);
    vi.mocked(getObjectMetadata).mockResolvedValue({
      contentLength: pdfHeader.length,
      contentType: "image/png",
    });
    await expect(
      scanStoredUpload("quarantine/test.png", "image/png", pdfHeader.length),
    ).rejects.toMatchObject({ status: 422 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails closed if no malware scanner is configured", async () => {
    vi.stubEnv("FILE_SCAN_URL", "");
    await expect(
      scanStoredUpload("quarantine/test.pdf", "application/pdf", pdfHeader.length),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("returns scanner detections without treating the file as clean", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ clean: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const result = await scanStoredUpload("quarantine/test.pdf", "application/pdf", pdfHeader.length);
    expect(result.clean).toBe(false);
  });
});
