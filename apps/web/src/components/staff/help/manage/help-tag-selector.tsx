import type { HelpTagSummary } from "@/lib/api/staff-help-api"

interface HelpTagSelectorProps {
  tags: HelpTagSummary[]
  value: string[]
  onChange: (value: string[]) => void
}

export function HelpTagSelector({ tags, value, onChange }: HelpTagSelectorProps) {
  function toggleTag(tagId: string) {
    if (value.includes(tagId)) onChange(value.filter((item) => item !== tagId))
    else onChange([...value, tagId])
  }

  if (!tags.length) {
    return <p className="text-sm text-muted-foreground">No tags yet. Create tags on the tag management page.</p>
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">Tags</legend>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const checked = value.includes(tag.id)
          return (
            <label
              key={tag.id}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleTag(tag.id)}
                className="h-4 w-4 rounded border-border"
              />
              <span>{tag.name}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
