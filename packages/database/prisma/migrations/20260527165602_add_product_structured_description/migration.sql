-- CreateTable
CREATE TABLE "ProductDescription" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "generalDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBenefit" (
    "id" TEXT NOT NULL,
    "descriptionId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductBenefit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductDescription_productId_key" ON "ProductDescription"("productId");

-- CreateIndex
CREATE INDEX "ProductDescription_productId_idx" ON "ProductDescription"("productId");

-- CreateIndex
CREATE INDEX "ProductBenefit_descriptionId_order_idx" ON "ProductBenefit"("descriptionId", "order");

-- AddForeignKey
ALTER TABLE "ProductDescription" ADD CONSTRAINT "ProductDescription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBenefit" ADD CONSTRAINT "ProductBenefit_descriptionId_fkey" FOREIGN KEY ("descriptionId") REFERENCES "ProductDescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
