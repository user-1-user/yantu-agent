/* eslint-disable */
"use client";
import { useState, useEffect, useRef, use } from "react";
import { BookOpen, Languages, Send, Bot, CheckCircle2, Loader2, X } from "lucide-react";

export default function Reader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [paper, setPaper] = useState<any>(null);
  const [trans, setTrans] = useState<Record<number, string>>({});
  const [translating, setTranslating] = useState<number | null>(null);
  
  const [q, setQ] = useState("β1和β2设置是多少？");
  const [logs, setLogs] = useState<any[]>([]);
  const [ans, setAns] = useState("");
  const [sources, setSources] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  
  const [refModal, setRefModal] = useState<{ visible: boolean; content: string }>({ visible: false, content: "" });
  const syncLock = useRef(false);

  useEffect(() => {
    if (id) fetch(`/api/papers/${id}`).then(r => r.json()).then(setPaper);
  }, [id]);

  const syncScroll = (e: React.UIEvent<HTMLDivElement>, otherId: string) => {
    if (syncLock.current) return;
    syncLock.current = true;
    const other = document.getElementById(otherId);
    if (other) {
      const ratio = e.currentTarget.scrollTop / Math.max(e.currentTarget.scrollHeight - e.currentTarget.clientHeight, 1);
      other.scrollTop = ratio * (other.scrollHeight - other.clientHeight);
    }
    requestAnimationFrame(() => { syncLock.current = false; });
  };

  const handleTranslate = async (page: number, text: string) => {
    if (!localStorage.getItem("yantu_token")) {
      window.dispatchEvent(new Event("open-login-modal"));
      return;
    }

    setTranslating(page);
    try {
      const res = await fetch("/api/translate", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ text }) });
      const data = await res.json();
      setTrans(prev => ({ ...prev, [page]: data.translation }));
    } finally {
      setTranslating(null);
    }
  };

  const handleAsk = async () => {
    if (!q || running) return;
    if (!localStorage.getItem("yantu_token")) {
      window.dispatchEvent(new Event("open-login-modal"));
      return;
    }

    setRunning(true); setLogs([]); setAns(""); setSources([]);
    const res = await fetch("/api/qa/stream", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ paper_id: id, question: q }) });
    const reader = res.body?.getReader(); const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader!.read(); if (done) break;
      const lines = decoder.decode(value).split("\n\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          if (data.agent) {
            setLogs(prev => {
              const idx = prev.findIndex(l => l.agent === data.agent);
              if (idx >= 0) { const n = [...prev]; n[idx] = data; return n; } return [...prev, data];
            });
          }
          if (data.text) setAns(prev => prev + data.text);
          if (data.sources) setSources(data.sources);
        }
      }
    }
    setRunning(false);
  };

   const handleRefClick = (refNumber: string, fullText: string) => {
    const regex = new RegExp(`\\[${refNumber}\\]`, 'g');
    let match;
    let bestMatch = "";

    while ((match = regex.exec(fullText)) !== null) {
      const start = match.index;
      let excerpt = fullText.substring(start, start + 300).replace(/\n/g, ' ');
      
      if (excerpt.includes("点击") || excerpt.includes("跳转") || excerpt.includes("参考文献")) {
        continue; 
      }

      const cutIndex = excerpt.search(/并且还可以|1\.\d|翻译\(/);
      if (cutIndex > 0) {
        excerpt = excerpt.substring(0, cutIndex).trim();
      }

      if (/[a-zA-Z]{3,}/.test(excerpt)) {
        bestMatch = excerpt;
        break; 
      }
    }

    if (bestMatch) {
      setRefModal({ visible: true, content: bestMatch });
    } else {
      setRefModal({ visible: true, content: `未在正文解析文本中找到 [${refNumber}] 的详细英文条目，请参阅原文 PDF。` });
    }
  };

  const renderText = (text: string, fullText: string) => {
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, index) => {
      if (/^\[\d+\]$/.test(part)) {
        const num = part.replace(/[\[\]]/g, '');
        return (
          <button 
            key={index} 
            onClick={() => handleRefClick(num, fullText)}
            className="text-blue-600 hover:underline hover:bg-blue-50 px-1 rounded font-bold cursor-pointer transition-colors"
            title="点击查看参考文献"
          >
            {part}
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (!paper) return <div className="p-10 text-center text-slate-500">加载论文中...</div>;

  return (
    // 核心修复 1：h-screen 改为 h-full
    <div className="flex h-full bg-slate-50 p-4 gap-4 overflow-hidden relative">
      
      {/* 参考文献弹窗 */}
      {refModal.visible && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-lg w-full relative">
            <button onClick={() => setRefModal({ visible: false, content: "" })} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <X className="w-5 h-5"/>
            </button>
            <h3 className="font-bold text-lg mb-4 text-slate-800 border-b pb-2">参考文献详情</h3>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border">
              {refModal.content}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* 英文原文 */}
        {/* 核心修复 2：添加 h-full 和 overflow-hidden 限制外层高度 */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm h-full overflow-hidden">
          <div className="p-3 border-b font-bold text-sm text-slate-700 flex items-center gap-2 bg-slate-50/50 shrink-0"><BookOpen className="w-4 h-4 text-blue-500"/> 英文原文 (点击 [数字] 查看参考文献)</div>
          {/* 核心修复 3：滚动区添加 flex-1 min-h-0 */}
          <div id="left" onScroll={e => syncScroll(e, "right")} className="p-6 overflow-auto text-sm leading-loose text-slate-700 flex-1 min-h-0">
            {paper.pages?.map((p: any) => (
              <div key={p.page} className="mb-8">
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded mb-2 inline-block">第 {p.page} 页</span>
                <div className="whitespace-pre-wrap font-serif">
                  {renderText(p.text, paper.full_text)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 中文翻译 */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm h-full overflow-hidden">
          <div className="p-3 border-b font-bold text-sm text-slate-700 flex items-center gap-2 bg-slate-50/50 shrink-0"><Languages className="w-4 h-4 text-green-500"/> 中文翻译</div>
          <div id="right" onScroll={e => syncScroll(e, "left")} className="p-6 overflow-auto text-sm leading-loose text-slate-700 flex-1 min-h-0">
            {paper.pages?.map((p: any) => (
              <div key={p.page} className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">第 {p.page} 页</span>
                  <button onClick={() => handleTranslate(p.page, p.text)} disabled={translating === p.page} className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50 transition">
                    {translating === p.page ? "翻译中..." : trans[p.page] ? "重新翻译" : "翻译本页"}
                  </button>
                </div>
                <div className="whitespace-pre-wrap">{trans[p.page] || "（点击上方按钮翻译）"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧 Agent 问答 */}
      {/* 核心修复 4：添加 h-full 和 overflow-hidden */}
      <div className="w-[400px] bg-white rounded-xl border border-slate-200 flex flex-col shrink-0 shadow-sm h-full overflow-hidden">
        <div className="p-4 border-b font-bold flex items-center gap-2 bg-slate-50/50 text-slate-800 shrink-0">
          <Bot className="w-5 h-5 text-blue-600"/> Agent 问答与溯源
        </div>
        
        <div className="flex-1 p-4 overflow-auto space-y-4 min-h-0">
          {logs.map((l, i) => (
            <div key={i} className="flex gap-2 text-sm items-center text-slate-600">
              {l.status === 'running' ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin"/> : <CheckCircle2 className="w-4 h-4 text-green-500"/>} {l.agent}
            </div>
          ))}
          {ans && <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap">{ans}</div>}
          {sources.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">📚 原文溯源</p>
              {sources.map((s, i) => (
                <div key={i} className="text-xs bg-slate-50 p-3 rounded border-l-2 border-blue-400 mb-2">
                  <span className="font-bold text-slate-700 block mb-1">第 {s.page} 页</span>
                  <span className="text-slate-600">{s.quote}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex gap-2 bg-white shrink-0 rounded-b-xl">
          <input 
            value={q} 
            onChange={e => setQ(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleAsk()} 
            className="flex-1 border p-2 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition" 
            placeholder="向这篇论文提问..." 
          />
          <button onClick={handleAsk} disabled={running} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition">
            <Send className="w-5 h-5"/>
          </button>
        </div>
      </div>
    </div>
  );
}