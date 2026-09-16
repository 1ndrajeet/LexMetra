-- CreateTable
CREATE TABLE "ExtractedProduct" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "productName" TEXT,
    "brand" TEXT,
    "manufacturer" TEXT,
    "manufacturerAddress" TEXT,
    "importer" TEXT,
    "mrp" TEXT,
    "mrpCurrency" TEXT DEFAULT 'INR',
    "netQuantity" TEXT,
    "netQuantityUnit" TEXT,
    "batchNumber" TEXT,
    "manufacturingDate" TEXT,
    "expiryDate" TEXT,
    "fssaiLicense" TEXT,
    "ingredients" TEXT,
    "nutritionalInfo" TEXT,
    "usageInstructions" TEXT,
    "storageInstructions" TEXT,
    "countryOfOrigin" TEXT,
    "productCode" TEXT,
    "website" TEXT,
    "customerCare" TEXT,
    "rawTextUsed" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "extractionStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL,
    "extractedProductId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldValue" TEXT,
    "confidence" DOUBLE PRECISION,
    "sourceText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedField_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExtractedProduct" ADD CONSTRAINT "ExtractedProduct_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_extractedProductId_fkey" FOREIGN KEY ("extractedProductId") REFERENCES "ExtractedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
