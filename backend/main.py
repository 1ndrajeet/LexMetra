from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI(title="Legal Metrology Compliance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok", "service": "Legal Metrology Compliance Platform"}

@app.get("/api/health")
def health():
    return {"status": "healthy"}

@app.post("/api/inspect")
async def inspect(
    image: UploadFile = File(...),
    product_name: str = Form(""),
    sale_type: str = Form("retail"),
    is_imported: bool = Form(False),
    net_quantity_grams_or_ml: float = Form(0)
):
    # Placeholder - full OCR + rules coming next
    return {
        "inspection_id": "demo-001",
        "product_name": product_name or "Unnamed",
        "overall_status": "PASS",
        "results": []
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)