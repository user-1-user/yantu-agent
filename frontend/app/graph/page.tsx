"use client";
import { useState } from "react";
import ReactECharts from "echarts-for-react";
import { Button } from "@/components/ui/button";

// 定义严格的数据类型，替换 any
interface GraphNode {
  id: string;
  name: string;
  size: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export default function GraphPage() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadGraph = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/graph/build", { method: "POST" });
      const data = await res.json();
      setGraph(data);
    } catch (error) {
      console.error("加载图谱失败", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 h-screen flex flex-col bg-slate-50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">引用拓扑图谱</h1>
          <p className="text-slate-500 mt-2">通过 PageRank 算法挖掘领域基石论文（节点越大越核心）。</p>
        </div>
        <Button onClick={loadGraph} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
          {loading ? "计算中..." : "生成分析图谱"}
        </Button>
      </div>
      
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        {graph ? (
          <ReactECharts 
            style={{ height: "100%", width: "100%" }} 
            option={{
              tooltip: {},
              series: [{
                type: "graph", 
                layout: "force", 
                roam: true,
                // 这里也不再用 any 了，完全遵守类型
                data: graph.nodes.map((n: GraphNode) => ({
                  id: n.id, 
                  name: n.name, 
                  symbolSize: n.size,
                  itemStyle: { color: n.size > 50 ? "#e11d48" : "#2563eb" }
                })),
                links: graph.edges,
                label: { show: true, fontSize: 12, position: "bottom" },
                force: { repulsion: 300, edgeLength: 150 }
              }]
            }} 
          />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            点击右上角“生成分析图谱”，Agent 将开始分析文献引用关系。
          </div>
        )}
      </div>
    </div>
  );
}