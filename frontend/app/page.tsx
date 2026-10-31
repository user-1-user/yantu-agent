"use client";
import { useState } from "react";
import Link from "next/link";
import { 
  BookOpen, Network, PenTool, BrainCircuit, 
  Wrench, Eye, ArrowRight, Sparkles, Send
} from "lucide-react";

// 定义 Agent 步骤类型，消灭 any
interface AgentStep {
  type: 'thought' | 'action' | 'observation' | 'error';
  content: string;
}

export default function Dashboard() {
  const [input, setInput] = useState("帮我查一下库里有多少篇论文？");
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [running, setRunning] = useState(false);

  // 触发 Agent 思考
  const runAgent = async () => {
    if (!input || running) return;
    setRunning(true); setSteps([]); setFinalAnswer("");
    
    try {
      const res = await fetch("/api/agent/chat", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }) 
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
            if (data.type === "text") {
              setFinalAnswer(prev => prev + data.content);
            } else if (data.type !== "final") {
              setSteps(prev => [...prev, data as AgentStep]);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      alert("Agent 接口异常，请确保后端 main.py 中已包含 /api/agent/chat 接口！");
    } finally {
      setRunning(false);
    }
  };

  const quickLinks = [
    { title: "文献库管理", desc: "上传 PDF，智能解析", href: "/library", icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "知识图谱", desc: "挖掘基石论文", href: "/graph", icon: Network, color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "写作 Copilot", desc: "生成框架与图表", href: "/copilot", icon: PenTool, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-slate-50">
      {/* 头部欢迎区 */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-blue-500" />
          欢迎使用研途助手
        </h1>
        <p className="text-slate-500 mt-2">大模型与 Agent 驱动的全流程科研辅助系统。您可以在这里进行文献分析、图谱挖掘与学术写作。</p>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-10">
        {/* 核心功能入口卡片 */}
        {quickLinks.map((item) => (
          <Link key={item.title} href={item.href}>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group">
              <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <item.icon className={`w-6 h-6 ${item.color}`} />
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-1">{item.title}</h3>
              <p className="text-sm text-slate-500">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* 核心 Agent 智能调度面板 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[500px]">
        <div className="p-4 border-b bg-slate-900 text-white flex items-center gap-2 font-medium">
          <BrainCircuit className="w-5 h-5 text-blue-400" />
          Agent 智能推理工作台 (ReAct 架构演示)
        </div>
        
        <div className="flex-1 p-6 overflow-auto space-y-4 bg-slate-50">
          {steps.length === 0 && !finalAnswer && (
            <div className="text-slate-400 text-sm text-center mt-10">
              输入指令，查看 Agent 的思考（Thought）、行动（Action）与观察（Observation）过程...
            </div>
          )}

          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              {s.type === 'thought' && <BrainCircuit className="w-5 h-5 text-purple-500 mt-0.5" />}
              {s.type === 'action' && <Wrench className="w-5 h-5 text-amber-500 mt-0.5" />}
              {s.type === 'observation' && <Eye className="w-5 h-5 text-green-500 mt-0.5" />}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.type}</span>
                <p className="text-sm font-medium text-slate-700 mt-1">{s.content}</p>
              </div>
            </div>
          ))}

          {finalAnswer && (
            <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl mt-4 shadow-sm">
              <p className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1">
                <ArrowRight className="w-3 h-3"/> AGENT FINAL ANSWER
              </p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{finalAnswer}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-white flex gap-3">
          <input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && runAgent()}
            className="flex-1 bg-slate-100 border-none px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
            placeholder="向 Agent 下达指令..." 
          />
          <button 
            onClick={runAgent} 
            disabled={running} 
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
          >
            {running ? "推理中..." : "执行"} <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}