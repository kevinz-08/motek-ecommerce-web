-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "buyerBusinessName" TEXT,
ADD COLUMN     "buyerIdNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "buyerIdType" TEXT NOT NULL DEFAULT 'CC';
