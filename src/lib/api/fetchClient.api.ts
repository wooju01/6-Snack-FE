import { logout } from "@/app/actions/auth";
import { refreshAccessToken } from "./auth.api";

// 브라우저에서의 API 요청은 Next.js 프록시를 통해 전달 (cross-domain 쿠키 문제 해결)
const PROXY_BASE_URL = "/api/proxy";

export const cookieFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const method = options.method || "GET";
  console.log(`🌐 API 요청: ${method} ${PROXY_BASE_URL}${path}`);

  // fetch 호출 부분을 함수로 분리
  const request = async () => {
    // FormData를 보낼 때는 Content-Type 헤더를 설정하지 않아야 브라우저가 자동으로 boundary를 설정합니다
    const isFormData = options.body instanceof FormData;

    return await fetch(`${PROXY_BASE_URL}${path}`, {
      cache: "no-store",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
      },
      ...options,
    });
  };

  let response = await request();

  const isRefreshRequest = path === "/auth/refresh-token";

  if (response.status === 401 && !isRefreshRequest) {
    try {
      console.log("🔄 액세스 토큰 갱신 시도");
      await refreshAccessToken();
      console.log("✅ 액세스 토큰 갱신 성공, 원본 요청 재시도");
      response = await request();
    } catch (refreshError) {
      console.error("❌ 액세스 토큰 재발급 실패:", refreshError);
      await logout();
      throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
};

export const defaultFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const method = options.method || "GET";
  console.log(`🌐 API 요청: ${method} ${PROXY_BASE_URL}${path}`);

  const response = await fetch(`${PROXY_BASE_URL}${path}`, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }
  const data = await response.json();
  return data as T;
};
