import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://127.0.0.1:8000';

export async function GET(req: NextRequest) {
  const path = req.nextUrl.pathname;
  try {
    const res = await fetch(`${BACKEND_URL}${path}`);
    
    // 统一解析为文本，再转 JSON 返回，防止丢失 Content-Type
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { detail: text };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("代理 GET 请求失败:", error);
    return NextResponse.json({ detail: "无法连接到后端服务" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const path = req.nextUrl.pathname;
  try {
    const contentType = req.headers.get('content-type') || '';
    const body = await req.arrayBuffer();

    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: body,
    });

    // 1. 针对流式问答的特殊处理 (SSE)
    if (res.headers.get('content-type')?.includes('text/event-stream')) {
      return new NextResponse(res.body, {
        status: res.status,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    // 2. 统一解析为文本，再转 JSON 返回
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { detail: text };
    }
    return NextResponse.json(data, { status: res.status });
    
  } catch (error) {
    console.error("代理 POST 请求失败:", error);
    return NextResponse.json({ detail: "无法连接到后端服务" }, { status: 502 });
  }
}