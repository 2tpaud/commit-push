'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

interface Note {
  id: string
  title: string
  category_large: string | null
  category_medium: string | null
  category_small: string | null
  tags: string[] | null
}

export default function NewNotePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  // 폼 데이터
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryLarge, setCategoryLarge] = useState('')
  const [categoryMedium, setCategoryMedium] = useState('')
  const [categorySmall, setCategorySmall] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [relatedNoteIds, setRelatedNoteIds] = useState<string[]>([])
  
  // 드롭다운 옵션 데이터
  const [existingNotes, setExistingNotes] = useState<Note[]>([])
  const [categoryLargeOptions, setCategoryLargeOptions] = useState<string[]>([])
  const [categoryMediumOptions, setCategoryMediumOptions] = useState<string[]>([])
  const [categorySmallOptions, setCategorySmallOptions] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/')
        return
      }
      setUser(session.user)
      setLoading(false)
      loadExistingData(session.user.id)
    })
  }, [router])

  const loadExistingData = async (userId: string) => {
    const { data, error } = await supabase
      .from('notes')
      .select('id, title, category_large, category_medium, category_small, tags')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading notes:', error)
      return
    }

    if (data) {
      setExistingNotes(data)
      
      // 카테고리 옵션 추출
      const largeSet = new Set<string>()
      const mediumSet = new Set<string>()
      const smallSet = new Set<string>()
      const tagsSet = new Set<string>()

      data.forEach((note) => {
        if (note.category_large) largeSet.add(note.category_large)
        if (note.category_medium) mediumSet.add(note.category_medium)
        if (note.category_small) smallSet.add(note.category_small)
        if (note.tags && note.tags.length > 0) {
          note.tags.forEach((tag: string) => tagsSet.add(tag))
        }
      })

      setCategoryLargeOptions(Array.from(largeSet).sort())
      setCategoryMediumOptions(Array.from(mediumSet).sort())
      setCategorySmallOptions(Array.from(smallSet).sort())
      setAllTags(Array.from(tagsSet).sort())
    }
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !title.trim()) return

    setSubmitting(true)

    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        category_large: categoryLarge || null,
        category_medium: categoryMedium || null,
        category_small: categorySmall || null,
        tags: tags.length > 0 ? tags : null,
        related_note_ids: relatedNoteIds.length > 0 ? relatedNoteIds : null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating note:', error)
      alert('노트 생성에 실패했습니다.')
      setSubmitting(false)
      return
    }

    router.push(`/notes/${data.id}`)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-semibold text-card-foreground">
            CommitPush
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
            <button
              onClick={() => router.push('/')}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              홈으로
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-foreground">
              새 노트 생성
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    제목 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="노트 제목을 입력하세요"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    설명
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="노트에 대한 간단한 설명을 입력하세요"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-medium text-foreground">
                카테고리
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    대분류
                  </label>
                  <select
                    value={categoryLarge}
                    onChange={(e) => {
                      setCategoryLarge(e.target.value)
                      setCategoryMedium('')
                      setCategorySmall('')
                    }}
                    className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">선택 안함</option>
                    {categoryLargeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="새 대분류 입력"
                    value={categoryLarge && !categoryLargeOptions.includes(categoryLarge) ? categoryLarge : ''}
                    onChange={(e) => setCategoryLarge(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    중분류
                  </label>
                  <select
                    value={categoryMedium}
                    onChange={(e) => {
                      setCategoryMedium(e.target.value)
                      setCategorySmall('')
                    }}
                    className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">선택 안함</option>
                    {categoryMediumOptions
                      .filter((opt) => !categoryLarge || existingNotes.some((n) => n.category_large === categoryLarge && n.category_medium === opt))
                      .map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                  </select>
                  <input
                    type="text"
                    placeholder="새 중분류 입력"
                    value={categoryMedium && !categoryMediumOptions.includes(categoryMedium) ? categoryMedium : ''}
                    onChange={(e) => setCategoryMedium(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    소분류
                  </label>
                  <select
                    value={categorySmall}
                    onChange={(e) => setCategorySmall(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">선택 안함</option>
                    {categorySmallOptions
                      .filter((opt) => {
                        if (!categoryMedium) return true
                        return existingNotes.some(
                          (n) => n.category_medium === categoryMedium && n.category_small === opt
                        )
                      })
                      .map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                  </select>
                  <input
                    type="text"
                    placeholder="새 소분류 입력"
                    value={categorySmall && !categorySmallOptions.includes(categorySmall) ? categorySmall : ''}
                    onChange={(e) => setCategorySmall(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-medium text-foreground">
                태그
              </h3>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddTag()
                      }
                    }}
                    placeholder="태그 입력 후 Enter"
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    추가
                  </button>
                </div>
                {allTags.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm text-muted-foreground">
                      기존 태그에서 선택:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            if (!tags.includes(tag)) {
                              setTags([...tags, tag])
                            }
                          }}
                          className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground transition-colors hover:bg-secondary/80"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {tags.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm text-muted-foreground">
                      선택된 태그:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 hover:text-primary-foreground/80"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-medium text-foreground">
                연관 노트
              </h3>
              <select
                multiple
                value={relatedNoteIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (option) => option.value)
                  setRelatedNoteIds(selected)
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-black focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                size={5}
              >
                {existingNotes.map((note) => (
                  <option key={note.id} value={note.id}>
                    {note.title}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Ctrl(Windows) 또는 Cmd(Mac)를 누른 채로 여러 개 선택할 수 있습니다.
              </p>
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="rounded-lg border border-input bg-background px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
              >
                {submitting ? '생성 중...' : '노트 생성'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
