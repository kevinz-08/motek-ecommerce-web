-- Anticipo pre-envio de pedidos contraentrega (centavos COP).
ALTER TABLE "Order" ADD COLUMN "codDepositAmount" INTEGER NOT NULL DEFAULT 0;
