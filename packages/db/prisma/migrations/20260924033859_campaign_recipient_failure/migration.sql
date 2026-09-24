-- AlterTable
ALTER TABLE "CampaignRecipient" ADD COLUMN     "error" TEXT,
ADD COLUMN     "failedAt" TIMESTAMP(3);
