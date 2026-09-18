-- Guest checkout — fase CONTRACT.
--
-- ⚠️ Aplicar SOLO con el código nuevo ya desplegado. La versión anterior de la
-- app inserta pedidos sin contactEmail/trackingToken y fallaría contra estos
-- NOT NULL. Si se despliega todo junto, hay una ventana de segundos en la que
-- un pedido en vuelo puede fallar — aceptable, pero conviene saberlo.

ALTER TABLE "Order" ALTER COLUMN "contactEmail"  SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "trackingToken" SET NOT NULL;

CREATE UNIQUE INDEX "Order_trackingToken_key" ON "Order"("trackingToken");
CREATE INDEX "Order_contactEmail_createdAt_idx" ON "Order"("contactEmail", "createdAt");

-- Invariante que Prisma no sabe expresar: un pedido pertenece a un usuario
-- registrado O a un invitado, nunca a ambos ni a ninguno. Prisma no gestiona
-- constraints CHECK, así que no aparece en schema.prisma y tampoco genera drift.
ALTER TABLE "Order" ADD CONSTRAINT "order_owner_exclusive"
  CHECK (("userId" IS NULL) <> ("guestId" IS NULL));
