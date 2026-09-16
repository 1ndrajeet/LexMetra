/*
  Warnings:

  - You are about to drop the column `manufacturingDate` on the `ExtractedProduct` table. All the data in the column will be lost.
  - You are about to drop the column `netQuantity` on the `ExtractedProduct` table. All the data in the column will be lost.
  - The `mrp` column on the `ExtractedProduct` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ExtractedProduct" DROP COLUMN "manufacturingDate",
DROP COLUMN "netQuantity",
ADD COLUMN     "bestBeforeDate" TEXT,
ADD COLUMN     "commodityPhysicalState" TEXT,
ADD COLUMN     "commodityType" TEXT,
ADD COLUMN     "commonName" TEXT,
ADD COLUMN     "customerCareAddress" TEXT,
ADD COLUMN     "customerCareEmail" TEXT,
ADD COLUMN     "customerCarePhone" TEXT,
ADD COLUMN     "declarationLanguage" TEXT,
ADD COLUMN     "declarationOnPdp" BOOLEAN,
ADD COLUMN     "finishedDimensions" TEXT,
ADD COLUMN     "genericName" TEXT,
ADD COLUMN     "importedDate" TEXT,
ADD COLUMN     "importerAddress" TEXT,
ADD COLUMN     "manufacturedDate" TEXT,
ADD COLUMN     "mrpRawText" TEXT,
ADD COLUMN     "netQuantityRawText" TEXT,
ADD COLUMN     "netQuantityValue" DOUBLE PRECISION,
ADD COLUMN     "packedDate" TEXT,
ADD COLUMN     "packer" TEXT,
ADD COLUMN     "packerAddress" TEXT,
ADD COLUMN     "productCategory" TEXT,
ADD COLUMN     "productSubcategory" TEXT,
ADD COLUMN     "sheetDimensions" TEXT,
ADD COLUMN     "usableSheetsCount" INTEGER,
DROP COLUMN "mrp",
ADD COLUMN     "mrp" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "preClassification" JSONB,
ADD COLUMN     "productCategory" TEXT,
ADD COLUMN     "saleType" TEXT DEFAULT 'retail';

-- AlterTable
ALTER TABLE "RuleResult" ADD COLUMN     "legalReference" TEXT,
ADD COLUMN     "reviewPolicy" TEXT,
ADD COLUMN     "ruleReference" TEXT,
ADD COLUMN     "severity" TEXT,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "RuleEvaluation" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "rulesetId" TEXT,
    "rulesetVersion" TEXT,
    "authority" TEXT,
    "legalReference" TEXT,
    "overallStatus" TEXT NOT NULL,
    "minConfidence" DOUBLE PRECISION,
    "summary" JSONB,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationResult" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "confidence" DOUBLE PRECISION,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RuleEvaluation_inspectionId_key" ON "RuleEvaluation"("inspectionId");

-- CreateIndex
CREATE INDEX "RuleEvaluation_overallStatus_idx" ON "RuleEvaluation"("overallStatus");

-- CreateIndex
CREATE INDEX "VerificationResult_inspectionId_idx" ON "VerificationResult"("inspectionId");

-- CreateIndex
CREATE INDEX "VerificationResult_inspectionId_authority_idx" ON "VerificationResult"("inspectionId", "authority");

-- CreateIndex
CREATE INDEX "Declaration_inspectionId_idx" ON "Declaration"("inspectionId");

-- CreateIndex
CREATE INDEX "Declaration_field_idx" ON "Declaration"("field");

-- CreateIndex
CREATE INDEX "ExtractedField_extractedProductId_idx" ON "ExtractedField"("extractedProductId");

-- CreateIndex
CREATE INDEX "ExtractedProduct_inspectionId_idx" ON "ExtractedProduct"("inspectionId");

-- CreateIndex
CREATE INDEX "Image_inspectionId_idx" ON "Image"("inspectionId");

-- CreateIndex
CREATE INDEX "Inspection_verdict_idx" ON "Inspection"("verdict");

-- CreateIndex
CREATE INDEX "Inspection_status_idx" ON "Inspection"("status");

-- CreateIndex
CREATE INDEX "Inspection_createdAt_idx" ON "Inspection"("createdAt");

-- CreateIndex
CREATE INDEX "Review_inspectionId_idx" ON "Review"("inspectionId");

-- CreateIndex
CREATE INDEX "RuleResult_inspectionId_idx" ON "RuleResult"("inspectionId");

-- CreateIndex
CREATE INDEX "RuleResult_inspectionId_status_idx" ON "RuleResult"("inspectionId", "status");

-- CreateIndex
CREATE INDEX "RuleResult_inspectionId_severity_idx" ON "RuleResult"("inspectionId", "severity");

-- AddForeignKey
ALTER TABLE "RuleEvaluation" ADD CONSTRAINT "RuleEvaluation_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationResult" ADD CONSTRAINT "VerificationResult_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
