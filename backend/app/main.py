from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from rapidocr_onnxruntime import RapidOCR
from openai import OpenAI
from dotenv import load_dotenv
import fitz  # PyMuPDF
import os
import uuid
import difflib
import re
import json
import asyncio
import traceback

# ==========================================
# 1. 初始化与环境配置
# ==========================================
load_dotenv()

app = FastAPI(title="研途助手 API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

DB = {}

# 延迟加载 OCR，防止一启动就占满内存
ocr = None

api_key = os.getenv("DEEPSEEK_API_KEY")
llm_client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com") if api_key else None

# ==========================================
# 2. 核心工具函数
# ==========================================
def extract_pages(path: str):
    global ocr
    doc = fitz.open(path)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text("text")
        
        # 如果文本太少，走 OCR
        if len(text.strip()) < 50:
            if ocr is None:
                print("首次加载 OCR 引擎...")
                ocr = RapidOCR()
                
            pix = page.get_pixmap(dpi=150)
            img_path = os.path.join(UPLOAD_DIR, f"tmp_{uuid.uuid4().hex[:6]}.png")
            pix.save(img_path)
            try:
                result, _ = ocr(img_path)
                text = "\n".join(r[1] for r in result) if result else ""
            except Exception as e:
                print(f"OCR 失败: {e}")
            finally:
                if os.path.exists(img_path):
                    os.remove(img_path)
                    
        pages.append({"page": i + 1, "text": text})
    return pages

def retrieve_context(paper: dict, question: str, top_k=5):
    chunks = []
    for p in paper["pages"]:
        for para in p["text"].split("\n"):
            if len(para.strip()) > 30:
                chunks.append({"page": p["page"], "quote": para.strip()})
    
    q_tokens = set(re.findall(r"[a-zA-Z0-9_]+", question.lower()))
    scored_chunks = []
    
    for ch in chunks:
        text = ch["quote"].lower()
        kw_score = sum(1 for t in q_tokens if t in text)
        text_tokens = set(re.findall(r"[a-zA-Z0-9_]+", text))
        sem_score = len(q_tokens & text_tokens) / max(len(q_tokens), 1)
        total_score = kw_score * 0.6 + sem_score * 0.4
        scored_chunks.append((total_score, ch))
        
    scored_chunks.sort(key=lambda x: -x[0])
    return [ch for score, ch in scored_chunks[:top_k] if score > 0]

# ==========================================
# 3. API 接口
# ==========================================
@app.get("/api/health")
def health():
    return {"status": "ok", "llm_ready": bool(api_key)}

@app.get("/api/papers")
def list_papers():
    return [{"id": k, "filename": v["filename"], "page_count": len(v["pages"])} for k, v in DB.items()]

@app.get("/api/papers/{pid}")
def get_paper(pid: str):
    paper = DB.get(pid)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    return paper

@app.post("/api/papers/upload")
async def upload_paper(file: UploadFile = File(...)):
    pid = uuid.uuid4().hex[:8]
    path = os.path.join(UPLOAD_DIR, f"{pid}.pdf")
    
    try:
        # 1. 保存文件
        with open(path, "wb") as f:
            f.write(await file.read())

        # 2. 解析文本
        pages = extract_pages(path)
        full_text = "\n".join(p["text"] for p in pages)

        # 3. 查重逻辑 (只取前 5000 字符，防止 CPU 卡死)
        duplicates = []
        for old_id, old_paper in DB.items():
            ratio = difflib.SequenceMatcher(None, full_text[:5000], old_paper["full_text"][:5000]).ratio()
            if ratio > 0.82:
                duplicates.append({
                    "paper_id": old_id,
                    "filename": old_paper["filename"],
                    "similarity": round(ratio, 3),
                    "suggestion": "库中已有此论文，建议保留现有版本"
                })

        # 4. 存库
        DB[pid] = {
            "pid": pid,
            "filename": file.filename,
            "pages": pages,
            "full_text": full_text
        }

        return {
            "paper_id": pid,
            "filename": file.filename,
            "page_count": len(pages),
            "duplicates": duplicates
        }

    except Exception as e:
        # 如果发生错误，打印错误堆栈到终端
        print("\n=== 上传解析报错 ===")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 如果因为去重被拒或者报错，应该清理无用文件（为了演示方便，这里暂时不清理）
        pass

@app.post("/api/qa/stream")
async def qa_stream(payload: dict):
    pid = payload.get("paper_id")
    question = payload.get("question")
    paper = DB.get(pid)
    
    if not paper or not llm_client:
        raise HTTPException(status_code=404, detail="论文不存在或未配置大模型密钥")

    async def generate():
        yield f"data: {json.dumps({'agent': '检索证据', 'status': 'running'})}\n\n"
        hits = retrieve_context(paper, question)
        await asyncio.sleep(0.5)
        yield f"data: {json.dumps({'agent': '检索证据', 'status': 'done', 'sources': hits})}\n\n"

        yield f"data: {json.dumps({'agent': '生成回答', 'status': 'running'})}\n\n"
        
        if not hits:
            yield f"data: {json.dumps({'agent': '生成回答', 'status': 'done'})}\n\n"
            yield f"data: {json.dumps({'agent': '生成回答', 'text': '未在文献中找到明确依据。'})}\n\n"
            return

        context = "\n\n".join(f"[第{h['page']}页]\n{h['quote']}" for h in hits)
        prompt = f"只根据片段回答，必须标注页码[第X页]，无证据则回答'未找到明确依据'。\n片段：{context}\n问题：{question}"
        
        try:
            response = llm_client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                stream=True
            )
            for chunk in response:
                if chunk.choices[0].delta.content:
                    text_piece = chunk.choices[0].delta.content
                    yield f"data: {json.dumps({'agent': '生成回答', 'text': text_piece})}\n\n"
            yield f"data: {json.dumps({'agent': '生成回答', 'status': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'agent': '生成回答', 'status': 'error', 'text': f'大模型调用失败: {str(e)}'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")