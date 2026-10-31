/* eslint-disable */
"use client";
import { useState, useEffect, useCallback } from "react";
import { FileText, Upload, AlertTriangle, Loader2, GitCompare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Paper {
  id: string;
  filename: string;
  page_count: number;
}

interface DuplicateInfo {
  paper_id: string;
  filename: string;
  similarity: number;
  suggestion: string;
}

export default function Library() {
  const router = useRouter();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchPapers = useCallback(async () => {
    try {
      const res = await fetch("/api/papers");
      const data = await res.json();
      setPapers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => { 
    fetchPapers(); 
  }, [fetchPapers]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!localStorage.getItem("yantu_token")) {
      window.dispatchEvent(new Event("open-login-modal"));
      e.target.value = ""; // 清空选中的文件
      return;
    }
    const f = e.target.files?.[0]; if (!f) return;
    setLoading(true);
    const form = new FormData(); form.append("file", f);
    try {
      const res = await fetch("/api/papers/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.duplicates?.length > 0) setDuplicate(data.duplicates[0]);
      else fetchPapers();
    } catch { 
      alert("上传失败"); 
    } finally { 
      setLoading(false); 
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleCompare = () => {
    if (selectedIds.length < 2) {
      alert("请至少选择两篇论文进行对比！");
      return;
    }
    router.push(`/compare?ids=${selectedIds.join(",")}`);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen bg-slate-50">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">文献库</h1>
          <p className="text-slate-500 mt-1">管理你的 PDF 论文，勾选多篇可进行跨文献对比。</p>
        </div>
        <div className="flex gap-3">
          {selectedIds.length > 0 && (
            <button 
              onClick={handleCompare}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm"
            >
              <GitCompare className="w-5 h-5" />
              对比选中的 {selectedIds.length} 篇文献
            </button>
          )}
          <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 relative overflow-hidden hover:bg-blue-700 transition shadow-sm">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {loading ? "解析中..." : "上传新文献"}
            <input type="file" accept=".pdf" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={loading} />
          </button>
        </div>
      </div>

      {duplicate && (
        <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg flex items-start gap-3 shadow-sm">
          <AlertTriangle className="text-amber-500 shrink-0" />
          <div>
            <h3 className="font-bold text-amber-800">检测到重复版本</h3>
            <p className="text-sm text-amber-700 mt-1">
              库中已存在 <b>{duplicate.filename}</b> (相似度 {(duplicate.similarity * 100).toFixed(0)}%)。建议保留现有版本。
            </p>
            <button onClick={() => setDuplicate(null)} className="mt-3 text-sm bg-white border border-amber-300 text-amber-700 px-4 py-1.5 rounded hover:bg-amber-100 transition">我知道了</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {papers.map(p => {
          const isSelected = selectedIds.includes(p.id);
          return (
            <div 
              key={p.id} 
              onClick={() => toggleSelect(p.id)}
              className={`relative bg-white p-6 rounded-xl border-2 cursor-pointer transition-all ${
                isSelected ? "border-indigo-500 shadow-md ring-2 ring-indigo-100" : "border-slate-200 shadow-sm hover:border-indigo-300"
              }`}
            >
              <div className="absolute top-4 right-4">
                <input 
                  type="checkbox" 
                  checked={isSelected}
                  readOnly
                  className="w-5 h-5 accent-indigo-600 cursor-pointer"
                />
              </div>
              <FileText className={`w-10 h-10 mb-4 ${isSelected ? "text-indigo-500" : "text-blue-500"}`} />
              <h3 className="font-bold text-lg mb-1 truncate pr-8" title={p.filename}>{p.filename.replace(".pdf", "")}</h3>
              <p className="text-sm text-slate-400 mb-6">{p.page_count} 页</p>
              <Link 
                href={`/reader/${p.id}`} 
                className="block text-center w-full py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition font-medium" 
                onClick={e => e.stopPropagation()}
              >
                进入阅读
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}