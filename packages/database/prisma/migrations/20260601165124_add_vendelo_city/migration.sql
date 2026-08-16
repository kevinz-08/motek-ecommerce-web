-- CreateTable
CREATE TABLE "VendeloCity" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdivisionCode" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'CO',

    CONSTRAINT "VendeloCity_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "VendeloCity_name_idx" ON "VendeloCity"("name");
