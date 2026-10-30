"use client";
import { useState } from "react";

export default function Home() {
  const [msg, setMsg] = useState("");
  async function ping() {
    const r = await fetch("http://127.0.0.1:8000/health");
    setMsg(JSON.stringify(await r.json()));
  }
  return (
    <main style={{ padding: 40 }}>
      <h1>研途助手</h1>
      <button onClick={ping}>测试后端</button>
      <p>{msg}</p>
    </main>
  );
}