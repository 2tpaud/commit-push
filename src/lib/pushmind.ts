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

/** reference_urls 최대 개수 (청크 길이 제한) */
const REF_URLS_MAX = 3

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

/** 노트 청크용 입력 (하이브리드 확장) */
export interface NoteForChunk {
  id: string
  title: string
  description: string | null
  status?: string | null
  category_large?: string | null
  category_medium?: string | null
  category_small?: string | null
  tags?: string[] | null
  reference_urls?: string[] | null
  related_note_titles?: string[]
  last_commit_at?: string | null
}

/** 커밋 청크용 입력 (하이브리드 확장) */
export interface CommitForChunk {
  id: string
  title: string
  message: string | null
  attachments?: { name?: string }[] | null
  reference_urls?: string[] | null
  created_at?: string | null
}

function buildNoteContentText(note: NoteForChunk): string {
  const parts: string[] = [`[노트] ${note.title}`, note.description ?? '']
  const cat = [note.category_large, note.category_medium, note.category_small].filter(Boolean).join(' > ')
  if (cat) parts.push(`카테고리: ${cat}`)
  if (note.tags?.length) parts.push(`태그: ${note.tags.join(', ')}`)
  if (note.status) parts.push(`상태: ${note.status}`)
  if (note.related_note_titles?.length) parts.push(`연관 노트: ${note.related_note_titles.join(', ')}`)
  const urls = (note.reference_urls ?? []).slice(0, REF_URLS_MAX)
  if (urls.length) parts.push(`참고URL: ${urls.join(', ')}`)
  if (note.last_commit_at) {
    const d = new Date(note.last_commit_at)
    parts.push(`최종커밋: ${d.toISOString().slice(0, 10)}`)
  }
  return parts.filter(Boolean).join('\n').trim()
}

function buildCommitContentText(commit: CommitForChunk): string {
  const parts: string[] = [`[커밋] ${commit.title}`, commit.message ?? '']
  const names = (commit.attachments ?? []).map((a) => a?.name).filter(Boolean)
  if (names.length) parts.push(`첨부: ${names.join(', ')}`)
  const urls = (commit.reference_urls ?? []).slice(0, REF_URLS_MAX)
  if (urls.length) parts.push(`참고URL: ${urls.join(', ')}`)
  if (commit.created_at) {
    const d = new Date(commit.created_at)
    parts.push(`작성일: ${d.toISOString().slice(0, 16).replace('T', ' ')}`)
  }
  return parts.filter(Boolean).join('\n').trim()
}

/**
 * 노트 1건 + 해당 커밋들로부터 RAG 청크 배열 생성.
 * 하이브리드: 노트에 tags, category, status, 연관 노트, reference_urls 등 포함.
 * 커밋에 attachments(파일명), reference_urls, created_at 포함.
 */
export function buildChunks(
  note: NoteForChunk,
  commits: CommitForChunk[],
  options: { includeNoteSummary?: boolean } = {}
): ChunkRow[] {
  const rows: ChunkRow[] = []
  const { includeNoteSummary = true } = options

  if (includeNoteSummary) {
    const noteText = buildNoteContentText(note)
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
    const text = buildCommitContentText(c)
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
export function buildCommitChunk(commit: CommitForChunk, noteId: string): ChunkRow {
  const text = buildCommitContentText(commit)
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
