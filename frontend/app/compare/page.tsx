/* eslint-disable */
"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GitCompare, Send, Loader2, CheckCircle2 } from "lucide-react";

function CompareContent() {
  const searchParams = useSearchParams();
  const ids = searchParams.get("ids")?.split(",") || [];
  
  const [q, setQ] = useState("请对比这几篇论文的核心创新点，以及它们之间的演进关系或架构差异。");
  const [logs, setLogs] = useState<any[]>([]);
  const [ans, setAns] = useState("");
  const [running, setRunning] = useState(false);

  const handleCompare = async () => {
    if (!q || running || ids.length < 2) return;
    setRunning(true); setLogs([]); setAns("");
    
    try {
      const res = await fetch("/api/qa/compare", { 
        method: "POST", 
        headers: {"Content-Type": "application/json"}, 
        body: JSON.stringify({ paper_ids: ids, question: q }) 
      });
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
          }
        }
      }
    } catch (error) {
      console.error(error);
      alert("对比失败，请检查后端终端是否报错");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto h-screen flex flex-col bg-slate-50">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-900">
          <GitCompare className="w-8 h-8 text-indigo-600" /> 跨文献对比分析
        </h1>
        <p className="text-slate-500 mt-2">已选中 {ids.length} 篇文献，Agent 将综合提取信息并进行横向对比。</p>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-4 overflow-auto flex flex-col gap-4">
        {/* 这里的逻辑已经换成了 CheckCircle2 替代 Bot */}
        {logs.map((l, i) => (
          <div key={i} className="flex gap-3 text-sm text-slate-600 items-center">
            {l.status === 'running' ? (
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )} 
            {l.agent}
          </div>
        ))}
        
        {ans && (
          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl mt-2 shadow-sm">
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{ans}</p>
          </div>
        )}
        {!ans && logs.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            输入对比问题，Agent 将开始阅读多篇文献...
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <input 
          value={q} 
          onChange={e => setQ(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && handleCompare()}
          disabled={running}
          className="flex-1 border border-slate-300 p-4 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-sm" 
          placeholder="例如：对比这几篇论文的架构差异..." 
        />
        <button onClick={handleCompare} disabled={running} className="bg-indigo-600 text-white px-8 py-4 rounded-xl hover:bg-indigo-700 transition shadow-sm flex items-center gap-2 font-medium">
          {running ? "推理中..." : "开始对比"} <Send className="w-5 h-5"/>
        </button>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-10 flex justify-center text-slate-500">加载对比工作台...</div>}>
      <CompareContent />
    </Suspense>
  );
}