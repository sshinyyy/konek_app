import { describe, expect, it } from "vitest";
import {
  getSupportingFileIssue,
  getSupportingFileMimeType,
  MAX_SUPPORTING_FILE_BYTES,
} from "@/lib/supporting-file-validation";

function file(name: string, type: string, size: number) {
  return { name, type, size };
}

describe("supporting file validation", () => {
  it.each([
    ["proof.pdf", "application/pdf"],
    ["proof.jpg", "image/jpeg"],
    ["proof.jpeg", "image/jpeg"],
    ["proof.png", "image/png"],
    ["proof.webp", "image/webp"],
  ])("accepts %s", (name, type) => {
    const selected = file(name, type, 1024);
    expect(getSupportingFileIssue(selected)).toBeNull();
    expect(getSupportingFileMimeType(selected)).toBe(type);
  });

  it("infers a supported type when the browser omits the MIME type", () => {
    expect(getSupportingFileMimeType(file("proof.pdf", "", 1024))).toBe("application/pdf");
  });

  it("rejects unsupported extensions and mismatched MIME types", () => {
    expect(getSupportingFileIssue(file("proof.exe", "application/octet-stream", 1024))).toContain("PDF, JPG, PNG, or WebP");
    expect(getSupportingFileIssue(file("proof.pdf", "image/jpeg", 1024))).toContain("PDF, JPG, PNG, or WebP");
  });

  it("rejects empty and oversized files", () => {
    expect(getSupportingFileIssue(file("proof.pdf", "application/pdf", 0))).toContain("empty");
    expect(getSupportingFileIssue(file("proof.pdf", "application/pdf", MAX_SUPPORTING_FILE_BYTES + 1))).toContain("10 MB");
  });
});
