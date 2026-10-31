/* eslint-disable */
"use client";
import { useState, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import { Network, Loader2, Lightbulb, FileText } from "lucide-react";

interface GraphNode { id: string; name: string; size: number; }
interface GraphEdge { source: string; target: string; }
interface GraphData { nodes: GraphNode[]; edges: GraphEdge[]; }
interface FwItem { paper_id: string; filename: string; future_work: string[]; }

export default function GraphPage() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [fwList, setFwList] = useState<FwItem[]>([]);
  const [fwLoading, setFwLoading] = useState(false);

  // 生成图谱
  const loadGraph = async () => {
    if (!localStorage.getItem("yantu_token")) {
      window.dispatchEvent(new Event("open-login-modal"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/graph/build", { method: "POST" });
      setGraph(await res.json());
    } catch (error) {
      console.error("加载图谱失败", error);
    } finally {
      setLoading(false);
    }
  };

  // 提取 FutureWork
  const loadFutureWork = async () => {
    if (!localStorage.getItem("yantu_token")) {
      window.dispatchEvent(new Event("open-login-modal"));
      return;
    }

    setFwLoading(true);
    try {
      const res = await fetch("/api/futurework", { method: "POST" });
      const data = await res.json();
      setFwList(data.items || []);
    } catch (error) {
      console.error("提取未来工作失败", error);
    } finally {
      setFwLoading(false);
    }
  };

  useEffect(() => {
    loadFutureWork();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen flex flex-col bg-slate-50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">引用拓扑图谱</h1>
          <p className="text-slate-500 mt-1">通过 PageRank 算法挖掘领域基石论文。</p>
        </div>
        <button onClick={loadGraph} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition shadow-sm">
          {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Network className="w-5 h-5"/>} 生成图谱
        </button>
      </div>
      
      <div className="h-[450px] bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-8 shrink-0">
        {graph ? (
          <ReactECharts 
            style={{ height: "100%", width: "100%" }} 
            option={{
              tooltip: {},
              series: [{
                type: "graph", 
                layout: "force", 
                roam: true,
                data: graph.nodes.map((n: GraphNode) => ({
                  id: n.id, 
                  name: n.name, 
                  symbolSize: n.size,
                  // 阈值调整为 65 配合后端 45 的基数
                  itemStyle: { color: n.size > 65 ? "#e11d48" : "#2563eb" }
                })),
                links: graph.edges,
                label: { 
                  show: true, 
                  fontSize: 13, 
                  position: "bottom",
                  distance: 8,
                  color: "#334155",
                  fontWeight: "bold"
                },
                force: { 
                  repulsion: 800, 
                  edgeLength: 200,
                  gravity: 0.1
                }
              }]
            }} 
          />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            点击右上角“生成图谱”
          </div>
        )}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-6 h-6 text-amber-500" />
          <h2 className="text-2xl font-bold text-slate-800">多篇论文 Future Work 提取</h2>
          <button onClick={loadFutureWork} disabled={fwLoading} className="ml-4 text-sm text-blue-600 border border-blue-200 px-3 py-1 rounded hover:bg-blue-50 transition">
            {fwLoading ? "提取中..." : "刷新提取"}
          </button>
        </div>
        
        {fwLoading ? (
          <div className="text-slate-500 text-sm">正在解析各篇文献的未来工作...</div>
        ) : fwList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fwList.map((item, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-blue-500" /> {item.filename}
                </h3>
                <ul className="space-y-2">
                  {item.future_work.map((sentence, i) => (
                    <li key={i} className="text-sm text-slate-600 bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                      {sentence}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-400 text-sm">暂无数据，请确保库中已上传英文文献，或点击刷新提取。</div>
        )}
      </div>
    </div>
  );
}