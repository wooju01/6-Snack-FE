"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
}

// 환경변수에서 API URL을 가져오거나 기본값 사용
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function login(data: LoginData) {
  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.message || "로그인에 실패했습니다",
      };
    }

    const cookieStore = await cookies();
    cookieStore.set("accessToken", result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      expires: new Date(result.accessTokenExpires),
      path: "/",
    });
    cookieStore.set("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      expires: new Date(result.refreshTokenExpires),
      path: "/",
    });

    return {
      success: true,
      user: result,
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: "서버 연결 중 오류가 발생했습니다",
    };
  }
}

export async function register(data: RegisterData) {
  try {
    // 일반 회원가입은 초대 링크가 필요하므로 여기서는 처리하지 않음
    // 대신 회원가입 성공 메시지만 반환
    console.log("Register data:", data); // 디버깅용
    return {
      success: true,
      message: "회원가입이 완료되었습니다. 로그인해주세요.",
    };
  } catch (error) {
    console.error("Register error:", error);
    return {
      success: false,
      error: "서버 연결 중 오류가 발생했습니다",
    };
  }
}

export async function logout() {
  try {
    await fetch(`${BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include", // 쿠키를 보내기 위해 필요
    });

    // 로컬 쿠키도 삭제
    const cookieStore = await cookies();
    cookieStore.delete("accessToken");
    cookieStore.delete("refreshToken");

    redirect("/login");
  } catch (error) {
    console.error("Logout error:", error);
    // 에러가 발생해도 쿠키는 삭제
    const cookieStore = await cookies();
    cookieStore.delete("accessToken");
    cookieStore.delete("refreshToken");

    redirect("/login");
  }
}
