import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function handler(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = path.join("/");
  const url = new URL(request.url);
  const targetUrl = `${BE_URL}/${pathStr}${url.search}`;

  // Vercel 도메인에 저장된 쿠키 읽기
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  const refreshToken = cookieStore.get("refreshToken")?.value;

  const cookieParts: string[] = [];
  if (accessToken) cookieParts.push(`accessToken=${accessToken}`);
  if (refreshToken) cookieParts.push(`refreshToken=${refreshToken}`);
  const cookieHeader = cookieParts.join("; ");

  const contentType = request.headers.get("content-type") || "";
  const isFormData = contentType.includes("multipart/form-data");

  let body: BodyInit | null = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = isFormData ? await request.formData() : await request.text();
  }

  const forwardHeaders: Record<string, string> = {};
  if (cookieHeader) forwardHeaders["Cookie"] = cookieHeader;
  if (!isFormData && contentType) forwardHeaders["Content-Type"] = contentType;

  const beResponse = await fetch(targetUrl, {
    method: request.method,
    headers: forwardHeaders,
    body: body ?? undefined,
    cache: "no-store",
  });

  const responseBody = beResponse.status === 204 ? null : await beResponse.arrayBuffer();

  const response = new NextResponse(responseBody, {
    status: beResponse.status,
    statusText: beResponse.statusText,
    headers: {
      "Content-Type": beResponse.headers.get("content-type") || "application/json",
    },
  });

  // BE에서 받은 Set-Cookie 헤더를 vercel.app 도메인으로 재설정
  const rawSetCookies: string[] = [];
  if (typeof beResponse.headers.getSetCookie === "function") {
    rawSetCookies.push(...beResponse.headers.getSetCookie());
  } else {
    const raw = beResponse.headers.get("set-cookie");
    if (raw) rawSetCookies.push(raw);
  }

  for (const setCookieStr of rawSetCookies) {
    const parts = setCookieStr.split(";").map((s) => s.trim());
    const nameValue = parts[0];
    const eqIdx = nameValue.indexOf("=");
    if (eqIdx === -1) continue;

    const cookieName = nameValue.slice(0, eqIdx);
    const cookieValue = nameValue.slice(eqIdx + 1);

    const attrs: Record<string, string | boolean> = {};
    for (const part of parts.slice(1)) {
      const attrEqIdx = part.indexOf("=");
      if (attrEqIdx === -1) {
        attrs[part.toLowerCase()] = true;
      } else {
        attrs[part.slice(0, attrEqIdx).toLowerCase()] = part.slice(attrEqIdx + 1);
      }
    }

    response.cookies.set(cookieName, cookieValue, {
      httpOnly: !!attrs["httponly"],
      secure: !!attrs["secure"],
      sameSite: "lax",
      path: (attrs["path"] as string) || "/",
      ...(attrs["expires"] ? { expires: new Date(attrs["expires"] as string) } : {}),
      ...(attrs["max-age"] ? { maxAge: parseInt(attrs["max-age"] as string) } : {}),
    });
  }

  return response;
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
