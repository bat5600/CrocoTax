import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeBaseUrl(raw: string): string {
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function getApiBaseUrl(): string {
  const raw =
    process.env.CROCOTAX_API_BASE_URL ??
    process.env.NEXT_PUBLIC_CROCOTAX_API_BASE_URL ??
    "http://localhost:3001";
  return normalizeBaseUrl(raw);
}

async function proxyApiV1(
  request: NextRequest,
  params: { path: string[] }
): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const upstreamUrl = new URL(`/api/v1/${params.path.join("/")}`, baseUrl);
  upstreamUrl.search = new URL(request.url).search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("accept-encoding");

  const init: RequestInit = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  const upstreamResponse = await fetch(upstreamUrl, init);
  const responseHeaders = new Headers(upstreamResponse.headers);

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders
  });
}

export async function GET(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  return proxyApiV1(request, context.params);
}

export async function POST(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  return proxyApiV1(request, context.params);
}

export async function PUT(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  return proxyApiV1(request, context.params);
}

export async function PATCH(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  return proxyApiV1(request, context.params);
}

export async function DELETE(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  return proxyApiV1(request, context.params);
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  return proxyApiV1(request, context.params);
}

