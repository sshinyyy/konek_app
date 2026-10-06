-- The app sets these transaction-local values with set_config(..., true).
-- Connect Prisma using a non-owner application role so these policies apply.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'konek_app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO konek_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO konek_app';
  END IF;
END
$$;

INSERT INTO "BarangaySettings" ("id", "updatedAt")
VALUES (1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BarangaySettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResidentProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportingDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IssuedDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QRVerificationLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
ALTER TABLE "BarangaySettings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ResidentProfile" FORCE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DocumentRequest" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SupportingDocument" FORCE ROW LEVEL SECURITY;
ALTER TABLE "IssuedDocument" FORCE ROW LEVEL SECURITY;
ALTER TABLE "QRVerificationLog" FORCE ROW LEVEL SECURITY;

CREATE POLICY "user_owner_staff_or_login" ON "User"
  USING (
    "id"::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN')
    OR "email" = current_setting('app.login_email', true)
  )
  WITH CHECK (
    "id"::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN')
  );

CREATE POLICY "audit_log_actor_or_staff" ON "AuditLog"
  USING (current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN'))
  WITH CHECK (
    "actorId"::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN')
  );

CREATE POLICY "barangay_settings_staff_read_admin_write" ON "BarangaySettings"
  USING (current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN'))
  WITH CHECK (current_setting('app.current_user_role', true) = 'ADMIN');

CREATE POLICY "profile_owner_or_staff" ON "ResidentProfile"
  USING (
    "userId"::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN')
  )
  WITH CHECK ("userId"::text = current_setting('app.current_user_id', true));

CREATE POLICY "request_owner_or_staff" ON "DocumentRequest"
  USING (
    "residentId"::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN')
  )
  WITH CHECK (
    "residentId"::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN')
  );

CREATE POLICY "supporting_document_owner_or_staff" ON "SupportingDocument"
  USING (
    EXISTS (
      SELECT 1 FROM "DocumentRequest" request
      WHERE request.id = "SupportingDocument"."requestId"
        AND (
          request."residentId"::text = current_setting('app.current_user_id', true)
          OR current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "DocumentRequest" request
      WHERE request.id = "SupportingDocument"."requestId"
        AND request."residentId"::text = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "issued_document_owner_or_staff" ON "IssuedDocument"
  USING (
    EXISTS (
      SELECT 1 FROM "DocumentRequest" request
      WHERE request.id = "IssuedDocument"."requestId"
        AND (
          request."residentId"::text = current_setting('app.current_user_id', true)
          OR current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN')
        )
    )
  )
  WITH CHECK (current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN'));

CREATE POLICY "qr_log_staff_read" ON "QRVerificationLog"
  USING (current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN'))
  WITH CHECK (current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN'));

CREATE OR REPLACE FUNCTION verify_issued_document(
  p_token_hash char(64),
  p_user_agent text,
  p_ip_hash char(64)
)
RETURNS TABLE (
  authentic boolean,
  "referenceNo" text,
  "documentType" "DocumentType",
  "recipientNameEncrypted" text,
  "issuedAt" timestamptz,
  "validUntil" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  match_row "IssuedDocument"%ROWTYPE;
  valid boolean;
BEGIN
  PERFORM set_config('app.current_user_id', '00000000-0000-0000-0000-000000000000', true);
  PERFORM set_config('app.current_user_role', 'ADMIN', true);

  SELECT * INTO match_row
  FROM "IssuedDocument" issued
  WHERE issued."verificationHash" = p_token_hash
  LIMIT 1;

  valid := FOUND
    AND match_row."revokedAt" IS NULL
    AND (match_row."validUntil" IS NULL OR match_row."validUntil" > now());

  INSERT INTO "QRVerificationLog" ("id", "documentId", "tokenHash", "isAuthentic", "userAgent", "ipHash")
  VALUES (gen_random_uuid(), CASE WHEN match_row.id IS NULL THEN NULL ELSE match_row.id END,
          p_token_hash, valid, left(p_user_agent, 500), p_ip_hash);

  RETURN QUERY SELECT
    valid,
    CASE WHEN valid THEN match_row."referenceNo"::text END,
    CASE WHEN valid THEN match_row.type END,
    CASE WHEN valid THEN match_row."recipientNameEncrypted" END,
    CASE WHEN valid THEN match_row."issuedAt" END,
    CASE WHEN valid THEN match_row."validUntil" END;
END;
$$;
