"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function Library() {
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [duplicateWarn, setDuplicateWarn] = useState<any>(null);

  const fetchPapers = async () => {
    const res = await fetch("/api/papers");
    setPapers(await res.json());
  };

  useEffect(() => { fetchPapers(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setLoading(true);
    const form = new FormData(); form.append("file", f);
    const res = await fetch("/api/papers/upload", { method: "POST", body: form });
    const data = await res.json();
    if (data.duplicates?.length > 0) setDuplicateWarn(data.duplicates[0]);
    else fetchPapers();
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">文献库</h1>
          <p className="text-slate-500 mt-2">管理你的 PDF 论文，Agent 已自动解析语义并建立索引。</p>
        </div>
        <Button disabled={loading} className="bg-blue-600 hover:bg-blue-700">
          <Upload className="w-4 h-4 mr-2" />
          {loading ? "解析中..." : "上传新文献"}
          <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleUpload} />
        </Button>
      </div>

      {duplicateWarn && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg flex items-start gap-3">
          <AlertTriangle className="text-yellow-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-800">检测到重复版本</h3>
            <p className="text-sm text-yellow-700">库中已有 <b>{duplicateWarn.filename}</b>，相似度 {duplicateWarn.similarity * 100}%。建议保留现有版本。</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setDuplicateWarn(null); fetchPapers(); }}>仍然保留</Button>
              <Button size="sm" onClick={() => setDuplicateWarn(null)}>放弃上传</Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {papers.map((p) => (
          <Card key={p.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <FileText className="w-8 h-8 text-blue-500" />
                <Badge variant="secondary">{p.page_count} 页</Badge>
              </div>
              <CardTitle className="text-lg mt-2 line-clamp-2">{p.filename.replace(".pdf", "")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mt-4">
                <Link href={`/reader/${p.id}`} className="flex-1">
                  <Button variant="outline" className="w-full">对照阅读</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}