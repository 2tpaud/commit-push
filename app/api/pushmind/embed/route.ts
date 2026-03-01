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
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabaseServer'
import {
  buildChunks,
  buildCommitChunk,
  getEmbeddings,
  type ChunkRow,
} from '@/lib/pushmind'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role not configured')
  return createClient(url, key)
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
        .select('id, note_id, title, message')
        .eq('id', body.commitId)
        .eq('user_id', userId)
        .single()

      if (commitErr || !commit) {
        return NextResponse.json({ error: 'Commit not found' }, { status: 404 })
      }

      const chunk = buildCommitChunk(
        { id: commit.id, title: commit.title, message: commit.message },
        commit.note_id
      )
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
        .select('id, title, description')
        .eq('id', body.noteId)
        .eq('user_id', userId)
        .single()

      if (noteErr || !note) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 })
      }

      const { data: commits } = await db
        .from('commits')
        .select('id, title, message')
        .eq('note_id', note.id)
        .order('sequence', { ascending: true })

      const chunks = buildChunks(
        { id: note.id, title: note.title, description: note.description },
        commits ?? []
      )
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
      .select('id, title, description')
      .eq('user_id', userId)

    if (notesErr) {
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
    }

    const allChunks: ChunkRow[] = []
    for (const note of notes ?? []) {
      const { data: commits } = await db
        .from('commits')
        .select('id, title, message')
        .eq('note_id', note.id)
        .order('sequence', { ascending: true })
      allChunks.push(
        ...buildChunks(
          { id: note.id, title: note.title, description: note.description },
          commits ?? []
        )
      )
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
