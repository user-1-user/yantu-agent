"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, CheckCircle2, Loader2, BookOpen, Languages } from "lucide-react";

// ==========================================
// 核心业务组件（包含所有交互功能）
// ==========================================
function ReaderContent() {
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [paper, setPaper] = useState<any>(null);
  const [transMap, setTransMap] = useState<Record<number, string>>({});
  const [translating, setTranslating] = useState<number | null>(null);
  
  const [question, setQuestion] = useState("β1和β2设置是多少？");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [logs, setLogs] = useState<any[]>([]);
  const [answer, setAnswer] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sources, setSources] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const syncLock = useRef(false);

  // 获取论文详情
  useEffect(() => {
    if (!id) return;
    fetch(`/api/papers/${id}`)
      .then(r => r.json())
      .then(d => setPaper(d))
      .catch(e => console.error("获取论文失败", e));
  }, [id]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, answer]);

  // 双栏同步滚动
  const syncScroll = (src: HTMLElement, otherId: string) => {
    if (syncLock.current) return;
    syncLock.current = true;
    const other = document.getElementById(otherId);
    if (other) {
      const ratio = src.scrollTop / Math.max(src.scrollHeight - src.clientHeight, 1);
      other.scrollTop = ratio * (other.scrollHeight - other.clientHeight);
    }
    requestAnimationFrame(() => { syncLock.current = false; });
  };

  // 翻译单页
  const handleTranslate = async (page: number, text: string) => {
    setTranslating(page);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setTransMap(prev => ({ ...prev, [page]: data.translation }));
    } catch (error) {
      console.error("翻译失败", error);
    } finally {
      setTranslating(null);
    }
  };

  // 提问（流式）
  const handleAsk = async () => {
    if (!question.trim() || running || !id) return;
    setRunning(true);
    setLogs([]); 
    setAnswer(""); 
    setSources([]);

    try {
      const res = await fetch("/api/qa/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper_id: id, question }),
      });
      
      if (!res.ok) throw new Error("网络请求失败");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        const lines = decoder.decode(value).split("\n\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.agent) {
                setLogs((prev) => {
                  const newLogs = [...prev];
                  const idx = newLogs.findIndex(l => l.agent === data.agent);
                  if (idx >= 0) newLogs[idx] = { ...newLogs[idx], ...data };
                  else newLogs.push(data);
                  return newLogs;
                });
              }
              if (data.text) setAnswer(prev => prev + data.text);
              if (data.sources) setSources(data.sources);
            } catch (e) {
              console.error("解析流数据失败", e);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      alert("问答失败，请检查后端终端是否报错或 API Key 是否有效。");
    } finally {
      setRunning(false);
    }
  };

  if (!paper) return <div className="p-8 flex justify-center text-slate-500">正在加载论文数据...</div>;

  return (
    <div className="flex h-screen p-4 gap-4 bg-slate-50">
      
      {/* 左侧：双栏对照阅读 */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* 左 1：英文原文 */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="p-3 border-b bg-slate-50/80 font-semibold flex items-center gap-2 text-slate-700 text-sm">
            <BookOpen className="w-4 h-4 text-blue-500" /> 英文原文
          </div>
          <div id="leftPane" onScroll={e => syncScroll(e.currentTarget, "rightPane")} className="flex-1 overflow-auto p-4 scroll-smooth">
            {paper.pages?.map((p: { page: number; text: string }) => (
              <div key={p.page} className="mb-6">
                <Badge variant="secondary" className="mb-2 bg-slate-100">第 {p.page} 页</Badge>
                <p className="text-sm text-slate-700 leading-loose whitespace-pre-wrap font-serif">
                  {p.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 左 2：中文对照 */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="p-3 border-b bg-slate-50/80 font-semibold flex items-center gap-2 text-slate-700 text-sm">
            <Languages className="w-4 h-4 text-green-500" /> 中文对照
          </div>
          <div id="rightPane" onScroll={e => syncScroll(e.currentTarget, "leftPane")} className="flex-1 overflow-auto p-4 scroll-smooth">
            {paper.pages?.map((p: { page: number; text: string }) => (
              <div key={p.page} className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <Badge variant="secondary" className="bg-slate-100">第 {p.page} 页</Badge>
                  <Button size="sm" variant="outline" onClick={() => handleTranslate(p.page, p.text)} disabled={translating === p.page}>
                    {translating === p.page ? "翻译中..." : transMap[p.page] ? "重新翻译" : "翻译本页"}
                  </Button>
                </div>
                <p className="text-sm text-slate-700 leading-loose whitespace-pre-wrap">
                  {translating === p.page ? "正在调用大模型翻译..." : transMap[p.page] || "（点击上方按钮翻译）"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧：Agent 交互区 */}
      <div className="w-[400px] flex flex-col gap-4 shrink-0">
        <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-slate-200">
          <CardHeader className="border-b bg-slate-50/50 py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
              <Bot className="w-4 h-4 text-blue-600" /> Agent 执行轨迹
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-4 space-y-4" ref={scrollRef}>
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3">
                <div className="mt-1">
                  {log.status === "running" ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{log.agent}</p>
                  {log.status === "done" && log.agent === "检索证据" && <p className="text-xs text-slate-500 mt-1">找到 {log.sources?.length || 0} 段相关证据</p>}
                </div>
              </div>
            ))}
            
            {answer && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-4 shadow-sm">
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{answer}</p>
              </div>
            )}
            
            {sources.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">📚 原文溯源 (防幻觉)</p>
                {sources.map((s, i) => (
                  <div key={i} className="text-xs bg-slate-100 p-3 rounded-md mb-2 border-l-4 border-blue-400">
                    <span className="font-bold text-slate-700 block mb-1">第 {s.page} 页</span>
                    <span className="text-slate-600 leading-relaxed">{s.quote.slice(0, 100)}...</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="flex gap-2">
          <Input 
            value={question} 
            onChange={e => setQuestion(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleAsk()}
            disabled={running} 
            placeholder="向这篇论文提问..."
            className="bg-white"
          />
          <Button onClick={handleAsk} disabled={running} className="bg-blue-600 hover:bg-blue-700">提问</Button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 页面入口（使用 Suspense 包裹，解决 Next.js 报错）
// ==========================================
export default function ReaderPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center text-slate-500">页面加载中...</div>}>
      <ReaderContent />
    </Suspense>
  );
}