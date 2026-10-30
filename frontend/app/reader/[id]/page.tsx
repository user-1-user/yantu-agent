"use client";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Search, CheckCircle2, Loader2, User } from "lucide-react";

export default function Reader({ params }: { params: { id: string } }) {
  const [paper, setPaper] = useState<any>(null);
  const [question, setQuestion] = useState("β1和β2设置是多少？");
  const [logs, setLogs] = useState<any[]>([]);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/papers/${params.id}`).then(r => r.json()).then(setPaper);
  }, [params.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs, answer]);

  const handleAsk = async () => {
    setRunning(true); setLogs([]); setAnswer(""); setSources([]);
    const res = await fetch("/api/qa/stream", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper_id: params.id, question }),
    });
    
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      const lines = decoder.decode(value).split("\n\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          if (data.agent) {
            setLogs((prev) => {
              const newLogs = [...prev];
              const idx = newLogs.findIndex(l => l.agent === data.agent);
              if (idx >= 0) {
                newLogs[idx] = { ...newLogs[idx], ...data };
              } else {
                newLogs.push(data);
              }
              return newLogs;
            });
          }
          if (data.text) setAnswer(prev => prev + data.text);
          if (data.sources) setSources(data.sources);
        }
      }
    }
    setRunning(false);
  };

  if (!paper) return <div className="p-8">加载中...</div>;

  return (
    <div className="flex h-screen p-6 gap-6">
      {/* 左侧 PDF 文本区域 */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border p-6 overflow-auto">
        <h2 className="text-xl font-bold mb-4">{paper.filename}</h2>
        {paper.pages.map((p: any) => (
          <div key={p.page} className="mb-6">
            <Badge variant="outline" className="mb-2">第 {p.page} 页</Badge>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{p.text}</p>
          </div>
        ))}
      </div>

      {/* 右侧 Agent 交互区 */}
      <div className="w-[450px] flex flex-col gap-4">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 py-3">
            <CardTitle className="text-sm flex items-center gap-2">
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
                  {log.status === "done" && log.agent === "检索证据" && (
                    <p className="text-xs text-slate-500 mt-1">找到 {log.sources.length} 段相关证据</p>
                  )}
                </div>
              </div>
            ))}
            {answer && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-4">
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{answer}</p>
              </div>
            )}
            {sources.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">📚 原文溯源</p>
                {sources.map((s, i) => (
                  <div key={i} className="text-xs bg-slate-100 p-2 rounded mb-1 border-l-2 border-slate-400">
                    第{s.page}页：{s.quote.slice(0, 100)}...
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="flex gap-2">
          <Input value={question} onChange={e => setQuestion(e.target.value)} disabled={running} />
          <Button onClick={handleAsk} disabled={running}>提问</Button>
        </div>
      </div>
    </div>
  );
}