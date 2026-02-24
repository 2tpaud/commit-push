'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Underline } from '@tiptap/extension-underline'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { Link } from '@tiptap/extension-link'
import { TaskList } from '@tiptap/extension-list/task-list'
import { TaskItem } from '@tiptap/extension-list/task-item'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
} from 'lucide-react'

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
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: value || '',
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
    editor.commands.setContent(value || '', { contentType: 'markdown' })
    lastEmittedRef.current = value || ''
    isExternalUpdateRef.current = false
  }, [editor, value])

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
      className={`rich-text-editor-root flex h-full flex-col overflow-hidden rounded-lg bg-background ${className ?? ''}`}
      style={height != null ? { height, minHeight: 160 } : { minHeight: 160 }}
    >
      <div
        className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/50 px-1.5 py-1"
        onMouseDown={(e) => e.preventDefault()}
      >
        <BubbleBtn
          onClick={() => editor.chain().focus().undo().run()}
          isActive={false}
          title="실행 취소 (Undo)"
          disabled={!editor.can().undo()}
        >
          <Undo2 className="h-4 w-4" />
        </BubbleBtn>
        <BubbleBtn
          onClick={() => editor.chain().focus().redo().run()}
          isActive={false}
          title="다시 실행 (Redo)"
          disabled={!editor.can().redo()}
        >
          <Redo2 className="h-4 w-4" />
        </BubbleBtn>
        <span className="mx-0.5 h-4 shrink-0 w-px bg-border" />
        <BubbleBtn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="굵게">
          <Bold className="h-4 w-4" />
        </BubbleBtn>
        <BubbleBtn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="기울임">
          <Italic className="h-4 w-4" />
        </BubbleBtn>
        <BubbleBtn onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="밑줄">
          <UnderlineIcon className="h-4 w-4" />
        </BubbleBtn>
        <BubbleBtn onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="취소선">
          <Strikethrough className="h-4 w-4" />
        </BubbleBtn>
        <HighlightDropdown editor={editor} />
        <BubbleBtn onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="인라인 코드">
          <Code className="h-4 w-4" />
        </BubbleBtn>
        <span className="mx-0.5 h-4 shrink-0 w-px bg-border" />
        <HeadingDropdown editor={editor} />
        <span className="mx-0.5 h-4 shrink-0 w-px bg-border" />
        <ListDropdown editor={editor} />
        <LinkButton editor={editor} />
        <BubbleBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="인용">
          <Quote className="h-4 w-4" />
        </BubbleBtn>
        <BubbleBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="코드 블록">
          <Code className="h-4 w-4" />
        </BubbleBtn>
        <span className="mx-0.5 h-4 shrink-0 w-px bg-border" />
        <BubbleBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="왼쪽 정렬">
          <AlignLeft className="h-4 w-4" />
        </BubbleBtn>
        <BubbleBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="가운데 정렬">
          <AlignCenter className="h-4 w-4" />
        </BubbleBtn>
        <BubbleBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="오른쪽 정렬">
          <AlignRight className="h-4 w-4" />
        </BubbleBtn>
        <BubbleBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title="양쪽 정렬">
          <AlignJustify className="h-4 w-4" />
        </BubbleBtn>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .rich-text-editor-root .ProseMirror { min-height: 100%; min-height: 120px; }
            .rich-text-editor-root .ProseMirror-focused { outline: none; }
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

function InlineDropdown({
  trigger,
  children,
  open,
  onOpenChange,
  placement = 'below',
}: {
  trigger: React.ReactNode
  children: React.ReactNode
  open: boolean
  onOpenChange: (v: boolean) => void
  placement?: 'above' | 'below'
}) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({
      left: rect.left,
      top: placement === 'below' ? rect.bottom + 4 : rect.top - 8,
    })
  }, [open, placement])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      onOpenChange(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open, onOpenChange])

  const menuEl = open && (
    <div
      ref={menuRef}
      className="fixed z-[99999] min-w-[8rem] rounded-md border border-border bg-white py-1 shadow-lg dark:bg-gray-900"
      style={{ left: position.left, top: position.top }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>
  )

  return (
    <div className="relative" ref={triggerRef}>
      <div onMouseDown={(e) => e.preventDefault()} onClick={() => onOpenChange(!open)}>
        {trigger}
      </div>
      {typeof document !== 'undefined' && menuEl && createPortal(menuEl, document.body)}
    </div>
  )
}

function HighlightDropdown({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false)
  const isActive = editor?.isActive('highlight') ?? false
  const currentColor = (editor?.getAttributes('highlight').color as string) || HIGHLIGHT_COLORS[0].color
  return (
    <InlineDropdown open={open} onOpenChange={setOpen} placement="below" trigger={
      <button
        type="button"
        title="형광펜"
        className={`flex h-7 min-w-[2rem] shrink-0 items-center justify-center gap-0.5 rounded-md border px-1.5 text-xs transition-colors hover:bg-muted active:bg-muted/80 ${
          isActive ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-transparent text-muted-foreground'
        }`}
      >
        <span className="flex h-4 w-4 items-center justify-center rounded border border-border" style={{ backgroundColor: currentColor }} />
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
    }>
      {HIGHLIGHT_COLORS.map(({ name, color }) => (
        <button
          key={color}
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted"
          onMouseDown={(e) => {
            e.preventDefault()
            editor?.chain().focus().setHighlight({ color }).run()
            setOpen(false)
          }}
        >
          <span className="h-4 w-4 rounded border border-border" style={{ backgroundColor: color }} />
          {name}
        </button>
      ))}
    </InlineDropdown>
  )
}

function HeadingDropdown({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false)
  const level = editor?.isActive('heading', { level: 1 }) ? 1 : editor?.isActive('heading', { level: 2 }) ? 2 : editor?.isActive('heading', { level: 3 }) ? 3 : editor?.isActive('heading', { level: 4 }) ? 4 : 0
  const label = level === 0 ? '본문' : `제목 ${level}`
  const isActive = (editor?.isActive('heading') ?? false)
  const trigger = (
    <button
      type="button"
      title="제목"
      className={`flex h-7 min-w-[3.5rem] shrink-0 items-center justify-center gap-0.5 rounded-md border px-1.5 text-xs transition-colors hover:bg-muted active:bg-muted/80 ${
        isActive ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-transparent text-muted-foreground'
      }`}
    >
      {level === 1 && <Heading1 className="h-4 w-4" />}
      {level === 2 && <Heading2 className="h-4 w-4" />}
      {level === 3 && <Heading3 className="h-4 w-4" />}
      {level === 4 && <Heading4 className="h-4 w-4" />}
      {level === 0 && <Type className="h-4 w-4" />}
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
  const run = (fn: () => void) => {
    fn()
    setOpen(false)
  }
  return (
    <InlineDropdown open={open} onOpenChange={setOpen} trigger={trigger} placement="below">
      <button type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted" onMouseDown={(e) => { e.preventDefault(); run(() => editor?.chain().focus().setParagraph().run()) }}>
        <Type className="h-4 w-4" /> 본문
      </button>
      {([1, 2, 3, 4] as const).map((l) => (
        <button key={l} type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted" onMouseDown={(e) => { e.preventDefault(); run(() => editor?.chain().focus().toggleHeading({ level: l }).run()) }}>
          {l === 1 && <Heading1 className="h-4 w-4" />}
          {l === 2 && <Heading2 className="h-4 w-4" />}
          {l === 3 && <Heading3 className="h-4 w-4" />}
          {l === 4 && <Heading4 className="h-4 w-4" />}
          제목 {l}
        </button>
      ))}
    </InlineDropdown>
  )
}

function ListDropdown({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false)
  const isBullet = editor?.isActive('bulletList') ?? false
  const isOrdered = editor?.isActive('orderedList') ?? false
  const isTask = editor?.isActive('taskList') ?? false
  const isActive = isBullet || isOrdered || isTask
  const trigger = (
    <button
      type="button"
      title="목록"
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs transition-colors hover:bg-muted active:bg-muted/80 ${
        isActive ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-transparent text-muted-foreground'
      }`}
    >
      {isTask && <CheckSquare className="h-4 w-4" />}
      {isBullet && !isTask && <List className="h-4 w-4" />}
      {isOrdered && <ListOrdered className="h-4 w-4" />}
      {!isBullet && !isOrdered && !isTask && <List className="h-4 w-4 opacity-70" />}
    </button>
  )
  const run = (fn: () => void) => {
    fn()
    setOpen(false)
  }
  return (
    <InlineDropdown open={open} onOpenChange={setOpen} trigger={trigger} placement="below">
      <button type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted" onMouseDown={(e) => { e.preventDefault(); run(() => editor?.chain().focus().toggleBulletList().run()) }}>
        <List className="h-4 w-4" /> 글머리 목록
      </button>
      <button type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted" onMouseDown={(e) => { e.preventDefault(); run(() => editor?.chain().focus().toggleOrderedList().run()) }}>
        <ListOrdered className="h-4 w-4" /> 번호 목록
      </button>
      <button type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted" onMouseDown={(e) => { e.preventDefault(); run(() => editor?.chain().focus().toggleTaskList().run()) }}>
        <CheckSquare className="h-4 w-4" /> 할 일 목록
      </button>
    </InlineDropdown>
  )
}

function LinkButton({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const isLink = editor?.isActive('link') ?? false
  const currentHref = editor?.getAttributes('link').href ?? ''
  const applyLink = () => {
    if (url.trim()) {
      editor?.chain().focus().setLink({ href: url.trim() }).run()
    } else {
      editor?.chain().focus().unsetLink().run()
    }
    setUrl('')
    setOpen(false)
  }
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({ left: rect.left, top: rect.bottom + 4 })
  }, [open])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const menuEl = open && (
    <div
      ref={menuRef}
      className="fixed z-[99999] flex flex-col gap-1.5 rounded-md border border-border bg-white p-2 shadow-lg dark:bg-gray-900"
      style={{ left: position.left, top: position.top }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && applyLink()}
        placeholder="https://..."
        className="w-48 rounded border border-input bg-background px-2 py-1 text-sm"
      />
      <div className="flex gap-1">
        <button type="button" className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground" onMouseDown={(e) => { e.preventDefault(); applyLink() }}>
          적용
        </button>
        {isLink && (
          <button type="button" className="rounded border px-2 py-1 text-xs" onMouseDown={(e) => { e.preventDefault(); setUrl(''); editor?.chain().focus().unsetLink().run(); setOpen(false) }}>
            제거
          </button>
        )}
      </div>
    </div>
  )
  return (
    <div className="relative" ref={triggerRef}>
      <div onMouseDown={(e) => e.preventDefault()}>
        <button
          type="button"
          title="링크"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs transition-colors hover:bg-muted active:bg-muted/80 ${
            isLink ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-transparent text-muted-foreground'
          }`}
          onClick={() => {
            setOpen(!open)
            setUrl(currentHref || '')
          }}
        >
          <LinkIcon className="h-4 w-4" />
        </button>
      </div>
      {typeof document !== 'undefined' && menuEl && createPortal(menuEl, document.body)}
    </div>
  )
}

function BubbleBtn({
  onClick,
  isActive,
  title,
  children,
  disabled = false,
}: {
  onClick: () => void
  isActive: boolean
  title: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs transition-colors hover:bg-muted active:bg-muted/80 disabled:pointer-events-none disabled:opacity-50 ${
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
