import { cn } from "@/lib/utils"
import type { WorkflowStep } from "@/lib/staff/access-inquiry-guidance"

interface AccessInquiryWorkflowStepperProps {
  steps: WorkflowStep[]
}

export function AccessInquiryWorkflowStepper({ steps }: AccessInquiryWorkflowStepperProps) {
  return (
    <ol className="mt-4 grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={cn(
            "rounded-lg border px-3 py-3 text-sm",
            step.state === "current" && "border-primary bg-primary/5",
            step.state === "complete" && "border-emerald-200 bg-emerald-50/80",
            step.state === "upcoming" && "border-border bg-card",
            step.state === "skipped" && "border-border bg-muted/20 opacity-60",
          )}
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px]",
                step.state === "current" && "bg-primary text-primary-foreground",
                step.state === "complete" && "bg-emerald-600 text-white",
                step.state === "upcoming" && "border border-border bg-background text-foreground",
                step.state === "skipped" && "bg-muted text-muted-foreground",
              )}
            >
              {step.state === "complete" ? "✓" : index + 1}
            </span>
            {step.label}
          </div>
          <p className="mt-2 leading-relaxed text-muted-foreground">{step.description}</p>
        </li>
      ))}
    </ol>
  )
}
