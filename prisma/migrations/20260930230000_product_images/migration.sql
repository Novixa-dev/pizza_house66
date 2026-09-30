-- A photograph of a menu item, uploaded by the restaurant itself.
--
-- Bytes in the database rather than files on disk: the container filesystem
-- is ephemeral on this host, so an image written at runtime is gone at the
-- next deploy.

CREATE TABLE "ProductImage" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "version" TEXT NOT NULL,
  "originalName" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductImage_productId_key" ON "ProductImage"("productId");

ALTER TABLE "ProductImage"
  ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
