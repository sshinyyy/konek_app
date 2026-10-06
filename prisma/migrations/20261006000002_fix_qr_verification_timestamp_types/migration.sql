DROP FUNCTION IF EXISTS public.verify_issued_document(char(64), text, char(64));

CREATE FUNCTION public.verify_issued_document(
  p_token_hash char(64),
  p_user_agent text,
  p_ip_hash char(64)
)
RETURNS TABLE (
  authentic boolean,
  "referenceNo" text,
  "documentType" "DocumentType",
  "recipientNameEncrypted" text,
  "issuedAt" timestamp(3) without time zone,
  "validUntil" timestamp(3) without time zone
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
