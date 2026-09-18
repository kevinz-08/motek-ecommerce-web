-- Guest checkout — fase EXPAND.
--
-- Solo agrega estructura nullable: es segura de aplicar con la versión anterior
-- del código todavía corriendo. El backfill y el endurecimiento (NOT NULL,
-- UNIQUE, CHECK) viven en las dos migraciones siguientes.

-- Order.userId pasa a nullable (un pedido de invitado no tiene User).
ALTER TABLE "Order" ALTER COLUMN "userId" DROP NOT NULL;

-- La FK pasa de obligatoria (ON DELETE RESTRICT) a opcional (ON DELETE SET NULL),
-- que es lo que Prisma genera para una relación opcional. Sin este recreate,
-- `prisma migrate diff` reportaría drift permanente.
ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Columnas nuevas. contactEmail y trackingToken quedan nullable en esta fase
-- porque las filas existentes todavía no tienen valor.
ALTER TABLE "Order"
  ADD COLUMN "guestId"       TEXT,
  ADD COLUMN "contactEmail"  TEXT,
  ADD COLUMN "trackingToken" TEXT;

-- CreateTable
CREATE TABLE "GuestCustomer" (
    "id"                 TEXT         NOT NULL,
    "email"              TEXT         NOT NULL,
    "name"               TEXT,
    "phone"              TEXT,
    "marketingConsent"   BOOLEAN      NOT NULL DEFAULT false,
    "marketingConsentAt" TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestCustomer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuestCustomer_email_idx" ON "GuestCustomer"("email");

ALTER TABLE "Order" ADD CONSTRAINT "Order_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "GuestCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
