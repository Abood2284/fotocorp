import type { HelpCategoryManageSummary } from "@/lib/api/staff-help-api"
import { cn } from "@/lib/utils"

interface HelpCategorySelectorProps {
  categories: HelpCategoryManageSummary[]
  value: string
  onChange: (value: string) => void
  error?: string
}

export function HelpCategorySelector({ categories, value, onChange, error }: HelpCategorySelectorProps) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-foreground">Category</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full rounded-md border border-border bg-background px-3 py-2 text-sm",
          error && "border-destructive",
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "help-category-error" : undefined}
      >
        <option value="">Select a category</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
            {!category.isActive ? " (inactive)" : ""}
          </option>
        ))}
      </select>
      {error ? (
        <span id="help-category-error" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </label>
  )
}
