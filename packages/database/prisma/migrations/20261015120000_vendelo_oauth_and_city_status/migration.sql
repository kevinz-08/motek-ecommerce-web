-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryAttempts" INTEGER,
ADD COLUMN     "trackingStatus" TEXT,
ADD COLUMN     "trackingUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VendeloCity" ADD COLUMN     "serviceStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "serviceUnavailableMessage" TEXT,
ADD COLUMN     "subdivisionName" TEXT;

-- CreateTable
CREATE TABLE "VendeloCredential" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "refreshTokenEnc" TEXT NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "accessTokenEnc" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "refreshLeaseHolder" TEXT,
    "refreshLeaseUntil" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendeloCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_vendeloOrderId_idx" ON "Order"("vendeloOrderId");
