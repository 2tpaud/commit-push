import { marked } from 'marked'

/**
 * <mark> 태그 안의 마크다운(**, *** 등)을 HTML로 변환.
 * 저장 시 <mark>**text**</mark> 형태로 저장되면, 로드 시 **가 그대로 보이는 문제 해결.
 */
export function fixMarkdownInsideMarkTags(content: string): string {
  if (!content.includes('<mark')) return content
  return content.replace(/<mark([^>]*)>([\s\S]*?)<\/mark>/g, (_match, attrs, inner) => {
    const trimmed = inner.trim()
    if (!trimmed) return `<mark${attrs}></mark>`
    let html = marked.parse(trimmed, { async: false }) as string
    html = html.replace(/^\s*<p>|<\/p>\s*$/g, '')
    return `<mark${attrs}>${html}</mark>`
  })
}
