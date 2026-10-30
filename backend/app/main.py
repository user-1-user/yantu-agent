from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import fitz, os, uuid, difflib
from rapidocr_onnxruntime import RapidOCR

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
DB = {}
ocr = RapidOCR()

def extract_pages(path):
    doc = fitz.open(path)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text("text")
        if len(text.strip()) < 50:  # 扫描件降级 OCR
            pix = page.get_pixmap(dpi=150)
            img = os.path.join(UPLOAD_DIR, f"tmp_{uuid.uuid4().hex[:6]}.png")
            pix.save(img)
            result, _ = ocr(img)
            text = "\n".join(r[1] for r in result) if result else ""
            os.remove(img)
        pages.append({"page": i + 1, "text": text})
    return pages

@app.post("/api/papers/upload")
async def upload(file: UploadFile = File(...)):
    pid = uuid.uuid4().hex[:8]
    path = os.path.join(UPLOAD_DIR, f"{pid}.pdf")
    with open(path, "wb") as f:
        f.write(await file.read())

    pages = extract_pages(path)
    full_text = "\n".join(p["text"] for p in pages)

    duplicates = []
    for old_id, old in DB.items():
        ratio = difflib.SequenceMatcher(None, full_text[:30000], old["full_text"][:30000]).ratio()
        if ratio > 0.82:
            duplicates.append({"paper_id": old_id, "filename": old["filename"], "similarity": round(ratio, 3)})

    DB[pid] = {"pid": pid, "filename": file.filename, "pages": pages, "full_text": full_text}
    return {"paper_id": pid, "filename": file.filename, "page_count": len(pages), "duplicates": duplicates}

@app.get("/api/papers")
def list_papers():
    return [{"id": k, "filename": v["filename"], "page_count": len(v["pages"])} for k, v in DB.items()]

@app.get("/api/papers/{pid}")
def get_paper(pid: str):
    return DB.get(pid, {"error": "not found"})