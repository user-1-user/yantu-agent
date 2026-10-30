import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://127.0.0.1:8000';

export async function GET(req: NextRequest) {
  const path = req.nextUrl.pathname; // 比如 /api/papers
  try {
    const res = await fetch(`${BACKEND_URL}${path}`);
    const text = await res.text(); // 先拿纯文本，不直接解析 JSON
    
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error("后端返回的不是JSON:", text);
      return NextResponse.json({ error: "后端数据格式错误" }, { status: 502 });
    }
    
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

    if (res.headers.get('content-type')?.includes('text/event-stream')) {
      return new NextResponse(res.body, {
        status: res.status,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error("后端返回的不是JSON:", text);
      return NextResponse.json({ error: "后端数据格式错误" }, { status: 502 });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("代理 POST 请求失败:", error);
    return NextResponse.json({ error: "无法连接到后端" }, { status: 502 });
  }
}