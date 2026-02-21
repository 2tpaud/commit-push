import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    // 참고: public.users 테이블 프로필은 트리거로 자동 생성됩니다.
    // 트리거가 설정되지 않은 경우에만 아래 코드가 필요합니다.
    // 트리거 설정 방법: docs/DATABASE_SETUP.md 참고
    if (!error && data.user) {
      // 트리거가 없을 경우를 대비한 폴백 (RLS 정책 때문에 실패할 수 있음)
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: data.user.id,
          email: data.user.email || '',
          full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || null,
          avatar_url: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        })

      if (profileError) {
        console.warn('User profile creation failed (trigger should handle this):', profileError)
      }
    }
    return NextResponse.redirect(requestUrl.origin)
  }

  // 이메일 매직 링크: 해시(#access_token=...)는 서버에 전달되지 않으므로
  // 클라이언트에서 해시를 유지한 채 origin으로 이동시킴
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>window.location.replace("${requestUrl.origin}" + window.location.hash);</script><p>로그인 처리 중...</p></body></html>`
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
