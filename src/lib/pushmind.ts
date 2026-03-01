/**
 * PushMind RAG — embedding 생성 및 유사도 검색 헬퍼
 * 설계: docs/PUSHMIND-RAG.md
 */

import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'

export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536

/** OpenAI embedding 입력 토큰 상한 (모델별 상이, 여유 두고 8K 미만) */
const CHUNK_MAX_CHARS = 6000

export interface ChunkRow {
  source_type: 'note' | 'commit'
  source_id: string
  note_id: string | null
  chunk_index: number
  content_text: string
}

export interface MatchRow {
  id: string
  source_type: string
  source_id: string
  note_id: string | null
  content_text: string
  similarity: number
}

/**
 * 노트 1건 + 해당 커밋들로부터 RAG 청크 배열 생성.
 * 전략: 커밋 1건 = 1청크 (title + message). 노트 요약 청크 1건 추가(선택).
 */
export function buildChunks(
  note: { id: string; title: string; description: string | null },
  commits: { id: string; title: string; message: string | null }[],
  options: { includeNoteSummary?: boolean } = {}
): ChunkRow[] {
  const rows: ChunkRow[] = []
  const { includeNoteSummary = true } = options

  if (includeNoteSummary) {
    const noteText = [note.title, note.description].filter(Boolean).join('\n').trim()
    if (noteText) {
      rows.push({
        source_type: 'note',
        source_id: note.id,
        note_id: note.id,
        chunk_index: 0,
        content_text: truncateForEmbedding(noteText),
      })
    }
  }

  commits.forEach((c, i) => {
    const text = [c.title, c.message].filter(Boolean).join('\n').trim()
    if (text) {
      rows.push({
        source_type: 'commit',
        source_id: c.id,
        note_id: note.id,
        chunk_index: i,
        content_text: truncateForEmbedding(text),
      })
    }
  })

  return rows
}

/**
 * 커밋 1건만으로 청크 1개 생성 (단일 커밋 동기화용)
 */
export function buildCommitChunk(
  commit: { id: string; title: string; message: string | null },
  noteId: string
): ChunkRow {
  const text = [commit.title, commit.message].filter(Boolean).join('\n').trim()
  return {
    source_type: 'commit',
    source_id: commit.id,
    note_id: noteId,
    chunk_index: 0,
    content_text: truncateForEmbedding(text || commit.title || ' '),
  }
}

function truncateForEmbedding(s: string): string {
  if (s.length <= CHUNK_MAX_CHARS) return s
  return s.slice(0, CHUNK_MAX_CHARS)
}

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY is not set')
  if (!_openai) _openai = new OpenAI({ apiKey: key })
  return _openai
}

/**
 * 텍스트 1건에 대한 embedding 벡터 반환
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI()
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, CHUNK_MAX_CHARS),
  })
  const vec = res.data[0]?.embedding
  if (!vec || vec.length !== EMBEDDING_DIMENSIONS) {
    throw new Error('Unexpected embedding response')
  }
  return vec
}

/**
 * 여러 텍스트에 대해 한 번에 embedding 생성 (배치)
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const openai = getOpenAI()
  const input = texts.map((t) => t.slice(0, CHUNK_MAX_CHARS))
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  })
  const sorted = [...res.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  return sorted.map((d) => {
    const vec = d.embedding
    if (!vec || vec.length !== EMBEDDING_DIMENSIONS) throw new Error('Unexpected embedding response')
    return vec
  })
}

/**
 * 질문 embedding으로 유사도 상위 K개 청크 검색.
 * supabase는 service role 권장 (match_embeddings는 security definer).
 */
export async function searchSimilar(
  supabase: SupabaseClient,
  userId: string,
  queryEmbedding: number[],
  matchCount: number = 10
): Promise<MatchRow[]> {
  const { data, error } = await supabase.rpc('match_embeddings', {
    query_embedding: queryEmbedding,
    p_user_id: userId,
    match_count: matchCount,
  })
  if (error) throw error
  return (data ?? []) as MatchRow[]
}
