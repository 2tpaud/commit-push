import type { ElementContent } from 'hast'
import type { Options as RemarkRehypeOptions } from 'remark-rehype'

/** blockquote, hr, text-align 등 공통 prose 스타일 (제목·목록·인용·구분선·정렬) */
export const proseBlockquoteHrAlign = [
  /* 인용 blockquote */
  '[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:bg-muted/50 [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:my-2 [&_blockquote]:rounded-r [&_blockquote]:text-muted-foreground',
  /* 구분선 hr */
  '[&_hr]:border-t [&_hr]:border-border [&_hr]:my-4 [&_hr]:border-solid',
  /* 정렬: p, h1~h6 */
  '[&_p[style*="text-align:center"]]:text-center [&_p[style*="text-align:right"]]:text-right [&_p[style*="text-align:justify"]]:text-justify',
  '[&_h1[style*="text-align:center"]]:text-center [&_h2[style*="text-align:center"]]:text-center [&_h3[style*="text-align:center"]]:text-center [&_h4[style*="text-align:center"]]:text-center [&_h5[style*="text-align:center"]]:text-center [&_h6[style*="text-align:center"]]:text-center',
  '[&_h1[style*="text-align:right"]]:text-right [&_h2[style*="text-align:right"]]:text-right [&_h3[style*="text-align:right"]]:text-right [&_h4[style*="text-align:right"]]:text-right [&_h5[style*="text-align:right"]]:text-right [&_h6[style*="text-align:right"]]:text-right',
  '[&_h1[style*="text-align:justify"]]:text-justify [&_h2[style*="text-align:justify"]]:text-justify [&_h3[style*="text-align:justify"]]:text-justify [&_h4[style*="text-align:justify"]]:text-justify [&_h5[style*="text-align:justify"]]:text-justify [&_h6[style*="text-align:justify"]]:text-justify',
  /* 제목 기본 스타일 */
  '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-2',
  '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2',
  '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1',
  '[&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1',
  '[&_h5]:text-sm [&_h5]:font-semibold [&_h5]:mt-2 [&_h5]:mb-1',
  '[&_h6]:text-sm [&_h6]:font-medium [&_h6]:mt-2 [&_h6]:mb-1 [&_h6]:text-muted-foreground',
  /* 목록 ul/ol */
  '[&_ul]:list-inside [&_ul]:list-disc [&_ul]:my-2 [&_ul]:space-y-1',
  '[&_ol]:list-inside [&_ol]:list-decimal [&_ol]:my-2 [&_ol]:space-y-1',
  '[&_li]:my-0.5',
].join(' ')

/** remark-highlight-mark의 highlight 노드를 <mark>로 렌더링 */
export const remarkRehypeOptions: RemarkRehypeOptions = {
  handlers: {
    highlight(state, node) {
      const result = {
        type: 'element' as const,
        tagName: 'mark' as const,
        properties: {},
        children: state.all(node),
      }
      state.patch(node, result)
      return state.applyData(node, result) as ElementContent
    },
  },
}
