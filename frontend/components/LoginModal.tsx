"use client";
import { useState } from "react";
import { LockKeyhole, User, KeyRound, Loader2, X } from "lucide-react";

export default function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || "操作失败");

      if (isLogin) {
        localStorage.setItem("yantu_token", data.token);
        localStorage.setItem("yantu_user", data.username);
        onClose(); // 关闭弹窗
        window.location.reload(); // 刷新页面以更新状态
      } else {
        alert("注册成功，请直接登录！");
        setIsLogin(true);
      }
    } catch (err) { // 👈 去掉这里的 : any
      // 👇 修复 TypeScript 报错的标准写法
      const errorMessage = err instanceof Error ? err.message : "网络异常，请稍后再试";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-2xl shadow-2xl border border-slate-100 w-[420px] relative animate-in fade-in zoom-in duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
          <X className="w-6 h-6" />
        </button>
        
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <LockKeyhole className="w-7 h-7" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-center text-slate-800 mb-6">
          {isLogin ? "登录以使用全部功能" : "注册研途助手账号"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input
              type="text" required placeholder="用户名"
              value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="relative">
            <KeyRound className="absolute top-3 left-3 w-5 h-5 text-slate-400" />
            <input
              type="password" required placeholder="密码"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition flex justify-center items-center">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? "登 录" : "注 册")}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? "还没有账号？" : "已有账号？"}
          <button onClick={() => setIsLogin(!isLogin)} className="text-blue-600 font-bold ml-1 hover:underline">
            {isLogin ? "去注册" : "去登录"}
          </button>
        </div>
      </div>
    </div>
  );
}