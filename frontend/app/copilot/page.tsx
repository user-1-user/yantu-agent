"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileSpreadsheet, PenTool, Loader2 } from "lucide-react";

export default function CopilotPage() {
  // --- CSV 数据可视化状态 ---
  const [plot, setPlot] = useState<{ image_url: string; caption: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  // --- 写作框架状态 ---
  const [idea, setIdea] = useState("把大模型应用到医学影像的病灶自动分割中，提升小目标识别精度。");
  const [framework, setFramework] = useState("");
  const [writing, setWriting] = useState(false);

  // 1. 上传 CSV 并生成图表
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // 1. 检查是否登录
    if (!localStorage.getItem("yantu_token")) {
      window.dispatchEvent(new Event("open-login-modal"));
      e.target.value = ""; // 👈 关键：清空选中的文件
      return;
    }

    const f = e.target.files?.[0];
    if (!f) return;
    
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/csv/plot", { method: "POST", body: form });
      if (!res.ok) throw new Error("CSV 解析失败");
      const data = await res.json();
      setPlot(data);
    } catch (error) {
      console.error(error);
      alert("CSV 生成失败，请检查后端终端是否报错。");
    } finally {
      setUploading(false);
      e.target.value = ""; // 成功上传后也清空，允许重复选同一个文件
    }
  };

  // 2. 生成论文框架
  const handleWrite = async () => {
    // 1. 先检查有没有输入 Idea
    if (!idea.trim()) {
      alert("请先输入您的科研 Idea！");
      return;
    }
    
    // 2. 检查是否登录，未登录则唤起弹窗
    if (!localStorage.getItem("yantu_token")) {
      window.dispatchEvent(new Event("open-login-modal"));
      return;
    }

    setWriting(true);
    try {
      const res = await fetch("/api/write/framework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();
      setFramework(data.framework);
    } catch (error) {
      console.error(error);
      alert("生成失败，请检查后端终端。");
    } finally {
      setWriting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto grid grid-cols-2 gap-8 bg-slate-50 min-h-screen">
      {/* 左侧：数据可视化 */}
      <Card className="shadow-sm border-slate-200 flex flex-col">
        <CardHeader className="border-b bg-white">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            学术数据可视化渲染
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4 bg-white flex-1 flex flex-col">
          <p className="text-sm text-slate-500">
            上传实验产出的原始 CSV 数据，Agent 将自动转化为学术级图表，并提炼符合规范的英文 Figure Caption。
          </p>
          <div className="flex items-center gap-4">
            <Button variant="outline" className="relative overflow-hidden">
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {uploading ? "正在生成图表..." : "选择 CSV 文件上传"}
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleCsvUpload} 
                disabled={uploading} 
                className="absolute inset-0 opacity-0 cursor-pointer" 
              />
            </Button>
          </div>
          
          {plot && (
        <div className="mt-4 border rounded-lg p-4 bg-slate-50 flex-1 flex flex-col">
             {/* eslint-disable-next-line @next/next/no-img-element */}
         <img src={plot.image_url} alt="Generated Chart" className="w-full rounded-md shadow-sm mb-4 border" />
        <div className="text-sm text-slate-700 bg-white p-4 rounded-md border border-slate-200">
        <span className="font-bold text-slate-900 block mb-1">Auto-generated Figure Caption:</span>
        <p className="italic text-slate-600">{plot.caption}</p>
           </div>
             </div>
          )}
          {!plot && !uploading && (
            <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg border-slate-200 bg-slate-50 text-slate-400 text-sm">
              暂无图表，请上传 CSV
            </div>
          )}
        </CardContent>
      </Card>

      {/* 右侧：写作框架 */}
      <Card className="shadow-sm border-slate-200 flex flex-col">
        <CardHeader className="border-b bg-white">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <PenTool className="w-5 h-5 text-blue-600" />
            无幻觉论文框架生成
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4 flex-1 flex flex-col bg-white">
          <p className="text-sm text-slate-500">
            输入你的科研 Idea，Agent 将结合你文献库中真实存在的文献，生成规范框架，References 绝不编造。
          </p>
          <Textarea 
            value={idea} 
            onChange={e => setIdea(e.target.value)} 
            rows={3} 
            placeholder="描述你的科研想法..."
            className="resize-none focus:border-blue-500"
          />
          <Button onClick={handleWrite} disabled={writing} className="w-full bg-blue-600 hover:bg-blue-700">
            {writing ? "Agent 正在构思文献与框架..." : "一键生成论文框架"}
          </Button>

          {framework && (
            <div className="flex-1 mt-4 bg-slate-50 p-5 rounded-lg border border-slate-200 overflow-auto">
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                {framework}
              </pre>
            </div>
          )}
          {!framework && !writing && (
             <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg border-slate-200 bg-slate-50 text-slate-400 text-sm">
              暂无框架，请输入 Idea 并生成
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}