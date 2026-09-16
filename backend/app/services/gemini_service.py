# backend/app/services/gemini_service.py
"""
Gemini service for structured data extraction from OCR text.
Using the new google-genai package.
"""
import os
import json
import logging
from typing import Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

# Try new package first, fallback to old
try:
    from google import genai
    from google.genai import types
    USE_NEW_PACKAGE = True
except ImportError:
    USE_NEW_PACKAGE = False
    import google.generativeai as genai_old

logger = logging.getLogger(__name__)

API_KEY = os.getenv("GEMINI_API_KEY")
client = None

if API_KEY:
    if USE_NEW_PACKAGE:
        client = genai.Client(api_key=API_KEY)
        logger.info("Using new google-genai package")
    else:
        genai_old.configure(api_key=API_KEY)
        client = genai_old.GenerativeModel('gemini-3.8-flash')
        logger.info("Using legacy google-generativeai package")
else:
    logger.warning("GEMINI_API_KEY not set")


class GeminiService:
    """Service for extracting structured product data using Gemini."""
    
    EXTRACTION_PROMPT = """
You are a product label extraction expert. Extract the following information from the product label text.

Return ONLY valid JSON. If a field is not found, use null.

FIELDS TO EXTRACT:
1. product_name: Full product name
2. brand: Brand name
3. manufacturer: Manufacturer name
4. manufacturer_address: Complete manufacturer address
5. importer: Importer name (if different from manufacturer)
6. country_of_origin: Country where product was made
7. mrp: Maximum Retail Price (extract as number only, e.g., 149)
8. mrp_currency: Currency (INR, USD, etc.)
9. net_quantity: Net quantity with unit (e.g., "500g", "1L")
10. net_quantity_unit: Unit of measurement (g, kg, ml, L, etc.)
11. batch_number: Batch or lot number
12. manufacturing_date: Date of manufacture (standardize to YYYY-MM-DD)
13. expiry_date: Expiry or best before date (standardize to YYYY-MM-DD)
14. fssai_license: FSSAI license number
15. ingredients: List of ingredients as a string
16. nutritional_info: Nutritional information
17. usage_instructions: How to use
18. storage_instructions: How to store
19. product_code: Any product code or SKU
20. website: Website URL if present
21. customer_care: Customer care number or email

TEXT FROM PRODUCT LABEL:
{text}

Output JSON:
"""
    
    @classmethod
    def extract_structured_data(cls, text: str) -> Dict[str, Any]:
        """Extract structured product data from OCR text."""
        if not client:
            return {"success": False, "error": "Gemini API not configured", "data": {}}
        
        if not text or len(text.strip()) < 10:
            return {"success": False, "error": "Text too short for extraction", "data": {}}
        
        try:
            if len(text) > 100000:
                text = text[:100000] + "... (truncated)"
            
            prompt = cls.EXTRACTION_PROMPT.format(text=text)
            
            # Use appropriate client
            if USE_NEW_PACKAGE:
                response = client.models.generate_content(
                    model="gemini-3.8-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        max_output_tokens=8192,
                    )
                )
                response_text = response.text
            else:
                response = client.generate_content(prompt)
                response_text = response.text
            
            # Parse JSON
            response_text = response_text.strip()
            
            # Handle markdown code blocks
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            data = json.loads(response_text)
            
            return {"success": True, "data": data, "error": None}
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response: {e}")
            return {
                "success": False,
                "error": "Failed to parse extraction result",
                "data": {},
                "raw_response": response_text[:500] if 'response_text' in locals() else None
            }
        except Exception as e:
            logger.error(f"Gemini extraction failed: {e}")
            return {"success": False, "error": str(e), "data": {}}
    
    @classmethod
    def standardize_data(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """Standardize and clean extracted data."""
        standardized = {}
        
        # Standardize dates
        for date_field in ['manufacturing_date', 'expiry_date']:
            if data.get(date_field):
                standardized[date_field] = cls._standardize_date(data[date_field])
            else:
                standardized[date_field] = None
        
        # Standardize price
        if data.get('mrp'):
            standardized['mrp'] = cls._standardize_price(data['mrp'])
        else:
            standardized['mrp'] = None
        
        # Copy other fields with correct mapping
        field_mapping = {
            'product_name': 'productName',
            'brand': 'brand',
            'manufacturer': 'manufacturer',
            'manufacturer_address': 'manufacturerAddress',
            'importer': 'importer',
            'mrp_currency': 'mrpCurrency',
            'net_quantity': 'netQuantity',
            'net_quantity_unit': 'netQuantityUnit',
            'batch_number': 'batchNumber',
            'manufacturing_date': 'manufacturingDate',
            'expiry_date': 'expiryDate',
            'fssai_license': 'fssaiLicense',
            'ingredients': 'ingredients',
            'nutritional_info': 'nutritionalInfo',
            'usage_instructions': 'usageInstructions',
            'storage_instructions': 'storageInstructions',
            'country_of_origin': 'countryOfOrigin',
            'product_code': 'productCode',
            'website': 'website',
            'customer_care': 'customerCare'
        }
        
        for key, value in data.items():
            if key in field_mapping:
                standardized[field_mapping[key]] = value
            elif key not in ['manufacturing_date', 'expiry_date', 'mrp']:
                standardized[key] = value
        
        return standardized
    
    @classmethod
    def _standardize_date(cls, date_str: str) -> Optional[str]:
        """Standardize date to YYYY-MM-DD format."""
        if not date_str:
            return None
        
        date_str = date_str.strip()
        import re
        
        patterns = [
            r'(\d{2})[-/.](\d{2})[-/.](\d{4})',
            r'(\d{2})[-/.](\d{2})[-/.](\d{2})',
            r'(\d{4})[-/.](\d{2})[-/.](\d{2})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, date_str)
            if match:
                groups = match.groups()
                if len(groups) == 3:
                    if len(groups[0]) == 4:
                        return f"{groups[0]}-{groups[1]}-{groups[2]}"
                    elif len(groups[2]) == 4:
                        return f"{groups[2]}-{groups[1]}-{groups[0]}"
                    else:
                        year = int(groups[2])
                        if year < 50:
                            year += 2000
                        else:
                            year += 1900
                        return f"{year}-{groups[1]}-{groups[0]}"
        
        return date_str
    
    @classmethod
    def _standardize_price(cls, price_str: str) -> Optional[str]:
        """Extract numeric price from string."""
        if not price_str:
            return None
        
        import re
        match = re.search(r'(\d+\.?\d*)', str(price_str))
        if match:
            return match.group(1)
        
        return str(price_str)