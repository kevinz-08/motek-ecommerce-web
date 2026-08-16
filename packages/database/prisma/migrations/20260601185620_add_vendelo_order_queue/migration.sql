-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "vendeloOrderId" TEXT;

-- CreateTable
CREATE TABLE "VendeloOrderQueue" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRetry" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendeloOrderQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendeloOrderQueue_status_nextRetry_idx" ON "VendeloOrderQueue"("status", "nextRetry");
