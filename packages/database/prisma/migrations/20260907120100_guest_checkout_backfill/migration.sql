-- Guest checkout — fase BACKFILL.
--
-- Rellena contactEmail y trackingToken en los pedidos históricos. Idempotente:
-- solo toca filas con valor NULL, así que re-ejecutarla no pisa datos.

-- contactEmail se toma del User dueño del pedido. Antes de esta migración
-- userId era NOT NULL, así que el join cubre el 100% de las filas.
UPDATE "Order" o
SET "contactEmail" = u."email"
FROM "User" u
WHERE u."id" = o."userId" AND o."contactEmail" IS NULL;

-- Red de seguridad: si alguna fila quedara sin email (dato inconsistente previo),
-- se marca con un dominio .invalid — reservado por RFC 2606, garantizado no
-- entregable. Evita que la migración de contract falle y evita mandar correo
-- por accidente a una dirección real.
UPDATE "Order"
SET "contactEmail" = 'sin-email@motek.invalid'
WHERE "contactEmail" IS NULL;

-- trackingToken: 64 caracteres hex a partir de dos UUIDv4 (~244 bits de entropía).
-- gen_random_uuid() es nativo desde PostgreSQL 13 — no requiere pgcrypto.
UPDATE "Order"
SET "trackingToken" = replace(gen_random_uuid()::text, '-', '')
                   || replace(gen_random_uuid()::text, '-', '')
WHERE "trackingToken" IS NULL;
