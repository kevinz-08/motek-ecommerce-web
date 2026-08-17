-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "policiesAcceptedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "acceptedTermsAt" TIMESTAMP(3),
ADD COLUMN     "acceptedTermsVersion" TEXT,
ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketingConsentAt" TIMESTAMP(3);
