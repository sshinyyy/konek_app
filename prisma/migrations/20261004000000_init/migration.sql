-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('RESIDENT', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ISSUED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BARANGAY_CLEARANCE', 'CERTIFICATE_OF_RESIDENCY', 'BARANGAY_ID');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'COMPLETE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'RESIDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "privacyNoticeAcceptedAt" TIMESTAMP(3),
    "privacyNoticeVersion" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResidentProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fullNameEncrypted" TEXT NOT NULL,
    "dateOfBirthEncrypted" TEXT NOT NULL,
    "addressEncrypted" TEXT NOT NULL,
    "phoneEncrypted" TEXT NOT NULL,
    "civilStatusEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResidentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" UUID NOT NULL,
    "referenceNo" VARCHAR(32) NOT NULL,
    "residentId" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "purpose" VARCHAR(500) NOT NULL,
    "remarks" VARCHAR(1000),
    "decidedById" UUID,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportingDocument" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssuedDocument" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "referenceNo" VARCHAR(32) NOT NULL,
    "type" "DocumentType" NOT NULL,
    "recipientNameEncrypted" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "verificationHash" CHAR(64) NOT NULL,
    "pdfObjectKey" TEXT NOT NULL,

    CONSTRAINT "IssuedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRVerificationLog" (
    "id" UUID NOT NULL,
    "documentId" UUID,
    "tokenHash" CHAR(64) NOT NULL,
    "isAuthentic" BOOLEAN NOT NULL,
    "userAgent" VARCHAR(500),
    "ipHash" CHAR(64),
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRVerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarangaySettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Barangay San Isidro',
    "municipality" TEXT NOT NULL DEFAULT 'Municipality',
    "province" TEXT NOT NULL DEFAULT 'Province',
    "captainName" TEXT,
    "officeAddress" TEXT,
    "contactNumber" TEXT,
    "certificateValidityDays" INTEGER NOT NULL DEFAULT 365,
    "sealObjectKey" TEXT,
    "signatureObjectKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarangaySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ResidentProfile_userId_key" ON "ResidentProfile"("userId");

-- CreateIndex
CREATE INDEX "ResidentProfile_userId_idx" ON "ResidentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRequest_referenceNo_key" ON "DocumentRequest"("referenceNo");

-- CreateIndex
CREATE INDEX "DocumentRequest_residentId_submittedAt_idx" ON "DocumentRequest"("residentId", "submittedAt");

-- CreateIndex
CREATE INDEX "DocumentRequest_status_submittedAt_idx" ON "DocumentRequest"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportingDocument_objectKey_key" ON "SupportingDocument"("objectKey");

-- CreateIndex
CREATE INDEX "SupportingDocument_requestId_status_idx" ON "SupportingDocument"("requestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IssuedDocument_requestId_key" ON "IssuedDocument"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "IssuedDocument_referenceNo_key" ON "IssuedDocument"("referenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "IssuedDocument_verificationHash_key" ON "IssuedDocument"("verificationHash");

-- CreateIndex
CREATE INDEX "IssuedDocument_referenceNo_idx" ON "IssuedDocument"("referenceNo");

-- CreateIndex
CREATE INDEX "IssuedDocument_validUntil_revokedAt_idx" ON "IssuedDocument"("validUntil", "revokedAt");

-- CreateIndex
CREATE INDEX "QRVerificationLog_documentId_verifiedAt_idx" ON "QRVerificationLog"("documentId", "verifiedAt");

-- CreateIndex
CREATE INDEX "QRVerificationLog_tokenHash_verifiedAt_idx" ON "QRVerificationLog"("tokenHash", "verifiedAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx" ON "AuditLog"("entity", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "ResidentProfile" ADD CONSTRAINT "ResidentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportingDocument" ADD CONSTRAINT "SupportingDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuedDocument" ADD CONSTRAINT "IssuedDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRVerificationLog" ADD CONSTRAINT "QRVerificationLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "IssuedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
