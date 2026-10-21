import { logout } from "@/app/actions/auth";
import { refreshAccessToken } from "./auth.api";

// 브라우저에서의 API 요청은 Next.js 프록시를 통해 전달 (cross-domain 쿠키 문제 해결)
const PROXY_BASE_URL = "/api/proxy";

// 동시에 여러 요청이 401을 받아도 토큰 갱신은 한 번만 수행하도록 진행 중인 요청을 공유
let refreshPromise: Promise<unknown> | null = null;

export const cookieFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  // fetch 호출 부분을 함수로 분리
  const request = async () => {
    // FormData를 보낼 때는 Content-Type 헤더를 설정하지 않아야 브라우저가 자동으로 boundary를 설정합니다
    const isFormData = options.body instanceof FormData;

    return await fetch(`${PROXY_BASE_URL}${path}`, {
      cache: "no-store",
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
      },
    });
  };

  let response = await request();

  const isRefreshRequest = path === "/auth/refresh-token";

  if (response.status === 401 && !isRefreshRequest) {
    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
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
  const response = await fetch(`${PROXY_BASE_URL}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
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
