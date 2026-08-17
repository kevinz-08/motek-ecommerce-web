-- AlterTable
ALTER TABLE "Order" DROP COLUMN "shippingCod",
ADD COLUMN     "shippingTotal" INTEGER NOT NULL DEFAULT 0;

-- El toggle SHIPPING_ONLINE_ENABLED cambia de significado (antes: modo híbrido
-- de flete contraentrega, ya eliminado; ahora: sumar el flete al cobro online).
-- Se borra cualquier fila existente para que el default seguro (desactivado)
-- aplique en todos los ambientes tras el deploy, sin cobrar flete de sorpresa.
DELETE FROM "Settings" WHERE "key" = 'SHIPPING_ONLINE_ENABLED';
