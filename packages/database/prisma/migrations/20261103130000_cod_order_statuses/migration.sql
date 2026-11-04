-- Estados exclusivos de contraentrega (COD). Postgres no permite usar un valor
-- recién agregado al enum en la misma transacción: el backfill va en la
-- migración siguiente.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'AWAITING_DEPOSIT';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'COD_CONFIRMED';
