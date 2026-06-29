"use client"

import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  Bold,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Video,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { HelpArticleImage } from "@/components/staff/help/manage/help-article-image-extension"
import { HelpVideo } from "@/components/staff/help/manage/help-video-extension"
import { useToastNotify } from "@/components/staff/shared/toast"
import { Button } from "@/components/ui/button"
import { StaffApiError } from "@/lib/api/staff-api"
import {
  normalizeHelpArticleHtmlForSave,
  prepareHelpBodyForEditor,
} from "@/lib/staff/help-article-content"
import { getHelpMediaDisplayUrl } from "@/lib/staff/help-media"
import { normalizeHelpMediaUploadFile } from "@/lib/staff/help-media-validation"
import { uploadHelpArticleMedia } from "@/lib/staff/help-media-upload-client"
import { cn } from "@/lib/utils"

interface HelpRichTextEditorProps {
  value: string
  onChange: (value: string) => void
  articleId?: string
  error?: string
}

export function HelpRichTextEditor({ value, onChange, articleId, error }: HelpRichTextEditorProps) {
  const { toast } = useToastNotify()
  const [uploadingCount, setUploadingCount] = useState(0)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const articleIdRef = useRef(articleId)
  const uploadHandlerRef = useRef<(file: File) => Promise<void>>(async () => {})
  const canUploadMedia = Boolean(articleId)

  articleIdRef.current = articleId

  const uploadAndInsertFile = useCallback(
    async (file: File, editorInstance: NonNullable<ReturnType<typeof useEditor>>) => {
      const currentArticleId = articleIdRef.current
      if (!currentArticleId) {
        toast({
          message: "Save a draft first, then add images or videos on the edit page.",
          variant: "error",
        })
        return
      }

      setUploadingCount((count) => count + 1)
      try {
        const media = await uploadHelpArticleMedia({
          articleId: currentArticleId,
          file,
          fallbackMimeType: file.type.trim() ? undefined : "image/png",
        })
        const displayUrl = getHelpMediaDisplayUrl(media.id)

        if (media.mediaType === "VIDEO") {
          editorInstance.chain().focus().setHelpVideo({ mediaId: media.id, title: media.title }).run()
        } else {
          editorInstance
            .chain()
            .focus()
            .insertContent({
              type: "image",
              attrs: {
                src: displayUrl,
                alt: media.title ?? media.description ?? "Help screenshot",
                title: media.title ?? undefined,
                mediaId: media.id,
              },
            })
            .run()
        }

        toast({ message: media.mediaType === "VIDEO" ? "Video added." : "Image added.", variant: "success" })
      } catch (caught) {
        const message =
          caught instanceof StaffApiError
            ? caught.message
            : caught instanceof Error
              ? caught.message
              : "Could not upload media."
        toast({ message, variant: "error" })
      } finally {
        setUploadingCount((count) => Math.max(0, count - 1))
      }
    },
    [toast],
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      HelpArticleImage.configure({
        HTMLAttributes: {
          class: "help-article-inline-image max-w-full rounded-md border border-border",
        },
      }),
      HelpVideo,
      Placeholder.configure({
        placeholder:
          "Write step-by-step guidance here. Paste screenshots, drag images, or add a video walkthrough.",
      }),
    ],
    content: prepareHelpBodyForEditor(value),
    editorProps: {
      attributes: {
        class:
          "help-rich-text-editor min-h-[18rem] rounded-md border-0 bg-background px-4 py-3 text-sm leading-7 focus:outline-none",
        "aria-label": "Help article body",
      },
      handlePaste: (_view, event, _slice) => {
        if (!articleIdRef.current || !event.clipboardData) return false
        const imageFile = readClipboardImageFile(event.clipboardData)
        if (!imageFile) return false
        event.preventDefault()
        void uploadHandlerRef.current(imageFile)
        return true
      },
      handleDrop: (_view, event) => {
        const file = event.dataTransfer?.files?.[0]
        if (!file) return false
        event.preventDefault()
        void uploadHandlerRef.current(file)
        return true
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(normalizeHelpArticleHtmlForSave(currentEditor.getHTML()))
    },
  })

  uploadHandlerRef.current = async (file: File) => {
    if (!editor) {
      toast({ message: "Editor is still loading. Try pasting again in a moment.", variant: "error" })
      return
    }
    await uploadAndInsertFile(file, editor)
  }

  useEffect(() => {
    if (!editor) return
    const nextHtml = prepareHelpBodyForEditor(value)
    const currentHtml = editor.getHTML()
    if (normalizeHelpArticleHtmlForSave(currentHtml) !== normalizeHelpArticleHtmlForSave(nextHtml)) {
      editor.commands.setContent(nextHtml, { emitUpdate: false })
    }
  }, [editor, value])

  function handleMediaInputChange(event: React.ChangeEvent<HTMLInputElement>, mediaKind: "image" | "video") {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (mediaKind === "image" && !file.type.startsWith("image/")) {
      toast({ message: "Choose an image file (PNG, JPG, or WEBP).", variant: "error" })
      return
    }

    if (mediaKind === "video" && !file.type.startsWith("video/")) {
      toast({ message: "Choose a video file (MP4 or WEBM).", variant: "error" })
      return
    }

    void uploadHandlerRef.current(file)
  }

  function toggleLink() {
    if (!editor) return

    const previousUrl = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Link URL", previousUrl ?? "https://")
    if (url === null) return
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  const isUploading = uploadingCount > 0

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-xs font-medium text-muted-foreground">Article body</label>
        {!canUploadMedia ? (
          <p className="text-xs text-muted-foreground">Save a draft to unlock image and video uploads.</p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
          <ToolbarButton
            label="Bold"
            shortcut="⌘B"
            active={editor?.isActive("bold") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            shortcut="⌘I"
            active={editor?.isActive("italic") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton
            label="Heading 2"
            active={editor?.isActive("heading", { level: 2 }) ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 3"
            active={editor?.isActive("heading", { level: 3 }) ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton
            label="Bullet list"
            active={editor?.isActive("bulletList") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Numbered list"
            active={editor?.isActive("orderedList") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Quote"
            active={editor?.isActive("blockquote") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton
            label="Link"
            active={editor?.isActive("link") ?? false}
            disabled={!editor}
            onClick={toggleLink}
          >
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Insert image"
            disabled={!editor || !canUploadMedia || isUploading}
            onClick={() => imageInputRef.current?.click()}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          </ToolbarButton>
          <ToolbarButton
            label="Insert video"
            disabled={!editor || !canUploadMedia || isUploading}
            onClick={() => videoInputRef.current?.click()}
          >
            <Video className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <EditorContent editor={editor} aria-invalid={Boolean(error)} aria-describedby={error ? "help-body-error" : undefined} />
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => handleMediaInputChange(event, "image")}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={(event) => handleMediaInputChange(event, "video")}
      />

      <p className="text-xs text-muted-foreground">
        Paste screenshots, drag files onto the editor, or use the image/video buttons. Video-only guides are supported.
      </p>

      {error ? (
        <p id="help-body-error" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface ToolbarButtonProps {
  label: string
  shortcut?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToolbarButton({ label, shortcut, active, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={cn("h-8 w-8 px-0", active && "bg-muted text-foreground")}
      aria-label={shortcut ? `${label} (${shortcut})` : label}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />
}

function readClipboardImageFile(clipboardData: DataTransfer) {
  for (const item of clipboardData.items) {
    if (!item.type.startsWith("image/")) continue

    const file = item.getAsFile()
    if (!file) continue

    return normalizeHelpMediaUploadFile(file, { fallbackMimeType: item.type })
  }

  return null
}
