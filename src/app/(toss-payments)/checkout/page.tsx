"use client";

import React from "react";
import { loadTossPayments, TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { useEffect, useState } from "react";
import { useOrderStore } from "@/stores/orderStore";
import { useAuth } from "@/providers/AuthProvider";
import img_dog_error from "@/assets/images/img_dog_error.png";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { usePreventLeave } from "@/hooks/usePreventLeave";

export default function CheckoutPage() {
  const [amount, setAmount] = useState<{ currency: string; value: number }>({
    currency: "KRW",
    value: 0,
  });
  const [ready, setReady] = useState<boolean>(false);
  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  const router = useRouter();
  const { user } = useAuth();

  // Zustand로 관리하고 있는 order 정보
  const order = useOrderStore((state) => state.order);

  const clientKey = process.env.NEXT_PUBLIC_CLIENT_KEY;
  const customerKey = user ? user!.id : "";

  usePreventLeave(order?.id ?? "");

  useEffect(() => {
    if (order) {
      setAmount({ currency: "KRW", value: order.productsPriceTotal + order.deliveryFee });
    }
  }, [order]);

  useEffect(() => {
    async function fetchPaymentWidgets() {
      if (!clientKey) {
        console.error("[checkout] NEXT_PUBLIC_CLIENT_KEY 환경변수가 설정되지 않았습니다.");
        setWidgetError("결제 설정이 올바르지 않습니다. 관리자에게 문의해주세요.");
        return;
      }
      if (!customerKey) return; // 유저 정보 로드 후 초기화

      // ------  결제위젯 초기화 ------
      const tossPayments = await loadTossPayments(clientKey);
      // 회원 결제
      const widgets = tossPayments.widgets({ customerKey });
      // 비회원 결제
      // const widgets = tossPayments.widgets({ customerKey: ANONYMOUS });

      setWidgets(widgets);
    }

    fetchPaymentWidgets().catch((error) => {
      console.error("[checkout] 결제위젯 초기화 실패:", error);
      setWidgetError("결제 화면을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    });
  }, [clientKey, customerKey]);

  useEffect(() => {
    async function renderPaymentWidgets() {
      if (widgets == null) {
        return;
      }

      // ------ 주문의 결제 금액 설정 ------
      await widgets.setAmount(amount);

      await Promise.all([
        // ------  결제 UI 렌더링 ------
        widgets.renderPaymentMethods({
          selector: "#payment-method",
          variantKey: "DEFAULT",
        }),
        // ------  이용약관 UI 렌더링 ------
        widgets.renderAgreement({
          selector: "#agreement",
          variantKey: "AGREEMENT",
        }),
      ]);

      setReady(true);
    }

    renderPaymentWidgets().catch((error) => {
      console.error("[checkout] 결제위젯 렌더링 실패:", error);
      setWidgetError("결제 화면을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    });
  }, [widgets, amount]);

  useEffect(() => {
    if (widgets == null) {
      return;
    }

    widgets.setAmount(amount);
  }, [widgets, amount]);

  if (!order) {
    return (
      <div className="flex flex-col h-screen justify-center items-center gap-[20px] -mb-[24px]">
        <section className="flex flex-col gap-[16px] justify-center items-center">
          <div className="relative w-[40vw] h-[30vh] max-w-[300px] aspect-[7/8]">
            <Image src={img_dog_error} alt="에러를 나타내는 강아지 이미지" fill className="object-contain" />
          </div>
          <p role="alert" className="text-center font-medium text-[16px]/[24px] sm:text-[20px]/[30px]">
            유효하지 않은 주문 정보입니다.
          </p>
        </section>
        <Button
          type="black"
          label="홈으로 돌아가기"
          onClick={() => router.push("/products")}
          className="font-semibold text-[16px]/[20px] tracking-tight w-full max-w-[230px] min-h-[56px] sm:max-w-[310px] sm:h-[64px]"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <p role="status" className="flex h-screen justify-center items-center -mb-[24px]">
        로그인한 유저만 이용할 수 있습니다.
      </p>
    );
  }

  return (
    <div className="wrapper">
      <div className="box_section">
        {/* 결제 UI */}
        <section aria-label="결제 수단 선택" id="payment-method" />
        {/* 이용약관 UI */}
        <aside aria-label="이용 약관" id="agreement" />
        {/* 쿠폰 체크박스 */}
        {ready ? (
          <>
            {/* <div>
          <div className="px-[30px] pb-[10px] font-medium">
            <label className="flex items-center gap-[6px]" htmlFor="coupon-box">
              <input
                className="w-4 h-4 cursor-pointer"
                id="coupon-box"
                type="checkbox"
                aria-checked="true"
                disabled={!ready}
                onChange={(event) => {
                  // ------  주문서의 결제 금액이 변경되었을 경우 결제 금액 업데이트 ------
                  setAmount((prev) => ({
                    ...prev,
                    value: event.target.checked ? amount.value - 5_000 : amount.value + 5_000,
                  }));
                }}
              />
              <span> 5,000원 쿠폰 적용</span>
            </label>
          </div>
        </div> */}

            {/* 결제하기 버튼 */}
            <div className="px-[30px]">
              <button
                aria-label="결제하기"
                className="button bg-blue-500 text-white w-full rounded-[12px] h-[56px] font-semibold cursor-pointer"
                disabled={!ready}
                onClick={async () => {
                  try {
                    if (!widgets) return;
                    // ------ '결제하기' 버튼 누르면 결제창 띄우기 ------
                    // 결제를 요청하기 전에 orderId, amount를 서버에 저장하세요.
                    // 결제 과정에서 악의적으로 결제 금액이 바뀌는 것을 확인하는 용도입니다.
                    await widgets.requestPayment({
                      orderId: order.id,
                      orderName:
                        order.products.length > 1
                          ? `${order.products[0].productName} 외 ${order.products.length - 1}건`
                          : order.products[0].productName,
                      successUrl: window.location.origin + "/success",
                      failUrl: window.location.origin + "/fail",
                      customerEmail: user.email,
                      customerName: user.name,
                    });
                  } catch (error) {
                    // 에러 처리하기
                    console.error(error);
                  }
                }}
              >
                결제하기
              </button>
            </div>
          </>
        ) : widgetError ? (
          <p role="alert" className="text-center font-medium text-[16px]/[24px] py-[40px]">
            {widgetError}
          </p>
        ) : (
          <div role="status" aria-label="로딩 중" className="flex justify-center items-center -mb-[24px]">
            <div className="size-[20px] border-[3px] border-t-[3px] border-blue-500 border-t-primary-100 rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
}
