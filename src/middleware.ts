import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// JWT 토큰에서 사용자 역할 추출하는 함수
function getUserRoleFromToken(token: string): string | null {
  try {
    // JWT의 payload 부분 디코딩 (base64url 디코딩)
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded));
    return payload.role || null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  // 현재 URL 경로 가져오기
  const { pathname } = request.nextUrl;

  // 쿠키에서 인증 토큰 확인
  const authToken = request.cookies.get("accessToken")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;

  // 로그인을 아예 안한 유저(둘 다 없음)는 랜딩, 로그인, 회원가입(하위포함)만 허용
  if (!authToken && !refreshToken) {
    const allowedPaths = ["/", "/login"];
    const isSignupPath = pathname === "/signup" || pathname.startsWith("/signup/");
    const isAllowed = allowedPaths.includes(pathname) || isSignupPath;
    if (!isAllowed) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // JWT 토큰에서 사용자 역할 추출
  const userRole = authToken ? getUserRoleFromToken(authToken) : null;

  // 인증 상태 확인 : 쿠키만료기한과 토큰만료기한이 같으므로 토큰존재여부로 인증상태확인 가능
  const isAuthenticated = !!authToken;

  // 인증 관련 경로 확인 - 라우트 그룹으로 인해 URL은 /login, /signup
  const authPaths = ["/login", "/signup"];
  const isAuthRoute = authPaths.some((path) => pathname === path);

  // 로그인한 사용자가 인증 경로(로그인, 회원가입)에 접근하는 경우
  if (isAuthRoute && isAuthenticated) {
    // 인증된 사용자는 메인 페이지로 리디렉션
    return NextResponse.redirect(new URL("/", request.url));
  }

  // accessToken이 없어도 보호 경로 차단하지 않음 (자동 재발급을 위해)

  // 역할 기반 접근 제어 (인증된 사용자만)
  if (isAuthenticated && userRole) {
    // SUPER_ADMIN만 접근 가능한 경로
    const superAdminOnlyPaths = [
      "/manage/users",
      "/manage/budgets",
    ];

    // USER, ADMIN 모두 접근 불가 (SUPER_ADMIN만 접근 가능)
    const isSuperAdminOnly = superAdminOnlyPaths.some((path) => pathname === path || pathname.startsWith(path + "/"));
    if ((userRole === "USER" || userRole === "ADMIN") && isSuperAdminOnly) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    // 일반유저(USER)가 접근할 수 없는 경로들 (SUPER_ADMIN 전용 제외)
    const userRestrictedPaths = [
      "/order-manage", // 구매요청관리
      "/order-history", // 구매내역확인
    ];
    const isUserRestricted = userRestrictedPaths.some((path) => pathname === path || pathname.startsWith(path + "/"));
    if (userRole === "USER" && isUserRestricted) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    // 일반유저가 아닌 경우 제한 체크 (장바구니-주문 접근 불가)
    const nonUserRestrictedPaths = [
      "/cart/order", // 장바구니-주문
    ];
    const isNonUserRestricted = nonUserRestrictedPaths.some(
      (path) => pathname === path || pathname.startsWith(path + "/"),
    );
    if (userRole !== "USER" && isNonUserRestricted) {
      return NextResponse.redirect(new URL("/unauthorized?from=order", request.url));
    }
  }

  // 로그인한 사용자가 "/"로 접근하는 경우 /products로 리디렉션
  if (pathname === "/" && isAuthenticated) {
    return NextResponse.redirect(new URL("/products", request.url));
  }

  // 그 외의 경우는 정상적으로 진행
  return NextResponse.next();
}

// 미들웨어가 적용될 경로 패턴 지정
export const config = {
  matcher: [
    // API 경로와 정적 파일은 제외
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
