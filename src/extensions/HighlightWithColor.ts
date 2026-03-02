import Highlight from '@tiptap/extension-highlight'

/** 색상 정보를 마크다운에 HTML로 저장하여 렌더 시 동일 색상 표시 */
export const HighlightWithColor = Highlight.extend({
  renderMarkdown(node, h) {
    const color = node.attrs?.color as string | undefined
    const children = h.renderChildren(node)
    if (color) {
      const escaped = color.replace(/"/g, '&quot;')
      return `<mark data-color="${escaped}" style="background-color:${escaped};color:inherit">${children}</mark>`
    }
    return `==${children}==`
  },
})
