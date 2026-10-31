import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://127.0.0.1:8000';

export async function GET(req: NextRequest) {
  const path = req.nextUrl.pathname;
  try {
    const res = await fetch(`${BACKEND_URL}${path}`);
    
    // 如果后端状态码不是 200，直接透传
    if (!res.ok) {
      return new NextResponse(res.body, { status: res.status });
    }
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("代理 GET 请求失败:", error);
    return NextResponse.json({ error: "无法连接到后端" }, { status: 502 });
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

    // 针对流式问答的特殊处理
    if (res.headers.get('content-type')?.includes('text/event-stream')) {
      return new NextResponse(res.body, {
        status: res.status,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    if (!res.ok) {
      return new NextResponse(res.body, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("代理 POST 请求失败:", error);
    return NextResponse.json({ error: "无法连接到后端" }, { status: 502 });
  }
}