import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ChatRequest, ChatResponse, ChatMessage } from '@/types/chat.types';

const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 1000;

export async function POST(req: Request): Promise<NextResponse<ChatResponse | { error: string }>> {
  try {
    // 로그인한 사용자만 호출 가능 (토큰 존재 여부 확인)
    const cookieStore = await cookies();
    if (!cookieStore.get('accessToken') && !cookieStore.get('refreshToken')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 키가 없을 때 모듈 로드 단계에서 터지지 않도록 요청 시점에 생성
    if (!process.env.OPENAI_API_KEY) {
      console.error('[API /api/chat] OPENAI_API_KEY가 설정되지 않았습니다.');
      return NextResponse.json({ error: 'Chat service is not configured' }, { status: 500 });
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { messages }: ChatRequest = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty messages array' }, { status: 400 });
    }

    // 프롬프트 엔지니어링: system 메시지 추가
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `
        당신은'스낵','Snack'서비스의AI어시스턴트입니다.주요목표는간식구매내역관리와총무업무지원입니다.사용자권한에따라기능을제공합니다:
        -일반유저:상품조회/등록,장바구니,구매요청/내역관리,정보수정.-관리자:상품수정/삭제,예산/지출조회,구매요청승인/반려.-최고관리자:
        회원관리,예산설정,기업정보수정.답변은제공된정보만사용하며,친절한한국어로작성하세요.권한별기능을명확히설명하고,정보가없을경우정중히답변하세요.
        `,
    };
    // 클라이언트 메시지 정제: user/assistant만 허용, 에러 메시지 제외, 개수·길이 제한
    const sanitizedMessages = messages
      .filter(
        (m) => (m.role === 'user' || m.role === 'assistant') && !m.error && typeof m.content === 'string',
      )
      .slice(-MAX_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT_LENGTH) }));

    if (sanitizedMessages.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty messages array' }, { status: 400 });
    }

    const messagesWithSystem = [{ role: systemMessage.role, content: systemMessage.content }, ...sanitizedMessages];

    // OpenAI Chat Completion 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messagesWithSystem as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: 500,
    });

    const aiResponse = completion.choices?.[0]?.message?.content;

    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    return NextResponse.json({ message: aiResponse });
  } catch (error) {
    console.error('[API /api/chat] OpenAI Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
