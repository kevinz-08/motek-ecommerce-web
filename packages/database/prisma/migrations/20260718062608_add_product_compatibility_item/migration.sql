-- CreateTable
CREATE TABLE "ProductCompatibilityItem" (
    "id" TEXT NOT NULL,
    "descriptionId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductCompatibilityItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCompatibilityItem_descriptionId_order_idx" ON "ProductCompatibilityItem"("descriptionId", "order");

-- AddForeignKey
ALTER TABLE "ProductCompatibilityItem" ADD CONSTRAINT "ProductCompatibilityItem_descriptionId_fkey" FOREIGN KEY ("descriptionId") REFERENCES "ProductDescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
