import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const res = await fetch(`http://127.0.0.1:8000/api/${path}`, { headers: req.headers });
  return new NextResponse(res.body, { status: res.status, headers: res.headers });
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const body = await req.blob();
  const res = await fetch(`http://127.0.0.1:8000/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': req.headers.get('content-type') || '' },
    body: body,
  });
  return new NextResponse(res.body, { status: res.status, headers: res.headers });
}