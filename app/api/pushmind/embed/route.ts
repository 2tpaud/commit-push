/**
 * POST /api/pushmind/embed
 * PushMind RAG — 노트·커밋 청크 embedding 생성 및 embeddings 테이블 동기화
 * 설계: docs/PUSHMIND-RAG.md
 *
 * Body: { noteId?: string, commitId?: string } | {}
 * - 없음: 해당 사용자 전체 노트·커밋 동기화
 * - noteId: 해당 노트 + 하위 커밋만 동기화
 * - commitId: 해당 커밋 1건만 동기화
 *
 * 인증: 쿠키 세션 또는 Authorization: Bearer
 */

import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabaseServer'
import {
  buildChunks,
  buildCommitChunk,
  getEmbeddings,
  type ChunkRow,
  type NoteForChunk,
  type CommitForChunk,
} from '@/lib/pushmind'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

/** related_note_ids → 해당 노트 title 조회 후 맵 반환 */
async function fetchRelatedNoteTitles(
  db: SupabaseClient,
  userId: string,
  noteIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(noteIds)].filter(Boolean)
  if (unique.length === 0) return new Map()
  const { data } = await db
    .from('notes')
    .select('id, title')
    .eq('user_id', userId)
    .in('id', unique)
  const map = new Map<string, string>()
  const rows = (data ?? []) as { id: string; title: string | null }[]
  for (const row of rows) {
    map.set(row.id, row.title ?? '')
  }
  return map
}

async function getAuthUser(request: Request): Promise<{ id: string } | null> {
  const supabase = await createServerSupabase()
  let session = (await supabase.auth.getSession()).data.session
  let user = session?.user

  if (!user) {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (token && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      )
      const { data: { user: u } } = await client.auth.getUser()
      if (u) user = u
    }
  }

  return user ? { id: user.id } : null
}

export async function POST(request: Request) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }

  let body: { noteId?: string; commitId?: string } = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    // ignore
  }

  const supabaseAdmin = getServiceSupabase()
  const userId = user.id
  // 노트/커밋 조회는 서비스 롤로 수행 (이미 인증된 userId로 필터; API 라우트에서 쿠키 세션이 없을 수 있음)
  const db = supabaseAdmin

  try {
    if (body.commitId) {
      // 단일 커밋 동기화
      const { data: commit, error: commitErr } = await db
        .from('commits')
        .select('id, note_id, title, message, attachments, reference_urls, created_at')
        .eq('id', body.commitId)
        .eq('user_id', userId)
        .single()

      if (commitErr || !commit) {
        return NextResponse.json({ error: 'Commit not found' }, { status: 404 })
      }

      const commitForChunk: CommitForChunk = {
        id: commit.id,
        title: commit.title,
        message: commit.message,
        attachments: commit.attachments as { name?: string }[] | null,
        reference_urls: commit.reference_urls ?? null,
        created_at: commit.created_at ?? null,
      }
      const chunk = buildCommitChunk(commitForChunk, commit.note_id)
      const [vec] = await getEmbeddings([chunk.content_text])

      await supabaseAdmin.from('embeddings').delete().eq('user_id', userId).eq('source_id', commit.id)
      await supabaseAdmin.from('embeddings').insert({
        user_id: userId,
        source_type: chunk.source_type,
        source_id: chunk.source_id,
        note_id: chunk.note_id,
        chunk_index: chunk.chunk_index,
        content_text: chunk.content_text,
        embedding: vec,
      })

      return NextResponse.json({ ok: true, synced: 'commit', sourceId: commit.id })
    }

    if (body.noteId) {
      // 노트 1건 + 하위 커밋 동기화
      const { data: note, error: noteErr } = await db
        .from('notes')
        .select('id, title, description, status, category_large, category_medium, category_small, tags, reference_urls, related_note_ids, last_commit_at')
        .eq('id', body.noteId)
        .eq('user_id', userId)
        .single()

      if (noteErr || !note) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 })
      }

      const relatedIds = (note.related_note_ids ?? []) as string[]
      const titleMap = await fetchRelatedNoteTitles(db, userId, relatedIds)
      const relatedNoteTitles = relatedIds.map((id) => titleMap.get(id) ?? '').filter(Boolean)

      const { data: commits } = await db
        .from('commits')
        .select('id, title, message, attachments, reference_urls, created_at')
        .eq('note_id', note.id)
        .order('sequence', { ascending: true })

      const noteForChunk: NoteForChunk = {
        id: note.id,
        title: note.title,
        description: note.description,
        status: note.status ?? null,
        category_large: note.category_large ?? null,
        category_medium: note.category_medium ?? null,
        category_small: note.category_small ?? null,
        tags: note.tags ?? null,
        reference_urls: note.reference_urls ?? null,
        related_note_titles: relatedNoteTitles,
        last_commit_at: note.last_commit_at ?? null,
      }
      const commitsForChunk: CommitForChunk[] = (commits ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        message: c.message,
        attachments: c.attachments as { name?: string }[] | null,
        reference_urls: c.reference_urls ?? null,
        created_at: c.created_at ?? null,
      }))
      const chunks = buildChunks(noteForChunk, commitsForChunk)
      if (chunks.length === 0) {
        await supabaseAdmin
          .from('embeddings')
          .delete()
          .eq('user_id', userId)
          .or(`source_id.eq.${note.id},note_id.eq.${note.id}`)
        return NextResponse.json({ ok: true, synced: 'note', sourceId: note.id, chunks: 0 })
      }

      const vectors = await getEmbeddings(chunks.map((c) => c.content_text))
      await supabaseAdmin
        .from('embeddings')
        .delete()
        .eq('user_id', userId)
        .or(`source_id.eq.${note.id},note_id.eq.${note.id}`)

      const rows = chunks.map((c, i) => ({
        user_id: userId,
        source_type: c.source_type,
        source_id: c.source_id,
        note_id: c.note_id,
        chunk_index: c.chunk_index,
        content_text: c.content_text,
        embedding: vectors[i],
      }))
      await supabaseAdmin.from('embeddings').insert(rows)

      return NextResponse.json({ ok: true, synced: 'note', sourceId: note.id, chunks: rows.length })
    }

    // 전체 동기화
    const { data: notes, error: notesErr } = await db
      .from('notes')
      .select('id, title, description, status, category_large, category_medium, category_small, tags, reference_urls, related_note_ids, last_commit_at')
      .eq('user_id', userId)

    if (notesErr) {
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
    }

    const allRelatedIds = (notes ?? []).flatMap((n) => (n.related_note_ids ?? []) as string[])
    const relatedTitleMap = await fetchRelatedNoteTitles(db, userId, allRelatedIds)

    const allChunks: ChunkRow[] = []
    for (const note of notes ?? []) {
      const relatedIds = (note.related_note_ids ?? []) as string[]
      const relatedNoteTitles = relatedIds.map((id) => relatedTitleMap.get(id) ?? '').filter(Boolean)

      const { data: commits } = await db
        .from('commits')
        .select('id, title, message, attachments, reference_urls, created_at')
        .eq('note_id', note.id)
        .order('sequence', { ascending: true })

      const noteForChunk: NoteForChunk = {
        id: note.id,
        title: note.title,
        description: note.description,
        status: note.status ?? null,
        category_large: note.category_large ?? null,
        category_medium: note.category_medium ?? null,
        category_small: note.category_small ?? null,
        tags: note.tags ?? null,
        reference_urls: note.reference_urls ?? null,
        related_note_titles: relatedNoteTitles,
        last_commit_at: note.last_commit_at ?? null,
      }
      const commitsForChunk: CommitForChunk[] = (commits ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        message: c.message,
        attachments: c.attachments as { name?: string }[] | null,
        reference_urls: c.reference_urls ?? null,
        created_at: c.created_at ?? null,
      }))
      allChunks.push(...buildChunks(noteForChunk, commitsForChunk))
    }

    await supabaseAdmin.from('embeddings').delete().eq('user_id', userId)

    if (allChunks.length === 0) {
      return NextResponse.json({ ok: true, synced: 'all', chunks: 0 })
    }

    const batchSize = 100
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const slice = allChunks.slice(i, i + batchSize)
      const vectors = await getEmbeddings(slice.map((c) => c.content_text))
      const rows = slice.map((c, j) => ({
        user_id: userId,
        source_type: c.source_type,
        source_id: c.source_id,
        note_id: c.note_id,
        chunk_index: c.chunk_index,
        content_text: c.content_text,
        embedding: vectors[j],
      }))
      await supabaseAdmin.from('embeddings').insert(rows)
    }

    return NextResponse.json({ ok: true, synced: 'all', chunks: allChunks.length })
  } catch (err) {
    console.error('PushMind embed error:', err)
    const message = err instanceof Error ? err.message : 'Embedding sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
