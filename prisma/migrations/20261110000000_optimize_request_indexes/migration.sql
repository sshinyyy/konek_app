-- Remove indexes duplicated by unique constraints and align request indexes with queue ordering.
CREATE INDEX "DocumentRequest_residentId_submittedAt_id_idx"
  ON "DocumentRequest"("residentId", "submittedAt", "id");

CREATE INDEX "DocumentRequest_submittedAt_id_idx"
  ON "DocumentRequest"("submittedAt", "id");

DROP INDEX "ResidentProfile_userId_idx";
DROP INDEX "StaffProfile_userId_idx";
DROP INDEX "IssuedDocument_referenceNo_idx";
DROP INDEX "DocumentRequest_residentId_submittedAt_idx";
