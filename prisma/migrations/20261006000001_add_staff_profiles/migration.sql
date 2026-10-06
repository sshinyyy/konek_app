CREATE TABLE "StaffProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fullNameEncrypted" TEXT NOT NULL,
    "jobTitle" VARCHAR(150) NOT NULL,
    "phoneEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");
CREATE INDEX "StaffProfile_userId_idx" ON "StaffProfile"("userId");

ALTER TABLE "StaffProfile"
    ADD CONSTRAINT "StaffProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "StaffProfile" TO konek_app;

ALTER TABLE "StaffProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffProfile" FORCE ROW LEVEL SECURITY;

CREATE POLICY "staff_profile_owner_or_admin" ON "StaffProfile"
    USING (
        "userId"::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) = 'ADMIN'
    )
    WITH CHECK (
        "userId"::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_role', true) = 'ADMIN'
    );
