from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from rapidocr_onnxruntime import RapidOCR
from openai import OpenAI
from dotenv import load_dotenv
import fitz  # PyMuPDF
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import networkx as nx
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
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

DB = {}
ocr = None
api_key = os.getenv("DEEPSEEK_API_KEY")
llm_client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com") if api_key else None

# ==========================================
# 2. 核心工具函数
# ==========================================
def extract_pages(path: str):
    """解析 PDF，支持扫描件 OCR"""
    global ocr
    doc = fitz.open(path)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text("text")
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
    """
    智能检索：
    1. 如果论文短（< 40000 字符），直接返回带页码标记的全文，大模型自己看，解决一切中英混合问题。
    2. 如果超长，走分词打分检索。
    """
    # 构建带页码的全文
    page_texts = [f"[第{p['page']}页]\n{p['text']}" for p in paper["pages"]]
    full_text_with_pages = "\n\n".join(page_texts)
    
    if len(full_text_with_pages) < 40000:
        return [{"page": 1, "quote": full_text_with_pages}]
    
    # 超长文档分块检索
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
        scored_chunks.append((kw_score * 0.6 + sem_score * 0.4, ch))
        
    scored_chunks.sort(key=lambda x: -x[0])
    hits = [ch for score, ch in scored_chunks[:top_k] if score > 0]
    
    # 兜底：如果没匹配到，给前几页
    if not hits and chunks:
        hits = chunks[:5]
    return hits

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
        with open(path, "wb") as f:
            f.write(await file.read())
        pages = extract_pages(path)
        full_text = "\n".join(p["text"] for p in pages)

        duplicates = []
        for old_id, old_paper in DB.items():
            ratio = difflib.SequenceMatcher(None, full_text[:5000], old_paper["full_text"][:5000]).ratio()
            if ratio > 0.82:
                duplicates.append({
                    "paper_id": old_id, "filename": old_paper["filename"],
                    "similarity": round(ratio, 3), "suggestion": "库中已有此论文，建议保留现有版本"
                })

        DB[pid] = {"pid": pid, "filename": file.filename, "pages": pages, "full_text": full_text}
        return {"paper_id": pid, "filename": file.filename, "page_count": len(pages), "duplicates": duplicates}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/qa/stream")
async def qa_stream(payload: dict):
    pid = payload.get("paper_id")
    question = payload.get("question")
    paper = DB.get(pid)
    if not paper or not llm_client:
        raise HTTPException(status_code=404, detail="论文不存在或未配置大模型")

    async def generate():
        yield f"data: {json.dumps({'agent': '检索证据', 'status': 'running'})}\n\n"
        hits = retrieve_context(paper, question)
        await asyncio.sleep(0.3)
        
        # 如果只有一段且是全文，不在界面展示巨大的来源文本
        display_sources = [{"page": h["page"], "quote": h["quote"][:200]+"..."} for h in hits if h["quote"] != paper["full_text"]]
        if not display_sources and hits:
            display_sources = [{"page": "全文", "quote": "已通读全文进行回答"}]
            
        yield f"data: {json.dumps({'agent': '检索证据', 'status': 'done', 'sources': display_sources})}\n\n"
        yield f"data: {json.dumps({'agent': '生成回答', 'status': 'running'})}\n\n"

        context = "\n\n".join(h["quote"] for h in hits)
        prompt = f"""你是一个严谨的学术助手。请仔细阅读以下文献内容，并根据内容回答问题。
要求：
1. 必须基于提供的文献内容回答，不能编造。
2. 如果确实找不到答案，请回答“未在文献中找到明确依据”。
3. 必须在回答中标注页码，格式为 [第X页]。

文献内容：
{context}

问题：{question}
"""
        try:
            response = llm_client.chat.completions.create(
                model="deepseek-chat", messages=[{"role": "user", "content": prompt}],
                temperature=0, stream=True
            )
            for chunk in response:
                if chunk.choices[0].delta.content:
                    yield f"data: {json.dumps({'agent': '生成回答', 'text': chunk.choices[0].delta.content})}\n\n"
            yield f"data: {json.dumps({'agent': '生成回答', 'status': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'agent': '生成回答', 'status': 'error', 'text': f'失败: {str(e)}'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@app.post("/api/translate")
def translate_text(payload: dict):
    text = payload.get("text", "")
    if not text or not llm_client: return {"translation": ""}
    try:
        resp = llm_client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": f"翻译成中文，保留公式和代码：\n\n{text[:3500]}"}],
            temperature=0,
        )
        return {"translation": resp.choices[0].message.content}
    except Exception as e:
        return {"translation": f"翻译失败: {str(e)}"}

@app.post("/api/graph/build")
def build_graph():
    G = nx.DiGraph()
    titles = {pid: DB[pid]["filename"].replace(".pdf", "") for pid in DB}
    for pid in titles: G.add_node(pid, label=titles[pid])
    edges = []
    for pid, paper in DB.items():
        for other, title in titles.items():
            if other != pid and title.lower()[:15] in paper["full_text"].lower():
                G.add_edge(pid, other)
                edges.append({"source": pid, "target": other})
    try: pr = nx.pagerank(G)
    except: pr = {n: 0 for n in G.nodes}
    nodes = [{"id": n, "name": titles[n], "size": 20 + pr.get(n, 0) * 800} for n in G.nodes]
    return {"nodes": nodes, "edges": edges}

# ==========================================
# 4. 阶段4：CSV 图表与写作
# ==========================================
@app.post("/api/csv/plot")
async def csv_plot(file: UploadFile = File(...)):
    try:
        df = pd.read_csv(file.file)
        name = f"chart_{uuid.uuid4().hex[:6]}.png"
        path = os.path.join(UPLOAD_DIR, name)
        
        fig, ax = plt.subplots(figsize=(6, 4))
        if len(df.columns) >= 2:
            df.plot(x=df.columns[0], y=df.columns[1], kind="bar", ax=ax, color="#2563eb")
        ax.set_title("Auto Generated Chart")
        plt.tight_layout(); fig.savefig(path, dpi=150); plt.close(fig)

        desc = df.head(5).to_string()
        cap = llm_client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": f"写一句英文学术Figure Caption，说明核心趋势：\n{desc}"}],
            temperature=0.3,
        ).choices[0].message.content
        return {"image_url": f"http://127.0.0.1:8000/uploads/{name}", "caption": cap}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/write/framework")
def write_framework(payload: dict):
    idea = payload.get("idea", "")
    titles = [{"id": pid, "title": DB[pid]["filename"].replace(".pdf", "")} for pid in DB]
    prompt = f"""根据想法“{idea}”写论文框架，包含Abstract、Introduction、Related Work。
Related Work里只能引用下面列表中的论文，用[CITE:论文id]标注。禁止编造列表外文献。
列表：{titles}
"""
    try:
        resp = llm_client.chat.completions.create(
            model="deepseek-chat", messages=[{"role": "user", "content": prompt}], temperature=0.4
        )
        text = resp.choices[0].message.content
        for t in titles:
            text = text.replace(f"[CITE:{t['id']}]", f"[{t['title']}]")
        return {"framework": text}
    except Exception as e:
        return {"framework": f"生成失败: {str(e)}"}

@app.post("/api/futurework")
def get_futurework():
    results = []
    for pid, paper in DB.items():
        text = paper["full_text"]
        sentences = re.split(r"[.!?]\s+", text)
        fw = [s.strip() for s in sentences if any(w in s.lower() for w in ["future work", "future research", "we plan", "further study"])]
        if fw:
            results.append({"paper_id": pid, "filename": paper["filename"], "future_work": fw[:3]})
    return {"items": results}
@app.post("/api/agent/chat")
async def agent_chat(payload: dict):
    user_input = payload.get("message", "")
    if not llm_client: raise HTTPException(500, "未配置模型")

    async def generate():
        yield f"data: {json.dumps({'type': 'thought', 'content': '正在分析您的意图并拆解任务...'})}\n\n"
        await asyncio.sleep(0.5)

        tools_desc = """
        你是一个科研 Agent，可以调用以下工具：
        1. [SEARCH_LIBRARY]: 检索本地文献库。
        2. [GENERATE_FRAMEWORK]: 根据Idea生成论文框架。
        请输出 JSON 格式决策：{"tool": "工具名", "args": "参数"}
        如果无需工具，输出：{"tool": "DIRECT", "args": "直接回答内容"}
        """
        try:
            res = llm_client.chat.completions.create(
                model="deepseek-chat", 
                messages=[{"role": "system", "content": tools_desc}, {"role": "user", "content": user_input}], 
                temperature=0
            )
            action = json.loads(res.choices[0].message.content.strip().replace("```json","").replace("```",""))
            tool, args = action.get("tool"), action.get("args")
            
            yield f"data: {json.dumps({'type': 'action', 'content': f'决定调用工具：{tool}'})}\n\n"
            await asyncio.sleep(0.5)

            observation = ""
            if tool == "SEARCH_LIBRARY":
                papers = list_papers()
                observation = f"检索到 {len(papers)} 篇文献：{papers}"
            elif tool == "GENERATE_FRAMEWORK":
                observation = "框架已生成，包含 Abstract, Introduction 等结构。"
            else:
                observation = args

            yield f"data: {json.dumps({'type': 'observation', 'content': observation})}\n\n"
            yield f"data: {json.dumps({'type': 'final', 'content': '正在整理最终回复...'})}\n\n"
            
            final_prompt = f"用户问题：{user_input}\n观察结果：{observation}\n请输出最终回复。"
            final_res = llm_client.chat.completions.create(model="deepseek-chat", messages=[{"role": "user", "content": final_prompt}], stream=True)
            for chunk in final_res:
                if chunk.choices[0].delta.content:
                    yield f"data: {json.dumps({'type': 'text', 'content': chunk.choices[0].delta.content})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
@app.post("/api/qa/compare")
async def qa_compare(payload: dict):
    paper_ids = payload.get("paper_ids", [])
    question = payload.get("question", "")
    
    if len(paper_ids) < 2 or not llm_client:
        raise HTTPException(400, "至少选择两篇论文，或未配置大模型")

    async def generate():
        yield f"data: {json.dumps({'agent': '正在调取文献', 'status': 'running'})}\n\n"
        
        contexts = []
        for pid in paper_ids:
            if pid in DB:
                paper = DB[pid]
                contexts.append(f"【文献: {paper['filename']}】\n{paper['full_text'][:15000]}")
        
                await asyncio.sleep(0.5)
        # 👇 加上这一行：告诉前端文献调取完毕
        yield f"data: {json.dumps({'agent': '正在调取文献', 'status': 'done'})}\n\n"
        
        yield f"data: {json.dumps({'agent': '正在生成对比分析', 'status': 'running'})}\n\n"

        combined_context = "\n\n".join(contexts)
        
        # ... (中间的 prompt 定义和 llm_client 调用保持不变) ...
        prompt = f"""你是一个专业的学术研究助手，现在需要对比分析以下多篇文献。
        
文献内容如下：
{combined_context}

用户的问题/对比要求是：{question}

请严格遵守以下要求：
1. 提取各篇文献的核心观点进行横向对比。
2. 必须客观，如果文献中找不到对应信息，明确指出“文献未提及”。
3. 按照主题或维度进行结构化对比，不要长篇大论。
"""
                # 👇 加上这一行：告诉前端对比分析生成完毕，准备输出文字
        yield f"data: {json.dumps({'agent': '正在生成对比分析', 'status': 'done'})}\n\n"
        try:
            res = llm_client.chat.completions.create(
                model="deepseek-chat", 
                messages=[{"role": "user", "content": prompt}], 
                stream=True
            )
            for chunk in res:
                if chunk.choices[0].delta.content:
                    yield f"data: {json.dumps({'agent': '生成对比结果', 'text': chunk.choices[0].delta.content})}\n\n"
            yield f"data: {json.dumps({'agent': '生成对比结果', 'status': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'agent': '生成对比结果', 'status': 'error', 'text': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")