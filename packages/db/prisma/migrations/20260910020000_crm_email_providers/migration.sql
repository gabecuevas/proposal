-- AlterEnum
ALTER TYPE "CrmEmailSyncProvider" ADD VALUE 'OFFICE365';
ALTER TYPE "CrmEmailSyncProvider" ADD VALUE 'EXCHANGE';
ALTER TYPE "CrmEmailSyncProvider" ADD VALUE 'IMAP';

-- AlterTable
ALTER TABLE "CrmEmailAccount" ADD COLUMN "imap_host" TEXT,
ADD COLUMN "imap_port" INTEGER,
ADD COLUMN "smtp_host" TEXT,
ADD COLUMN "smtp_port" INTEGER,
ADD COLUMN "credentials_configured" BOOLEAN NOT NULL DEFAULT false;
