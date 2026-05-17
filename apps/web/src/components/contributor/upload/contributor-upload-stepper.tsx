"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ContributorUploadStep {
  id: number
  label: string
}

interface ContributorUploadStepperProps {
  steps: ContributorUploadStep[]
  currentStep: number
  completedSteps: Set<number>
  onStepClick?: (stepId: number) => void
}

export function ContributorUploadStepper({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: ContributorUploadStepperProps) {
  return (
    <nav aria-label="Upload progress" className="flex flex-wrap items-center gap-2 sm:gap-4">
      {steps.map((step, index) => {
        const isComplete = completedSteps.has(step.id)
        const isActive = currentStep === step.id
        const isLocked = !isComplete && !isActive
        const canNavigate = isComplete && Boolean(onStepClick)

        return (
          <div key={step.id} className="flex items-center gap-2 sm:gap-4">
            {index > 0 ? (
              <div
                className={cn(
                  "hidden h-px w-6 sm:block sm:w-10",
                  isComplete || isActive ? "bg-border" : "bg-border/50",
                )}
                aria-hidden
              />
            ) : null}
            <button
              type="button"
              disabled={!canNavigate}
              onClick={() => canNavigate && onStepClick?.(step.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors",
                canNavigate && "hover:bg-muted/40",
                !canNavigate && "cursor-default",
              )}
              aria-current={isActive ? "step" : undefined}
            >
              <StepIndicator active={isActive} complete={isComplete && !isActive} locked={isLocked} stepNumber={step.id} />
              <span
                className={cn(
                  "text-sm font-medium sm:text-base",
                  isActive && "text-foreground",
                  isComplete && !isActive && "text-foreground",
                  isLocked && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}

function StepIndicator({
  active,
  complete,
  locked,
  stepNumber,
}: {
  active: boolean
  complete: boolean
  locked: boolean
  stepNumber: number
}) {
  if (complete) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        <span className="sr-only">Step {stepNumber} complete</span>
      </span>
    )
  }

  if (active) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {stepNumber}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
        locked ? "border-border bg-transparent text-muted-foreground" : "border-primary bg-primary text-primary-foreground",
      )}
    >
      {stepNumber}
    </span>
  )
}