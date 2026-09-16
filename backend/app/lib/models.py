# backend/app/lib/models.py
"""
Database models for LEXMETRA.
Mapped from Prisma schema to SQLAlchemy ORM.
"""
from sqlalchemy import Column, String, Float, DateTime, Text, Integer, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.lib.db import Base


def generate_uuid():
    """Generate a UUID string."""
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
    verdict = Column(String, default="PENDING")
    score = Column(Float, nullable=True)
    status = Column(String, default="processing")
    createdAt = Column(DateTime, default=datetime.utcnow)
    completedAt = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="inspections")
    images = relationship("Image", back_populates="inspection", cascade="all, delete-orphan")
    declarations = relationship("Declaration", back_populates="inspection", cascade="all, delete-orphan")
    ruleResults = relationship("RuleResult", back_populates="inspection", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="inspection", cascade="all, delete-orphan")
    extractedProducts = relationship("ExtractedProduct", back_populates="inspection", cascade="all, delete-orphan")


class Image(Base):
    __tablename__ = "Image"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    inspectionId = Column(String, ForeignKey("Inspection.id", ondelete="CASCADE"), nullable=False)
    url = Column(Text, nullable=False)
    orderNum = Column(Integer, nullable=False)
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
    status = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    
    inspection = relationship("Inspection", back_populates="ruleResults")
    declaration = relationship("Declaration", back_populates="ruleResults")


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
# EXTRACTED PRODUCT DATA (Gemini Extraction)
# ============================================================

class ExtractedProduct(Base):
    __tablename__ = "ExtractedProduct"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    inspectionId = Column(String, ForeignKey("Inspection.id", ondelete="CASCADE"), nullable=False)
    
    # Product fields
    productName = Column(String, nullable=True)
    brand = Column(String, nullable=True)
    manufacturer = Column(String, nullable=True)
    manufacturerAddress = Column(Text, nullable=True)
    importer = Column(String, nullable=True)
    
    # Regulatory fields
    mrp = Column(String, nullable=True)
    mrpCurrency = Column(String, default="INR")
    netQuantity = Column(String, nullable=True)
    netQuantityUnit = Column(String, nullable=True)
    batchNumber = Column(String, nullable=True)
    manufacturingDate = Column(String, nullable=True)
    expiryDate = Column(String, nullable=True)
    fssaiLicense = Column(String, nullable=True)
    
    # Additional fields
    ingredients = Column(Text, nullable=True)
    nutritionalInfo = Column(Text, nullable=True)
    usageInstructions = Column(Text, nullable=True)
    storageInstructions = Column(Text, nullable=True)
    countryOfOrigin = Column(String, nullable=True)
    productCode = Column(String, nullable=True)
    website = Column(String, nullable=True)
    customerCare = Column(String, nullable=True)
    
    # Metadata
    rawTextUsed = Column(Text, nullable=True)
    confidenceScore = Column(Float, nullable=True)
    extractionStatus = Column(String, default="pending")
    
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    inspection = relationship("Inspection", back_populates="extractedProducts")
    extractedFields = relationship("ExtractedField", back_populates="extractedProduct", cascade="all, delete-orphan")


class ExtractedField(Base):
    __tablename__ = "ExtractedField"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    extractedProductId = Column(String, ForeignKey("ExtractedProduct.id", ondelete="CASCADE"), nullable=False)
    
    fieldName = Column(String, nullable=False)
    fieldValue = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    sourceText = Column(Text, nullable=True)
    
    createdAt = Column(DateTime, default=datetime.utcnow)
    
    extractedProduct = relationship("ExtractedProduct", back_populates="extractedFields")