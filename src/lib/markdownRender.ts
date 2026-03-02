import type { Options as RemarkRehypeOptions } from 'remark-rehype'

/**
 * remark-rehype에 highlight(mdast) → mark(hast) 변환 핸들러 추가.
 * TipTap 형광펜(==text==)이 ReactMarkdown에서 <mark>로 렌더링되도록 함.
 */
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
      return state.applyData(node, result)
    },
  },
}
