DROP POLICY IF EXISTS "audit_log_actor_or_staff" ON "AuditLog";

CREATE POLICY "audit_log_actor_or_staff" ON "AuditLog"
  USING (
    "actorId"::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN')
  )
  WITH CHECK (
    "actorId"::text = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) IN ('STAFF', 'ADMIN')
  );
