import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { Fragment } from '@tiptap/pm/model'

const DRAG_HANDLE_KEY = new PluginKey('rte-drag-handle')

/** pos가 속한 드래그 단위 블록: 문단/제목/수평선/코드블록은 그대로, 리스트·인용은 한 단위 */
function getDraggableBlockRange(view: EditorView, pos: number): { from: number; to: number } | null {
  const $pos = view.state.doc.resolve(pos)
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d)
    if (!node.isBlock) continue
    const parent = d > 1 ? $pos.node(d - 1) : null
    const parentType = parent?.type.name
    if (parentType === 'listItem' || parentType === 'taskItem' || parentType === 'blockquote') {
      return { from: $pos.before(d - 1), to: $pos.after(d - 1) }
    }
    return { from: $pos.before(d), to: $pos.after(d) }
  }
  return null
}

function draggableFromAtCoords(view: EditorView, x: number, y: number): number | null {
  const pos = view.posAtCoords({ left: x, top: y })
  if (pos == null) return null
  const range = getDraggableBlockRange(view, pos.pos)
  return range ? range.from : null
}

function blockFromAtCoords(view: EditorView, x: number, y: number): number | null {
  const pos = view.posAtCoords({ left: x, top: y })
  if (pos == null) return null
  const $pos = view.state.doc.resolve(pos.pos)
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).isBlock) return $pos.before(d)
  }
  return null
}

function listBoundaryAt(view: EditorView, from: number): number | null {
  const $pos = view.state.doc.resolve(from)
  for (let d = $pos.depth; d > 0; d--) {
    const name = $pos.node(d).type.name
    if (name === 'listItem' || name === 'taskItem') return $pos.before(d)
  }
  return null
}

function getScrollContainer(view: EditorView): HTMLElement | null {
  let el: Node | null = view.dom
  while (el && el !== document.body) {
    if (el instanceof HTMLElement && el.getAttribute('data-rte-scroll-container') !== null) return el
    el = el.parentNode
  }
  return null
}

export const DragHandleExtension = Extension.create({
  name: 'rteDragHandle',

  addProseMirrorPlugins() {
    let handleEl: HTMLDivElement | null = null
    let dragFrom = 0
    let dragTo = 0
    let dragBlockKind: string | null = null
    let dragListWrapper: string | null = null

    function ensureHandle(view: EditorView): HTMLDivElement {
      const container = getScrollContainer(view)
      if (handleEl && container && handleEl.parentNode === container && document.contains(container)) return handleEl
      if (handleEl?.parentNode) handleEl.remove()
      if (!handleEl) {
        handleEl = document.createElement('div')
        handleEl.className = 'rte-drag-handle'
        handleEl.setAttribute('draggable', 'true')
        handleEl.setAttribute('aria-hidden', 'true')
        handleEl.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>'
        handleEl.addEventListener('dragstart', (e: DragEvent) => {
          const from = handleEl?.dataset.blockFrom
          const to = handleEl?.dataset.blockTo
          if (from == null || to == null) return
          const f = Number(from)
          const t = Number(to)
          e.dataTransfer?.setData('text/plain', '')
          e.dataTransfer?.setData('application/x-rte-drag', `${f}:${t}`)
          e.dataTransfer?.setData('application/x-rte-drag-meta', JSON.stringify({
            kind: handleEl?.dataset.blockKind ?? null,
            wrapper: handleEl?.dataset.listWrapper ?? null,
          }))
          e.dataTransfer!.effectAllowed = 'move'
          dragFrom = f
          dragTo = t
          dragBlockKind = handleEl?.dataset.blockKind ?? null
          dragListWrapper = handleEl?.dataset.listWrapper ?? null
          handleEl?.classList.add('rte-drag-handle-dragging')
        })
        handleEl.addEventListener('dragend', () => {
          handleEl?.classList.remove('rte-drag-handle-dragging')
          dragFrom = 0
          dragTo = 0
          dragBlockKind = null
          dragListWrapper = null
        })
      }
      if (container) {
        if (!container.classList.contains('rte-drag-handle-wrapper')) {
          container.classList.add('rte-drag-handle-wrapper')
        }
        container.appendChild(handleEl)
      }
      return handleEl
    }

    return [
      new Plugin({
        key: DRAG_HANDLE_KEY,
        view(editorView) {
          let lastFrom: number | null = null
          let rafId = 0
          let scrollListener: (() => void) | null = null

          function placeHandleAtBlock() {
            if (lastFrom == null || !handleEl) return
            const container = getScrollContainer(editorView)
            if (!container || handleEl.style.display === 'none') return
            const range = getDraggableBlockRange(editorView, lastFrom)
            if (!range) return
            const blockDom = editorView.nodeDOM(range.from) as HTMLElement | null
            let left: number
            let top: number
            if (blockDom && blockDom.getBoundingClientRect) {
              const rect = blockDom.getBoundingClientRect()
              const cr = container.getBoundingClientRect()
              left = rect.left - cr.left + container.scrollLeft - 22
              top = rect.top - cr.top + container.scrollTop
            } else {
              const coords = editorView.coordsAtPos(range.from)
              const cr = container.getBoundingClientRect()
              left = coords.left - cr.left + container.scrollLeft - 22
              top = coords.top - cr.top + container.scrollTop
            }
            handleEl.style.left = `${Math.max(2, left)}px`
            handleEl.style.top = `${top}px`
          }

          function updateHandle(clientX: number, clientY: number) {
            const from = draggableFromAtCoords(editorView, clientX, clientY)
            if (from === lastFrom) return
            lastFrom = from

            const el = ensureHandle(editorView)
            const container = getScrollContainer(editorView)
            if (from == null || !container) {
              el.style.display = 'none'
              delete el.dataset.blockFrom
              delete el.dataset.blockTo
              delete el.dataset.blockKind
              delete el.dataset.listWrapper
              return
            }

            const range = getDraggableBlockRange(editorView, from)
            if (!range) return
            el.dataset.blockFrom = String(range.from)
            el.dataset.blockTo = String(range.to)
            const doc = editorView.state.doc
            const node = doc.nodeAt(range.from)
            el.dataset.blockKind = node ? node.type.name : ''
            el.dataset.listWrapper = ''
            const $ = doc.resolve(range.from)
            for (let d = $.depth; d > 0; d--) {
              const name = $.node(d).type.name
              if (name === 'bulletList' || name === 'orderedList' || name === 'taskList') {
                el.dataset.listWrapper = name
                break
              }
            }

            el.style.display = 'flex'
            el.style.position = 'absolute'
            placeHandleAtBlock()

            if (!scrollListener) {
              scrollListener = () => placeHandleAtBlock()
              container.addEventListener('scroll', scrollListener)
            }
          }

          function onMouseMove(e: MouseEvent) {
            if (handleEl && (e.target === handleEl || handleEl.contains(e.target as Node))) return
            if (!editorView.dom.contains(e.target as Node)) {
              if (lastFrom != null) {
                lastFrom = null
                const el = ensureHandle(editorView)
                el.style.display = 'none'
                delete el.dataset.blockFrom
                delete el.dataset.blockTo
                delete el.dataset.blockKind
                delete el.dataset.listWrapper
              }
              return
            }
            if (rafId) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => {
              rafId = 0
              updateHandle(e.clientX, e.clientY)
            })
          }

          const editorRect = () => editorView.dom.getBoundingClientRect()
          const isInside = (e: DragEvent) => {
            const r = editorRect()
            return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
          }

          function onDragOver(e: DragEvent) {
            if (e.dataTransfer?.types.includes('application/x-rte-drag')) {
              if (isInside(e)) {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }
            }
          }

          function onDrop(e: DragEvent) {
            if (!e.dataTransfer?.types.includes('application/x-rte-drag')) return
            if (!isInside(e)) return
            e.preventDefault()
            e.stopPropagation()

            const raw = e.dataTransfer.getData('application/x-rte-drag')
            const [fromStr, toStr] = raw ? raw.split(':').map(Number) : [0, 0]
            const dragFromVal = fromStr
            const dragToVal = toStr
            if (dragToVal <= dragFromVal) return

            const targetFrom = blockFromAtCoords(editorView, e.clientX, e.clientY)
            if (targetFrom == null) return
            if (targetFrom >= dragFromVal && targetFrom < dragToVal) return

            const state = editorView.state
            const { doc, schema } = state
            const slice = doc.slice(dragFromVal, dragToVal)

            const listBoundary = listBoundaryAt(editorView, targetFrom)
            const insertPosInDoc = listBoundary ?? targetFrom

            let insertPos = insertPosInDoc
            if (insertPos > dragFromVal) insertPos -= dragToVal - dragFromVal
            if (insertPos < 0) return
            if (insertPos === dragFromVal) return

            let content: Fragment = slice.content
            const inList = listBoundary != null
            const metaRaw = e.dataTransfer.getData('application/x-rte-drag-meta')
            let kind: string | null = null
            let wrapper: string | null = null
            try {
              if (metaRaw) {
                const meta = JSON.parse(metaRaw) as { kind?: string; wrapper?: string }
                kind = meta.kind ?? null
                wrapper = meta.wrapper ?? null
              }
            } catch (_) {}
            if (!kind) kind = dragBlockKind
            if (!wrapper) wrapper = dragListWrapper

            if (kind === 'listItem' || kind === 'taskItem') {
              if (!inList) {
                const Wrapper = schema.nodes[wrapper || 'bulletList']
                if (Wrapper) content = Fragment.from(Wrapper.create(null, slice.content))
              }
            } else if (inList) {
              const $ = doc.resolve(targetFrom)
              let itemName = 'listItem'
              for (let d = $.depth; d > 0; d--) {
                const name = $.node(d).type.name
                if (name === 'listItem' || name === 'taskItem') {
                  itemName = name
                  break
                }
              }
              const Item = schema.nodes[itemName]
              if (Item) content = Fragment.from(Item.create(null, slice.content))
            }

            try {
              const tr = state.tr.delete(dragFromVal, dragToVal).insert(insertPos, content)
              if (tr.doc) editorView.dispatch(tr)
            } catch (_) {}
          }

          ensureHandle(editorView)
          if (handleEl) handleEl.style.display = 'none'
          editorView.dom.addEventListener('mousemove', onMouseMove)
          document.addEventListener('dragover', onDragOver, true)
          document.addEventListener('drop', onDrop, true)

          return {
            destroy() {
              editorView.dom.removeEventListener('mousemove', onMouseMove)
              document.removeEventListener('dragover', onDragOver, true)
              document.removeEventListener('drop', onDrop, true)
              const container = getScrollContainer(editorView)
              if (container && scrollListener) container.removeEventListener('scroll', scrollListener)
              scrollListener = null
              if (rafId) cancelAnimationFrame(rafId)
              handleEl?.remove()
              handleEl = null
            },
          }
        },
      }),
    ]
  },
})
