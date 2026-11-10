import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";

const mocks = vi.hoisted(() => ({
  findUpload: vi.fn(),
  findRequest: vi.fn(),
  updateUpload: vi.fn(),
  getSession: vi.fn(),
  withRlsContext: vi.fn(),
  validateStoredUpload: vi.fn(),
  scanForMalware: vi.fn(),
  uploadObject: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/rls", () => ({ withRlsContext: mocks.withRlsContext }));
vi.mock("@/lib/file-safety", () => ({
  fileExtensionForMime: vi.fn(() => "pdf"),
  validateStoredUpload: mocks.validateStoredUpload,
}));
vi.mock("@/lib/malware-scan", () => ({ scanForMalware: mocks.scanForMalware }));
vi.mock("@/lib/storage", () => ({
  deleteObject: mocks.deleteObject,
  uploadObject: mocks.uploadObject,
}));

import { POST } from "@/app/api/v1/uploads/[id]/complete/route";

const session = {
  userId: "resident-id",
  email: "resident@example.test",
  role: "RESIDENT" as const,
};
const file = {
  id: "upload-id",
  requestId: "request-id",
  objectKey: "quarantine/resident-id/upload.pdf",
  fileName: "supporting.pdf",
  mimeType: "application/pdf",
  sizeBytes: 16,
  status: "PENDING" as const,
};

function request() {
  return new Request("https://barangay.example.test/api/v1/uploads/upload-id/complete", {
    method: "POST",
    headers: { Origin: "https://barangay.example.test" },
  });
}

describe("POST /api/v1/uploads/:id/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(session);
    mocks.findUpload.mockResolvedValue(file);
    mocks.findRequest.mockResolvedValue({ residentId: session.userId, status: "PENDING" });
    mocks.updateUpload.mockResolvedValue(undefined);
    mocks.withRlsContext.mockImplementation(async (_session, operation) =>
      operation({
        supportingDocument: { findUnique: mocks.findUpload, update: mocks.updateUpload },
        documentRequest: { findUnique: mocks.findRequest },
      }),
    );
    mocks.validateStoredUpload.mockResolvedValue(Buffer.from("synthetic-content"));
    mocks.scanForMalware.mockResolvedValue("CLEAN");
  });

  it("moves only scanned-clean files out of quarantine", async () => {
    const response = await POST(request(), { params: Promise.resolve({ id: file.id }) });

    expect(response.status).toBe(200);
    expect(mocks.scanForMalware).toHaveBeenCalledOnce();
    expect(mocks.uploadObject).toHaveBeenCalledWith(
      `requirements/${session.userId}/${file.id}.pdf`,
      expect.any(Uint8Array),
      file.mimeType,
    );
    expect(mocks.updateUpload).toHaveBeenCalledWith({
      where: { id: file.id },
      data: { objectKey: `requirements/${session.userId}/${file.id}.pdf`, status: "CLEAN" },
    });
    expect(mocks.deleteObject).toHaveBeenCalledWith(file.objectKey);
  });

  it("rejects and deletes malware-positive files without copying them", async () => {
    mocks.scanForMalware.mockResolvedValue("INFECTED");

    const response = await POST(request(), { params: Promise.resolve({ id: file.id }) });

    expect(response.status).toBe(422);
    expect(mocks.updateUpload).toHaveBeenCalledWith({
      where: { id: file.id },
      data: { status: "REJECTED" },
    });
    expect(mocks.deleteObject).toHaveBeenCalledWith(file.objectKey);
    expect(mocks.uploadObject).not.toHaveBeenCalled();
  });

  it("fails closed and leaves the quarantine file pending when scanning is unavailable", async () => {
    mocks.scanForMalware.mockRejectedValue(
      new ApiError(503, "Malware scanning is temporarily unavailable."),
    );

    const response = await POST(request(), { params: Promise.resolve({ id: file.id }) });

    expect(response.status).toBe(503);
    expect(mocks.updateUpload).not.toHaveBeenCalled();
    expect(mocks.uploadObject).not.toHaveBeenCalled();
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("rescans legacy COMPLETE files before marking them clean", async () => {
    mocks.findUpload.mockResolvedValue({ ...file, status: "COMPLETE", objectKey: "requirements/resident-id/upload.pdf" });

    const response = await POST(request(), { params: Promise.resolve({ id: file.id }) });

    expect(response.status).toBe(200);
    expect(mocks.scanForMalware).toHaveBeenCalledOnce();
    expect(mocks.updateUpload).toHaveBeenCalledWith({
      where: { id: file.id },
      data: { status: "CLEAN" },
    });
    expect(mocks.uploadObject).not.toHaveBeenCalled();
  });
});
