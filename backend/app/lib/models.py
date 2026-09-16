# backend/app/lib/models.py
"""
Database models for LEXMETRA.
Mirrors the Prisma schema — camelCase, because Postgres columns are camelCase.
"""
from sqlalchemy import (
    Column, String, Float, DateTime, Text, Integer, Boolean, JSON, ForeignKey,
)
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.lib.db import Base


def generate_uuid():
    return str(uuid.uuid4())


# ============================================================
# AUTH (Better Auth)
# ============================================================

class User(Base):
    __tablename__ = "User"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    password = Column(String, nullable=True)
    emailVerified = Column(Boolean, default=False)
    image = Column(String, nullable=True)
    role = Column(String, default="inspector")
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    inspections = relationship("Inspection", back_populates="user")
    reviews = relationship("Review", back_populates="user")


class Session(Base):
    __tablename__ = "Session"

    id = Column(String, primary_key=True, default=generate_uuid)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    expiresAt = Column(DateTime, nullable=False)
    ipAddress = Column(String, nullable=True)
    userAgent = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="sessions")


class Account(Base):
    __tablename__ = "Account"

    id = Column(String, primary_key=True, default=generate_uuid)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    accountId = Column(String, nullable=False)
    providerId = Column(String, nullable=False)
    providerType = Column(String, nullable=True)
    accessToken = Column(String, nullable=True)
    refreshToken = Column(String, nullable=True)
    idToken = Column(String, nullable=True)
    accessTokenExpiresAt = Column(DateTime, nullable=True)
    refreshTokenExpiresAt = Column(DateTime, nullable=True)
    scope = Column(String, nullable=True)
    password = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="accounts")


class Verification(Base):
    __tablename__ = "Verification"

    id = Column(String, primary_key=True, default=generate_uuid)
    identifier = Column(String, nullable=False)
    value = Column(String, nullable=False)
    expiresAt = Column(DateTime, nullable=False)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================
# CORE APP
# ============================================================

class Inspection(Base):
    __tablename__ = "Inspection"

    id = Column(String, primary_key=True, default=generate_uuid)
    userId = Column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True)
    productName = Column(String, nullable=True)
    saleType = Column(String, nullable=True, default="retail")
    productCategory = Column(String, nullable=True)
    verdict = Column(String, default="PENDING")
    score = Column(Float, nullable=True)
    status = Column(String, default="processing")
    createdAt = Column(DateTime, default=datetime.utcnow)
    completedAt = Column(DateTime, nullable=True)
    preClassification = Column(JSON, nullable=True)

    user = relationship("User", back_populates="inspections")
    images = relationship("Image", back_populates="inspection", cascade="all, delete-orphan")
    declarations = relationship("Declaration", back_populates="inspection", cascade="all, delete-orphan")
    ruleResults = relationship("RuleResult", back_populates="inspection", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="inspection", cascade="all, delete-orphan")
    extractedProducts = relationship("ExtractedProduct", back_populates="inspection", cascade="all, delete-orphan")
    verificationResults = relationship(
        "VerificationResult", back_populates="inspection", cascade="all, delete-orphan",
    )
    ruleEvaluation = relationship(
        "RuleEvaluation", back_populates="inspection",
        uselist=False, cascade="all, delete-orphan",
    )


class Image(Base):
    __tablename__ = "Image"

    id = Column(String, primary_key=True, default=generate_uuid)
    inspectionId = Column(String, ForeignKey("Inspection.id", ondelete="CASCADE"), nullable=False)
    url = Column(Text, nullable=False)
    orderNum = Column(Integer, nullable=False, default=0)
    createdAt = Column(DateTime, default=datetime.utcnow)

    inspection = relationship("Inspection", back_populates="images")
    declarations = relationship("Declaration", back_populates="sourceImage")


class Declaration(Base):
    __tablename__ = "Declaration"

    id = Column(String, primary_key=True, default=generate_uuid)
    inspectionId = Column(String, ForeignKey("Inspection.id", ondelete="CASCADE"), nullable=False)
    field = Column(String, nullable=False)
    value = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    status = Column(String, nullable=False)
    sourceImageId = Column(String, ForeignKey("Image.id", ondelete="SET NULL"), nullable=True)
    bbox = Column(JSON, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)

    inspection = relationship("Inspection", back_populates="declarations")
    sourceImage = relationship("Image", back_populates="declarations")
    ruleResults = relationship("RuleResult", back_populates="declaration", cascade="all, delete-orphan")


class RuleResult(Base):
    __tablename__ = "RuleResult"

    id = Column(String, primary_key=True, default=generate_uuid)
    inspectionId = Column(String, ForeignKey("Inspection.id", ondelete="CASCADE"), nullable=False)
    declarationId = Column(String, ForeignKey("Declaration.id", ondelete="SET NULL"), nullable=True)

    rule = Column(String, nullable=False)
    ruleReference = Column(String, nullable=True)
    title = Column(String, nullable=True)
    legalReference = Column(Text, nullable=True)
    status = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    severity = Column(String, nullable=True)
    reviewPolicy = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)

    inspection = relationship("Inspection", back_populates="ruleResults")
    declaration = relationship("Declaration", back_populates="ruleResults")


class RuleEvaluation(Base):
    __tablename__ = "RuleEvaluation"

    id = Column(String, primary_key=True, default=generate_uuid)
    inspectionId = Column(
        String,
        ForeignKey("Inspection.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    rulesetId = Column(String, nullable=True)
    rulesetVersion = Column(String, nullable=True)
    authority = Column(String, nullable=True)
    legalReference = Column(Text, nullable=True)
    overallStatus = Column(String, nullable=False)
    minConfidence = Column(Float, nullable=True)
    summary = Column(JSON, nullable=True)
    evaluatedAt = Column(DateTime, default=datetime.utcnow)

    inspection = relationship("Inspection", back_populates="ruleEvaluation")


class VerificationResult(Base):
    __tablename__ = "VerificationResult"

    id = Column(String, primary_key=True, default=generate_uuid)
    inspectionId = Column(String, ForeignKey("Inspection.id", ondelete="CASCADE"), nullable=False)

    authority = Column(String, nullable=False)
    status = Column(String, nullable=False)
    detail = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    raw = Column(JSON, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)

    inspection = relationship("Inspection", back_populates="verificationResults")


class Review(Base):
    __tablename__ = "Review"

    id = Column(String, primary_key=True, default=generate_uuid)
    inspectionId = Column(String, ForeignKey("Inspection.id", ondelete="CASCADE"), nullable=False)
    userId = Column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True)
    verdictOverride = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)

    inspection = relationship("Inspection", back_populates="reviews")
    user = relationship("User", back_populates="reviews")


# ============================================================
# EXTRACTED PRODUCT DATA
# ============================================================

class ExtractedProduct(Base):
    __tablename__ = "ExtractedProduct"

    id = Column(String, primary_key=True, default=generate_uuid)
    inspectionId = Column(String, ForeignKey("Inspection.id", ondelete="CASCADE"), nullable=False)

    # Identity
    productName = Column(String, nullable=True)
    brand = Column(String, nullable=True)
    genericName = Column(String, nullable=True)
    commonName = Column(String, nullable=True)

    # Classification
    productCategory = Column(String, nullable=True)
    productSubcategory = Column(String, nullable=True)
    commodityType = Column(String, nullable=True)
    commodityPhysicalState = Column(String, nullable=True)

    # Responsible parties
    manufacturer = Column(String, nullable=True)
    manufacturerAddress = Column(Text, nullable=True)
    packer = Column(String, nullable=True)
    packerAddress = Column(Text, nullable=True)
    importer = Column(String, nullable=True)
    importerAddress = Column(Text, nullable=True)
    countryOfOrigin = Column(String, nullable=True)

    # Price
    mrp = Column(Float, nullable=True)
    mrpCurrency = Column(String, default="INR")
    mrpRawText = Column(Text, nullable=True)

    # Quantity
    netQuantityValue = Column(Float, nullable=True)
    netQuantityUnit = Column(String, nullable=True)
    netQuantityRawText = Column(Text, nullable=True)

    # Dates
    batchNumber = Column(String, nullable=True)
    manufacturedDate = Column(String, nullable=True)
    packedDate = Column(String, nullable=True)
    importedDate = Column(String, nullable=True)
    expiryDate = Column(String, nullable=True)
    bestBeforeDate = Column(String, nullable=True)

    # Regulatory / content
    fssaiLicense = Column(String, nullable=True)
    ingredients = Column(Text, nullable=True)
    nutritionalInfo = Column(Text, nullable=True)
    storageInstructions = Column(Text, nullable=True)
    usageInstructions = Column(Text, nullable=True)

    # Consumer care
    customerCare = Column(Text, nullable=True)
    customerCarePhone = Column(String, nullable=True)
    customerCareEmail = Column(String, nullable=True)
    customerCareAddress = Column(Text, nullable=True)
    website = Column(String, nullable=True)
    productCode = Column(String, nullable=True)

    # Presentation
    declarationLanguage = Column(String, nullable=True)
    declarationOnPdp = Column(Boolean, nullable=True)

    # Dimensions
    finishedDimensions = Column(String, nullable=True)
    usableSheetsCount = Column(Integer, nullable=True)
    sheetDimensions = Column(String, nullable=True)

    # Metadata
    rawTextUsed = Column(Text, nullable=True)
    confidenceScore = Column(Float, nullable=True)
    extractionStatus = Column(String, default="pending")
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inspection = relationship("Inspection", back_populates="extractedProducts")
    extractedFields = relationship(
        "ExtractedField", back_populates="extractedProduct",
        cascade="all, delete-orphan",
    )


class ExtractedField(Base):
    __tablename__ = "ExtractedField"

    id = Column(String, primary_key=True, default=generate_uuid)
    extractedProductId = Column(
        String, ForeignKey("ExtractedProduct.id", ondelete="CASCADE"), nullable=False
    )

    fieldName = Column(String, nullable=False)
    fieldValue = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    sourceText = Column(Text, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)

    extractedProduct = relationship("ExtractedProduct", back_populates="extractedFields")