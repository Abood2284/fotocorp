import { Node, mergeAttributes } from "@tiptap/core"
import { getHelpMediaDisplayUrl } from "@/lib/staff/help-media"

export interface HelpVideoOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    helpVideo: {
      setHelpVideo: (options: { mediaId: string; title?: string | null }) => ReturnType
    }
  }
}

export const HelpVideo = Node.create<HelpVideoOptions>({
  name: "helpVideo",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      mediaId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-media-id"),
        renderHTML: (attributes) => ({
          "data-media-id": attributes.mediaId,
          "data-help-video": "true",
        }),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-title"),
        renderHTML: (attributes) =>
          attributes.title ? { "data-title": attributes.title } : {},
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-help-video="true"]',
      },
      {
        tag: "video[data-media-id]",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false
          return {
            mediaId: element.getAttribute("data-media-id"),
            title: element.getAttribute("data-title"),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const mediaId = HTMLAttributes["data-media-id"]
    const title = HTMLAttributes["data-title"]

    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "help-article-video my-4",
        "data-help-video": "true",
      }),
      [
        "video",
        {
          src: typeof mediaId === "string" ? getHelpMediaDisplayUrl(mediaId) : undefined,
          controls: "true",
          preload: "metadata",
          class: "w-full max-w-3xl rounded-md border border-border bg-black",
          "data-media-id": mediaId,
          ...(title ? { "data-title": title } : {}),
        },
      ],
    ]
  },

  addCommands() {
    return {
      setHelpVideo:
        ({ mediaId, title }) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { mediaId, title: title ?? null },
          }),
    }
  },
})
