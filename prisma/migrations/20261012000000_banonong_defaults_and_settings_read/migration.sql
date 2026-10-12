-- Change defaults for new installations/rows only. Existing barangay settings
-- are intentionally preserved and must be verified by an administrator.
ALTER TABLE "BarangaySettings"
  ALTER COLUMN "name" SET DEFAULT 'Barangay Banonong',
  ALTER COLUMN "municipality" SET DEFAULT 'Dapitan City',
  ALTER COLUMN "province" SET DEFAULT 'Zamboanga del Norte';

DROP POLICY IF EXISTS "barangay_settings_staff_read_admin_write" ON "BarangaySettings";

CREATE POLICY "barangay_settings_authenticated_read_admin_write" ON "BarangaySettings"
  USING (current_setting('app.current_user_role', true) IN ('RESIDENT', 'STAFF', 'ADMIN'))
  WITH CHECK (current_setting('app.current_user_role', true) = 'ADMIN');
