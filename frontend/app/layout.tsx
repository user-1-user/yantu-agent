"use client";
import { useState, useEffect } from "react";
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, Network, PenTool, LayoutDashboard, LogOut, UserCircle, LogIn } from "lucide-react";
import LoginModal from "@/components/LoginModal";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 检查登录状态 & 监听全局弹窗事件
  useEffect(() => {
    const checkAuth = () => {
      setUser(localStorage.getItem("yantu_user"));
    };
    checkAuth();

    // 监听各页面发来的“请求登录”事件
    const handleOpenLogin = () => setIsModalOpen(true);
    window.addEventListener("open-login-modal", handleOpenLogin);
    
    return () => window.removeEventListener("open-login-modal", handleOpenLogin);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("yantu_token");
    localStorage.removeItem("yantu_user");
    setUser(null);
    window.location.reload();
  };

  return (
    <html lang="zh-CN">
      <body className="flex h-screen bg-slate-50 text-slate-900 font-sans">
        {/* 侧边栏 */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm shrink-0">
          <div className="h-16 flex items-center px-6 border-b border-slate-100">
            <span className="text-xl font-bold text-blue-600 tracking-tight flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm">研</span>
              研途助手
            </span>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {[
              { name: "工作台", href: "/", icon: LayoutDashboard },
              { name: "文献库", href: "/library", icon: Library },
              { name: "引用图谱", href: "/graph", icon: Network },
              { name: "写作 Copilot", href: "/copilot", icon: PenTool },
            ].map((item) => (
              <Link key={item.name} href={item.href} className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${pathname === item.href ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
          </nav>
        </aside>

        {/* 主内容区（带顶栏） */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* 顶栏 */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-8 shrink-0 shadow-sm z-10">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <UserCircle className="w-5 h-5 text-blue-600" /> {user}
                </span>
                <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-red-500 transition flex items-center gap-1">
                  <LogOut className="w-4 h-4" /> 退出
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                <LogIn className="w-4 h-4" /> 登录 / 注册
              </button>
            )}
          </header>

          {/* 页面内容 */}
          <main className="flex-1 overflow-auto bg-slate-50 relative">
            {children}
          </main>
        </div>

        {/* 全局登录弹窗 */}
        <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </body>
    </html>
  );
}