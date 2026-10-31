import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { BookOpen, Network, PenTool, LayoutDashboard } from "lucide-react";

export const metadata: Metadata = {
  title: "研途助手 | AI 科研工作台",
  description: "大模型与Agent驱动的全流程科研辅助系统",
};

// 提取到外部，避免每次渲染重新创建，解决多余警告
const navItems = [
  { name: "工作台", href: "/", icon: LayoutDashboard },
  { name: "文献库", href: "/library", icon: BookOpen },
  { name: "引用图谱", href: "/graph", icon: Network },
  { name: "写作 Copilot", href: "/copilot", icon: PenTool },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="flex h-screen bg-slate-50 text-slate-900 font-sans">
        {/* 左侧导航栏 */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm shrink-0">
          <div className="h-16 flex items-center px-6 border-b border-slate-100">
            <span className="text-xl font-bold text-blue-600 tracking-tight flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm">
                研
              </span>
              研途助手
            </span>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-green-600 bg-green-50 rounded-lg font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Agent 在线运行中
            </div>
          </div>
        </aside>
        
        {/* 主内容区 */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}