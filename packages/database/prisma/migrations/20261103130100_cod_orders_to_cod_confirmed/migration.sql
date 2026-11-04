-- Los pedidos contraentrega nacían PAID aunque el dinero no hubiera llegado.
UPDATE "Order" SET "status" = 'COD_CONFIRMED'
WHERE "paymentProvider" = 'COD' AND "status" = 'PAID';
