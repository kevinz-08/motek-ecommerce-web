-- Precio ancla (compareAtPrice) + historial de precios (Fase 1 CRO)

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "compareAtPrice" INTEGER;

-- El precio de referencia siempre debe ser mayor al precio real de venta.
ALTER TABLE "Product" ADD CONSTRAINT "Product_compareAtPrice_gt_price"
  CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" > "price");

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "compareAtPriceAtPurchase" INTEGER;

-- CreateTable
CREATE TABLE "ProductPriceHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "compareAtPrice" INTEGER,
    "source" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPriceHistory_productId_changedAt_idx" ON "ProductPriceHistory"("productId", "changedAt");

-- AddForeignKey
ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Punto de partida del historial: precio vigente de cada producto existente.
INSERT INTO "ProductPriceHistory" ("id", "productId", "price", "compareAtPrice", "source")
SELECT 'pph_' || md5(random()::text || "id"), "id", "price", NULL, 'ADMIN_CREATE' FROM "Product";
