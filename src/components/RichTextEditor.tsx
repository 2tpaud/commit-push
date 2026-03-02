'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Underline } from '@tiptap/extension-underline'
import { HighlightWithColor } from '@/extensions/HighlightWithColor'
import { TextAlign } from '@tiptap/extension-text-align'
import { Link } from '@tiptap/extension-link'
import { TaskList } from '@tiptap/extension-list/task-list'
import { TaskItem } from '@tiptap/extension-list/task-item'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import { NodeRange } from '@tiptap/extension-node-range'
import DragHandle from '@tiptap/extension-drag-handle'
import { useEffect, useRef, useState } from 'react'
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronDown,
  Type,
  Link as LinkIcon,
  CheckSquare,
  Undo2,
  Redo2,
  SeparatorHorizontal,
  Eraser,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { fixMarkdownInsideMarkTags } from '@/lib/markdownInMark'

interface RichTextEditorProps {
  value: string
  onChange: (value: string | undefined) => void
  placeholder?: string
  className?: string
  height?: number
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '내용을 입력하세요.',
  className,
  height = 200,
}: RichTextEditorProps) {
  const lastEmittedRef = useRef<string>(value)
  const isExternalUpdateRef = useRef(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Underline,
      HighlightWithColor.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      HorizontalRule,
      NodeRange,
      DragHandle.configure({
        render: () => {
          const el = document.createElement('div')
          el.className = 'rte-drag-handle'
          el.setAttribute('aria-hidden', 'true')
          el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>'
          return el
        },
        computePositionConfig: { placement: 'left-start', strategy: 'absolute' },
        nested: {
          edgeDetection: { threshold: -16 },
        },
      }),
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: fixMarkdownInsideMarkTags(value || ''),
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class:
          'rich-text-editor-body prose prose-sm max-w-none min-h-[120px] px-3 py-2 text-foreground focus:outline-none',
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor }) => {
      if (isExternalUpdateRef.current) return
      const md = editor.getMarkdown()
      lastEmittedRef.current = md
      onChange(md)
    },
  })

  useEffect(() => {
    if (!editor) return
    if (value === lastEmittedRef.current) return
    isExternalUpdateRef.current = true
    const content = fixMarkdownInsideMarkTags(value || '')
    editor.commands.setContent(content, { contentType: 'markdown' })
    lastEmittedRef.current = value || ''
    isExternalUpdateRef.current = false
  }, [editor, value])

  // 설명창 진입 시 선택 영역(드래그)처럼 잡히지 않고 바로 일반 커서로
  useEffect(() => {
    if (!editor) return
    const collapseSelection = () => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        editor.commands.setTextSelection(from)
      }
    }
    editor.on('focus', collapseSelection)
    return () => {
      editor.off('focus', collapseSelection)
    }
  }, [editor])

  if (!editor) {
    return (
      <div
        className={`rounded-lg border border-input bg-background ${className ?? ''}`}
        style={{ minHeight: height }}
      />
    )
  }

  return (
    <div
      className={`rich-text-editor-root flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-lg bg-background ${className ?? ''}`}
      style={height != null ? { height, minHeight: 160 } : { minHeight: 160 }}
    >
      <div
        className="flex min-w-0 flex-nowrap items-center gap-0.5 border-b border-border bg-muted/50 px-1.5 py-1"
        onMouseDown={(e) => e.preventDefault()}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn
                onClick={() => editor.chain().focus().undo().run()}
                isActive={false}
                disabled={!editor.can().undo()}
              >
                <Undo2 className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Undo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn
                onClick={() => editor.chain().focus().redo().run()}
                isActive={false}
                disabled={!editor.can().redo()}
              >
                <Redo2 className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Redo</TooltipContent>
        </Tooltip>
        <span className="mx-0.5 h-5 shrink-0 w-px bg-gray-300 dark:bg-gray-600" aria-hidden />
        <span className="inline-flex shrink-0">
          <HeadingDropdown editor={editor} />
        </span>
        <span className="inline-flex shrink-0">
          <ListDropdown editor={editor} />
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')}>
                <Code className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Inline code</TooltipContent>
        </Tooltip>
        <span className="mx-0.5 h-5 shrink-0 w-px bg-gray-300 dark:bg-gray-600" aria-hidden />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}>
                <Bold className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Bold</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}>
                <Italic className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Italic</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')}>
                <UnderlineIcon className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Underline</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')}>
                <Strikethrough className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Strike</TooltipContent>
        </Tooltip>
        <span className="inline-flex shrink-0">
          <HighlightDropdown editor={editor} />
        </span>
        <span className="mx-0.5 h-5 shrink-0 w-px bg-gray-300 dark:bg-gray-600" aria-hidden />
        <span className="inline-flex shrink-0">
          <LinkButton editor={editor} />
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')}>
                <Quote className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Blockquote</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')}>
                <Code className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Code Block</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} isActive={false}>
                <SeparatorHorizontal className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Horizontal rule</TooltipContent>
        </Tooltip>
        <span className="mx-0.5 h-5 shrink-0 w-px bg-gray-300 dark:bg-gray-600" aria-hidden />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })}>
                <AlignLeft className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Align left</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })}>
                <AlignCenter className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Align center</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })}>
                <AlignRight className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Align right</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <BubbleBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })}>
                <AlignJustify className="h-4 w-4" />
              </BubbleBtn>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Align justify</TooltipContent>
        </Tooltip>
      </div>
      <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto" data-rte-scroll-container>
        <EditorContent editor={editor} />
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .rich-text-editor-root [data-rte-scroll-container] > div { position: relative; }
            .rich-text-editor-root .ProseMirror { min-height: 100%; min-height: 120px; caret-color: currentColor; padding-left: 2rem; overflow-wrap: break-word; }
            .rte-drag-handle { width: 20px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: grab; color: #64748b; background: #f1f5f9; border-radius: 4px; z-index: 10; border: 1px solid #e2e8f0; pointer-events: auto; user-select: none; flex-shrink: 0; }
            .rte-drag-handle:hover { background: #e2e8f0; color: #475569; }
            .dark .rte-drag-handle { color: #94a3b8; background: #334155; border-color: #475569; }
            .dark .rte-drag-handle:hover { background: #475569; color: #cbd5e1; }
            .rte-drag-handle:active { cursor: grabbing; }
            .rte-drag-handle-dragging { opacity: 0.9; }
            .rich-text-editor-root .ProseMirror-focused { outline: none; }
            .rich-text-editor-root .ProseMirror::selection { background: #b4d5fe; }
            .rich-text-editor-root .ProseMirror *::selection { background: #b4d5fe; }
            .dark .rich-text-editor-root .ProseMirror::selection { background: #1e3a5f; }
            .dark .rich-text-editor-root .ProseMirror *::selection { background: #1e3a5f; }
            .rich-text-editor-root .ProseMirror p.is-editor-empty:first-child::before {
              content: attr(data-placeholder);
              float: left;
              color: var(--muted-foreground);
              pointer-events: none;
              height: 0;
            }
            .rich-text-editor-root .rich-text-editor-body h1 { font-size: 1.5rem; font-weight: 700; margin: 0.5em 0 0.25em; }
            .rich-text-editor-root .rich-text-editor-body h2 { font-size: 1.25rem; font-weight: 600; margin: 0.5em 0 0.25em; }
            .rich-text-editor-root .rich-text-editor-body h3 { font-size: 1.1rem; font-weight: 600; margin: 0.4em 0 0.2em; }
            .rich-text-editor-root .rich-text-editor-body blockquote {
              border-left: 4px solid #94a3b8;
              background: #f1f5f9;
              padding: 0.5rem 0 0.5rem 0.75rem;
              margin: 0.5em 0;
              color: #475569;
              border-radius: 0 4px 4px 0;
            }
            .dark .rich-text-editor-root .rich-text-editor-body blockquote {
              border-left-color: #64748b;
              background: #1e293b;
              color: #94a3b8;
            }
            .rich-text-editor-root .rich-text-editor-body code {
              background: #e2e8f0;
              color: #0f172a;
              padding: 0.15em 0.35em;
              border-radius: 4px;
              font-family: ui-monospace, monospace;
              font-size: 0.9em;
              border: 1px solid #cbd5e1;
            }
            .dark .rich-text-editor-root .rich-text-editor-body code {
              background: #334155;
              color: #e2e8f0;
              border-color: #475569;
            }
            .rich-text-editor-root .rich-text-editor-body pre {
              background: #e2e8f0;
              padding: 0.75rem 1rem;
              border-radius: 0.375rem;
              overflow-x: auto;
              margin: 0.5em 0;
              border: 1px solid #cbd5e1;
            }
            .dark .rich-text-editor-root .rich-text-editor-body pre {
              background: #334155;
              border-color: #475569;
            }
            .rich-text-editor-root .rich-text-editor-body pre code {
              background: transparent;
              padding: 0;
              border: none;
              color: inherit;
            }
            .rich-text-editor-root .rich-text-editor-body ul {
              list-style-type: disc;
              padding-left: 1.75rem;
              margin: 0.35em 0;
            }
            .rich-text-editor-root .rich-text-editor-body ul li {
              display: list-item;
              margin: 0.15em 0;
            }
            .rich-text-editor-root .rich-text-editor-body ul li::marker { color: #64748b; }
            .dark .rich-text-editor-root .rich-text-editor-body ul li::marker { color: #94a3b8; }
            .rich-text-editor-root .rich-text-editor-body ol {
              list-style-type: decimal;
              padding-left: 1.75rem;
              margin: 0.35em 0;
            }
            .rich-text-editor-root .rich-text-editor-body ol li { display: list-item; margin: 0.15em 0; }
            .rich-text-editor-root .rich-text-editor-body ol li::marker { color: #64748b; }
            .dark .rich-text-editor-root .rich-text-editor-body ol li::marker { color: #94a3b8; }
            .rich-text-editor-root .rich-text-editor-body mark {
              padding: 0.1em 0.2em;
              border-radius: 2px;
            }
            .dark .rich-text-editor-root .rich-text-editor-body mark {
              background: rgba(250, 204, 21, 0.35);
            }
            .rich-text-editor-root .rich-text-editor-body p[style*="text-align: center"],
            .rich-text-editor-root .rich-text-editor-body h1[style*="text-align: center"],
            .rich-text-editor-root .rich-text-editor-body h2[style*="text-align: center"],
            .rich-text-editor-root .rich-text-editor-body h3[style*="text-align: center"] { text-align: center; }
            .rich-text-editor-root .rich-text-editor-body p[style*="text-align: right"],
            .rich-text-editor-root .rich-text-editor-body h1[style*="text-align: right"],
            .rich-text-editor-root .rich-text-editor-body h2[style*="text-align: right"],
            .rich-text-editor-root .rich-text-editor-body h3[style*="text-align: right"] { text-align: right; }
            .rich-text-editor-root .rich-text-editor-body p[style*="text-align: justify"],
            .rich-text-editor-root .rich-text-editor-body h1[style*="text-align: justify"],
            .rich-text-editor-root .rich-text-editor-body h2[style*="text-align: justify"],
            .rich-text-editor-root .rich-text-editor-body h3[style*="text-align: justify"] { text-align: justify; }
            .rich-text-editor-root .rich-text-editor-body ul[data-type="taskList"] { list-style: none; padding-left: 0; }
            .rich-text-editor-root .rich-text-editor-body ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; margin: 0.25em 0; }
            .rich-text-editor-root .rich-text-editor-body ul[data-type="taskList"] li > label { flex-shrink: 0; margin-top: 0.2em; }
            .rich-text-editor-root .rich-text-editor-body ul[data-type="taskList"] li[data-checked="true"] .task-content { text-decoration: line-through; color: var(--muted-foreground); }
            .rich-text-editor-root .rich-text-editor-body h4 { font-size: 1rem; font-weight: 600; margin: 0.4em 0 0.2em; }
            .rich-text-editor-root .rich-text-editor-body a { color: #2563eb; text-decoration: underline; }
            .rich-text-editor-root .rich-text-editor-body a:hover { text-decoration: none; }
            .rich-text-editor-root .rich-text-editor-body hr {
              border: none;
              border-top: 1px solid #cbd5e1;
              margin: 1em 0;
            }
            .dark .rich-text-editor-root .rich-text-editor-body hr { border-top-color: #475569; }
            .rte-dropdown-menu button { cursor: pointer; border-radius: 2px; transition: background-color 0.15s; }
            .rte-dropdown-menu button:hover { background-color: #f3f4f6; }
            .dark .rte-dropdown-menu button:hover { background-color: #374151; }
            .rte-dropdown-trigger:hover { background-color: #f3f4f6 !important; }
            .dark .rte-dropdown-trigger:hover { background-color: #1f2937 !important; }
          `,
        }}
      />
    </div>
  )
}

const HIGHLIGHT_COLORS = [
  { name: '노랑', color: '#fef08a' },
  { name: '연한 초록', color: '#bbf7d0' },
  { name: '연한 파랑', color: '#bfdbfe' },
  { name: '연한 보라', color: '#e9d5ff' },
  { name: '연한 주황', color: '#fed7aa' },
]

function HighlightDropdown({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isActive = editor?.isActive('highlight') ?? false
  const currentColor = (editor?.getAttributes('highlight').color as string) || HIGHLIGHT_COLORS[0].color

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={containerRef} className="relative inline-flex">
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`flex h-7 min-w-[2rem] shrink-0 items-center justify-center gap-0.5 rounded-md border px-1.5 text-xs transition-colors hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-800 dark:active:bg-gray-700 ${
              open ? 'bg-gray-100 dark:bg-gray-800' : ''
            } ${
              isActive ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-transparent text-muted-foreground'
            }`}
            onClick={(e) => {
              e.preventDefault()
              setOpen((v) => !v)
            }}
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded border border-border"
              style={{ backgroundColor: currentColor }}
            />
            <ChevronDown className="h-4 w-4 opacity-70" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Highlight</TooltipContent>
      </Tooltip>
      {open && (
        <div className="rte-dropdown-menu absolute left-0 top-[calc(100%+4px)] z-50 w-fit min-w-0 rounded-md border border-border bg-white p-1 shadow-lg dark:bg-gray-900">
          {HIGHLIGHT_COLORS.map(({ color }) => (
            <button
              key={color}
              type="button"
              className="flex shrink-0 items-center justify-center rounded p-1 text-sm"
              onClick={(e) => {
                e.preventDefault()
                setOpen(false)
                editor?.chain().focus().setHighlight({ color }).run()
              }}
            >
              <span className="h-4 w-4 rounded border border-border" style={{ backgroundColor: color }} />
            </button>
          ))}
          <div className="my-0.5 border-t border-border" />
          <button
            type="button"
            className="flex w-full shrink-0 items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-gray-100 hover:text-foreground dark:hover:bg-gray-800"
            onClick={(e) => {
              e.preventDefault()
              setOpen(false)
              editor?.chain().focus().unsetHighlight().run()
            }}
            aria-label="형광펜 해제"
          >
            <Eraser className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function HeadingDropdown({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const level = editor?.isActive('heading', { level: 1 }) ? 1 : editor?.isActive('heading', { level: 2 }) ? 2 : editor?.isActive('heading', { level: 3 }) ? 3 : editor?.isActive('heading', { level: 4 }) ? 4 : 0
  const isActive = editor?.isActive('heading') ?? false

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const run = (fn: () => void) => {
    fn()
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative inline-flex">
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs transition-colors hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-800 dark:active:bg-gray-700 ${
              open ? 'bg-gray-100 dark:bg-gray-800' : ''
            } ${
              isActive ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-transparent text-muted-foreground'
            }`}
            onClick={(e) => {
              e.preventDefault()
              setOpen((v) => !v)
            }}
          >
            {level === 1 && <Heading1 className="h-4 w-4" />}
            {level === 2 && <Heading2 className="h-4 w-4" />}
            {level === 3 && <Heading3 className="h-4 w-4" />}
            {level === 4 && <Heading4 className="h-4 w-4" />}
            {level === 0 && <Type className="h-4 w-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Heading</TooltipContent>
      </Tooltip>
      {open && (
        <div className="rte-dropdown-menu absolute left-0 top-[calc(100%+4px)] z-50 min-w-[8rem] rounded-md border border-border bg-white py-1 shadow-lg dark:bg-gray-900">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-sm"
            onClick={(e) => {
              e.preventDefault()
              run(() => editor?.chain().focus().setParagraph().run())
            }}
          >
            <Type className="h-4 w-4" /> Paragraph
          </button>
          {([1, 2, 3, 4] as const).map((l) => (
            <button
              key={l}
              type="button"
              className="flex w-full items-center gap-2 px-2 py-1.5 text-sm"
              onClick={(e) => {
                e.preventDefault()
                run(() => editor?.chain().focus().toggleHeading({ level: l }).run())
              }}
            >
              {l === 1 && <Heading1 className="h-4 w-4" />}
              {l === 2 && <Heading2 className="h-4 w-4" />}
              {l === 3 && <Heading3 className="h-4 w-4" />}
              {l === 4 && <Heading4 className="h-4 w-4" />}
              Heading {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ListDropdown({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isBullet = editor?.isActive('bulletList') ?? false
  const isOrdered = editor?.isActive('orderedList') ?? false
  const isTask = editor?.isActive('taskList') ?? false
  const isActive = isBullet || isOrdered || isTask

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const run = (fn: () => void) => {
    fn()
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative inline-flex">
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs transition-colors hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-800 dark:active:bg-gray-700 ${
              open ? 'bg-gray-100 dark:bg-gray-800' : ''
            } ${
              isActive ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-transparent text-muted-foreground'
            }`}
            onClick={(e) => {
              e.preventDefault()
              setOpen((v) => !v)
            }}
          >
            {isTask && <CheckSquare className="h-4 w-4" />}
            {isBullet && !isTask && <List className="h-4 w-4" />}
            {isOrdered && <ListOrdered className="h-4 w-4" />}
            {!isBullet && !isOrdered && !isTask && <List className="h-4 w-4 opacity-70" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">List</TooltipContent>
      </Tooltip>
      {open && (
        <div className="rte-dropdown-menu absolute left-0 top-[calc(100%+4px)] z-50 min-w-[8rem] rounded-md border border-border bg-white py-1 shadow-lg dark:bg-gray-900">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-sm"
            onClick={(e) => {
              e.preventDefault()
              run(() => editor?.chain().focus().toggleBulletList().run())
            }}
          >
            <List className="h-4 w-4" /> Bullet list
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-sm"
            onClick={(e) => {
              e.preventDefault()
              run(() => editor?.chain().focus().toggleOrderedList().run())
            }}
          >
            <ListOrdered className="h-4 w-4" /> Ordered list
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-sm"
            onClick={(e) => {
              e.preventDefault()
              run(() => editor?.chain().focus().toggleTaskList().run())
            }}
          >
            <CheckSquare className="h-4 w-4" /> Task list
          </button>
        </div>
      )}
    </div>
  )
}

function normalizeLinkHref(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function LinkButton({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isLink = editor?.isActive('link') ?? false
  const currentHref = (editor?.getAttributes('link').href as string) ?? ''

  const applyLink = () => {
    if (!editor) return
    const href = url.trim() ? normalizeLinkHref(url) : ''
    setUrl('')
    setOpen(false)
    setTimeout(() => {
      if (href) {
        editor.chain().focus().setLink({ href }).run()
      } else {
        editor.chain().focus().unsetLink().run()
      }
    }, 0)
  }

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs transition-colors hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-800 dark:active:bg-gray-700 ${
              isLink ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-transparent text-muted-foreground'
            }`}
            onClick={(e) => {
              e.preventDefault()
              setOpen((v) => !v)
              setUrl(typeof currentHref === 'string' ? currentHref : '')
            }}
          >
            <LinkIcon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Link</TooltipContent>
      </Tooltip>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 flex flex-col gap-1.5 rounded-md border border-border bg-white p-2 shadow-lg dark:bg-gray-900">
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyLink()
              }
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="https://..."
            className="w-48 rounded border border-input bg-background px-2 py-1 text-sm"
          />
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
              onClick={(e) => {
                e.preventDefault()
                applyLink()
              }}
            >
              적용
            </button>
            {isLink && (
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={(e) => {
                  e.preventDefault()
                  setOpen(false)
                  setUrl('')
                  setTimeout(() => editor?.chain().focus().unsetLink().run(), 0)
                }}
              >
                제거
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BubbleBtn({
  onClick,
  isActive,
  children,
  disabled = false,
}: {
  onClick: () => void
  isActive: boolean
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs transition-colors hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-800 dark:active:bg-gray-700 disabled:pointer-events-none disabled:opacity-50 ${
        isActive ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-transparent text-muted-foreground'
      }`}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) onClick()
      }}
    >
      {children}
    </button>
  )
}
