'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthSession } from '@/components/AuthUserProvider'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, FileText, MessageSquare, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface PushMindSource {
  source_type: string
  source_id: string
  note_id: string | null
  similarity: number
  title?: string
}

export interface PushMindMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: PushMindSource[]
}

interface PushMindChatPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 상위에서 전달하면 페이지 이동 시에도 대화 유지 */
  messages?: PushMindMessage[]
  setMessages?: React.Dispatch<React.SetStateAction<PushMindMessage[]>>
  /** Pro/Team 등 하이브리드 플랜이면 true. true일 때 상단에 Hybrid 배지 표시 */
  isHybridPlan?: boolean
}

export default function PushMindChatPanel({
  open,
  onOpenChange,
  messages: messagesProp,
  setMessages: setMessagesProp,
  isHybridPlan = false,
}: PushMindChatPanelProps) {
  const session = useAuthSession()
  const router = useRouter()
  const [messagesLocal, setMessagesLocal] = useState<PushMindMessage[]>([])
  const messages = messagesProp ?? messagesLocal
  const setMessages = setMessagesProp ?? setMessagesLocal
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [ready, setReady] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const runSync = async () => {
    if (!session?.access_token || syncing) return
    setSyncing(true)
    try {
      const res = await fetch('/api/pushmind/embed', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        const count = data.chunks ?? 0
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              count > 0
                ? '무엇을 도와드릴까요?'
                : '아직 노트·커밋이 없어요. 기록을 추가한 뒤 PushMind를 다시 열어 주세요.',
            sources: [],
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.error ?? '동기화에 실패했어요. 잠시 후 다시 시도해 주세요.',
            sources: [],
          },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '동기화 요청 중 오류가 났어요.', sources: [] },
      ])
    } finally {
      setSyncing(false)
      setReady(true)
    }
  }

  useEffect(() => {
    if (open && session?.access_token) {
      runSync()
    }
  }, [open, session?.access_token])

  const handleSourceClick = (source: PushMindSource) => {
    onOpenChange(false)
    if (!source.note_id) return
    if (source.source_type === 'note') {
      router.push(`/notes/${source.note_id}`)
    } else {
      router.push(`/notes/${source.note_id}?openCommit=${source.source_id}`)
    }
  }

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [open, messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading || !session?.access_token) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const res = await fetch('/api/pushmind/chat', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: text }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg =
          data.error === 'limit_exceeded'
            ? data.message ?? '오늘 사용 한도를 초과했어요.'
            : data.error ?? '답변을 불러오지 못했어요.'
        setMessages((prev) => [...prev, { role: 'assistant', content: msg, sources: [] }])
        return
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer ?? '', sources: data.sources ?? [] },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '일시적인 오류가 났어요. 잠시 후 다시 시도해 주세요.', sources: [] },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-md"
        aria-labelledby="pushmind-title"
      >
        <SheetHeader className="shrink-0 border-b border-border pb-3">
          <SheetTitle id="pushmind-title" className="flex items-center gap-3 text-lg">
            <MessageSquare className="h-5 w-5 text-[#1F2A44]" aria-hidden />
            <span>PushMind</span>
            {isHybridPlan && (
              <Badge variant="outline">Hybrid</Badge>
            )}
          </SheetTitle>
          <p className="text-xs text-muted-foreground font-normal mt-0.5">
            기록이 만들어낸 또 하나의 브레인
          </p>
        </SheetHeader>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto py-4 space-y-4"
          role="log"
          aria-live="polite"
        >
          {messages.length > 0 &&
            messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-[#1F2A44] text-white'
                      : 'border border-border bg-muted/50 text-foreground'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  {m.role === 'assistant' && m.sources && m.sources.length > 0 ? (
                    <div className="mt-3 border-t border-border/50 pt-2">
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                              참고한 출처
                              <Info className="h-3 w-3 text-muted-foreground/70" aria-hidden />
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px] text-center">
                            질문과 해당 출처 내용 간의 관련도이며, 답변 정확도를 나타내지 않음
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <ul className="space-y-1 text-xs">
                        {m.sources.map((s, j) => (
                          <li key={j}>
                            {s.note_id ? (
                              <button
                                type="button"
                                onClick={() => handleSourceClick(s)}
                                className="flex items-center gap-1.5 text-left text-primary hover:underline"
                              >
                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                {s.source_type === 'note' ? '노트' : '커밋'}
                                {s.title ? `: ${s.title}` : ''}
                                {typeof s.similarity === 'number' && (
                                  <span className="text-muted-foreground">
                                    (질문과의 관련도 {(s.similarity * 100).toFixed(0)}%)
                                  </span>
                                )}
                              </button>
                            ) : (
                              <span className="text-muted-foreground">
                                {s.source_type === 'note' ? '노트' : '커밋'}
                                {s.title ? `: ${s.title}` : ''}
                                {typeof s.similarity === 'number' && (
                                  <> (질문과의 관련도 {(s.similarity * 100).toFixed(0)}%)</>
                                )}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          }
          {loading ? (
            <div className="flex justify-start">
              <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                검색하고 있어요...
              </div>
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="shrink-0 border-t border-border pt-3">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={syncing ? '동기화 중...' : '노트·커밋에 대해 물어보세요...'}
              className="min-h-[44px] max-h-32 resize-none"
              rows={2}
              disabled={loading || syncing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              aria-label="질문 입력"
            />
            <Button
              type="submit"
              size="icon"
              className="shrink-0 bg-[#1F2A44] hover:bg-[#1F2A44]/90"
              disabled={loading || syncing || !input.trim()}
              aria-label="전송"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
