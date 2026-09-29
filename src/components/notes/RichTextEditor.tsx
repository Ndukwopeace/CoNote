/**
 * The note body editor (FR-NTE-2): Tiptap with a toolbar for bold, italic, underline, heading,
 * bullet and numbered lists, link, undo and redo. Produces HTML that only ever reaches the screen
 * again through SafeHtml or this editor.
 */

// Toolbar icons.
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
// Local state for the link box, and focusing its field when it opens.
import { useEffect, useRef, useState } from 'react'
// The editor, its React bindings, and a hook that re-renders when the editor's state changes.
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
// The standard set of editing features.
import StarterKit from '@tiptap/starter-kit'

// Standard button and input.
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
// Checks link addresses.
import { normalizeLink } from '@/lib/links'
// Class-name helper.
import { cn } from '@/lib/utils'

/** What the editor needs. */
interface RichTextEditorProps {
  // The editable area's ID, for a label's htmlFor-like link (aria-labelledby).
  id: string
  // The label element's ID.
  labelledBy: string
  // Starting HTML. Remount the editor (change its key) to load different content.
  initialHtml: string
  // Called with the new HTML after every change.
  onChange: (html: string) => void
  // Marks the body as invalid, linked to its error.
  invalid?: boolean
  // The error message's ID.
  describedBy?: string
}

/** The editor and its toolbar. */
export function RichTextEditor({
  id,
  labelledBy,
  initialHtml,
  onChange,
  invalid,
  describedBy,
}: Readonly<RichTextEditorProps>) {
  // The Tiptap editor.
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Two heading sizes, matching the sanitiser's h2 and h3.
        heading: { levels: [2, 3] },
        // Off: the sanitiser doesn't keep strikethrough or rules, so they would vanish on save.
        strike: false,
        horizontalRule: false,
        // Links: not opened by a click while editing, and only safe schemes.
        link: {
          openOnClick: false,
          autolink: true,
          // SECURITY: pasted or typed links are limited to these schemes (see normalizeLink).
          protocols: ['http', 'https', 'mailto'],
          isAllowedUri: (url) => normalizeLink(url) !== null,
        },
      }),
    ],
    // Starting content.
    content: initialHtml,
    // Report every change.
    onUpdate: ({ editor: current }) => {
      onChange(current.getHTML())
    },
    // Attributes on the editable area: a labelled multi-line text box, styled as an input.
    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelledBy,
        ...(invalid ? { 'aria-invalid': 'true' } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        class:
          'note-content min-h-64 px-3 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-b-md',
      },
    },
    // Render straight away in the browser (no server rendering here).
    immediatelyRender: true,
  })

  return (
    // One bordered box holding the toolbar and the text; red border when invalid.
    <div className={cn('rounded-md border bg-card', invalid && 'border-error')}>
      {/* immediatelyRender means the editor exists on the first render. */}
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

/** One toolbar button's description. */
interface ToolDef {
  // Accessible name, also the tooltip.
  label: string
  // Icon.
  icon: LucideIcon
  // Runs the command.
  run: (editor: Editor) => void
  // Whether it is switched on here (toggles only).
  active?: (editor: Editor) => boolean
  // Whether it can run now (undo and redo).
  enabled?: (editor: Editor) => boolean
}

/** The toolbar buttons, in order (FR-NTE-2). */
const TOOLS: ToolDef[] = [
  {
    label: 'Bold',
    icon: Bold,
    run: (e) => e.chain().focus().toggleBold().run(),
    active: (e) => e.isActive('bold'),
  },
  {
    label: 'Italic',
    icon: Italic,
    run: (e) => e.chain().focus().toggleItalic().run(),
    active: (e) => e.isActive('italic'),
  },
  {
    label: 'Underline',
    icon: UnderlineIcon,
    run: (e) => e.chain().focus().toggleUnderline().run(),
    active: (e) => e.isActive('underline'),
  },
  {
    label: 'Heading',
    icon: Heading2,
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    active: (e) => e.isActive('heading'),
  },
  {
    label: 'Bullet list',
    icon: List,
    run: (e) => e.chain().focus().toggleBulletList().run(),
    active: (e) => e.isActive('bulletList'),
  },
  {
    label: 'Numbered list',
    icon: ListOrdered,
    run: (e) => e.chain().focus().toggleOrderedList().run(),
    active: (e) => e.isActive('orderedList'),
  },
]

/** Undo and redo, which are enabled only when there is something to undo or redo. */
const HISTORY_TOOLS: ToolDef[] = [
  {
    label: 'Undo',
    icon: Undo2,
    run: (e) => e.chain().focus().undo().run(),
    enabled: (e) => e.can().undo(),
  },
  {
    label: 'Redo',
    icon: Redo2,
    run: (e) => e.chain().focus().redo().run(),
    enabled: (e) => e.can().redo(),
  },
]

/** The row of formatting buttons, plus the link box when open. */
function Toolbar({ editor }: Readonly<{ editor: Editor }>) {
  // Re-render on every selection or content change, so pressed states and undo stay current.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      active: TOOLS.map((tool) => tool.active?.(current) ?? false),
      enabled: HISTORY_TOOLS.map((tool) => tool.enabled?.(current) ?? true),
      link: current.isActive('link'),
    }),
  })
  // Whether the link box is open.
  const [linkOpen, setLinkOpen] = useState(false)

  return (
    <div className="border-b">
      {/* role="toolbar" groups the buttons for screen readers. Wraps on narrow phones. */}
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1 p-1">
        {TOOLS.map((tool, i) => (
          <ToolButton
            key={tool.label}
            tool={tool}
            pressed={state.active[i] ?? false}
            onClick={() => {
              tool.run(editor)
            }}
          />
        ))}
        {/* Link opens a small box for the address. */}
        <ToolButton
          tool={{ label: 'Link', icon: Link2, run: () => undefined }}
          pressed={state.link}
          onClick={() => {
            setLinkOpen((open) => !open)
          }}
        />
        {/* A thin divider before undo and redo. */}
        <span aria-hidden="true" className="mx-1 w-px self-stretch bg-border" />
        {HISTORY_TOOLS.map((tool, i) => (
          <ToolButton
            key={tool.label}
            tool={tool}
            disabled={!(state.enabled[i] ?? true)}
            onClick={() => {
              tool.run(editor)
            }}
          />
        ))}
      </div>
      {linkOpen && (
        <LinkBox
          editor={editor}
          onClose={() => {
            setLinkOpen(false)
          }}
        />
      )}
    </div>
  )
}

/** One square toolbar button with a tooltip-style title. */
function ToolButton({
  tool,
  pressed,
  disabled,
  onClick,
}: Readonly<{ tool: ToolDef; pressed?: boolean; disabled?: boolean; onClick: () => void }>) {
  // The icon component.
  const Icon = tool.icon
  return (
    <button
      type="button"
      // The accessible name.
      aria-label={tool.label}
      // Toggles say whether they are on; undo and redo aren't toggles.
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      title={tool.label}
      disabled={disabled}
      // Keeps the editor's selection when the button is clicked with a mouse.
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onClick={onClick}
      // 36 px square; filled when pressed, so it isn't shown by colour alone (a background).
      className="flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40 aria-pressed:bg-primary-light aria-pressed:text-primary"
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  )
}

/** The link box: an address field with Apply, Remove and Cancel. */
function LinkBox({ editor, onClose }: Readonly<{ editor: Editor; onClose: () => void }>) {
  // The typed address, starting from the current link if the cursor is on one.
  const [value, setValue] = useState(() => String(editor.getAttributes('link').href ?? ''))
  // The message when the address isn't usable.
  const [error, setError] = useState<string | null>(null)
  // The address field.
  const input = useRef<HTMLInputElement>(null)

  // Move focus into the box when it opens: the student just asked for it, so typing can start.
  useEffect(() => {
    input.current?.focus()
  }, [])

  /** Checks and applies the address. */
  function apply() {
    // SECURITY: only http, https and mailto addresses become links (normalizeLink).
    const href = normalizeLink(value)
    if (!href) {
      setError('Enter a web address (https://…) or an email link (mailto:…).')
      return
    }
    // Make the selection (or the word at the cursor) a link.
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    onClose()
  }

  return (
    <div className="flex flex-col gap-2 border-t p-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        {/* The address field. Enter applies, Escape closes. */}
        <Input
          type="url"
          aria-label="Link address"
          placeholder="https://"
          value={value}
          ref={input}
          {...(error ? { 'aria-invalid': true, 'aria-describedby': 'link-error' } : {})}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              // Enter would otherwise submit the note form.
              event.preventDefault()
              apply()
            } else if (event.key === 'Escape') {
              onClose()
            }
          }}
        />
        {/* Why the address was refused. */}
        {error && (
          <p id="link-error" className="mt-1 text-sm text-error-strong">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={apply}>
          Apply
        </Button>
        {/* Remove the link under the cursor. */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            onClose()
          }}
        >
          Remove
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
