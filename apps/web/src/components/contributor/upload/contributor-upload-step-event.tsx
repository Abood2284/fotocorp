"use client"

import { ContributorUploadGlassDate } from "@/components/contributor/upload/contributor-upload-glass-date"
import { uploadFieldLabelClass, uploadInputClass, uploadSelectClass } from "@/components/contributor/upload/contributor-upload-field-styles"
import { ContributorUploadStepCard } from "@/components/contributor/upload/contributor-upload-layout"
import type {
  ContributorAssetCategoryDto,
  ContributorAuthResponse,
  ContributorPortalContributorDto,
} from "@/lib/api/contributor-api"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ContributorUploadStepEventProps {
  active: boolean
  eventCreated: boolean
  batchEventName: string
  categories: ContributorAssetCategoryDto[]
  contributors: ContributorPortalContributorDto[]
  isPortalAdmin: boolean
  /** Staff wizard: photographer dropdown always required; session only used for non-staff fallback label */
  staffMode?: boolean
  session: ContributorAuthResponse
  newEventName: string
  newCategoryId: string
  newEventDate: string
  targetContributorId: string
  createBusy: boolean
  createErr: string | null
  onNewEventNameChange: (value: string) => void
  onNewCategoryIdChange: (value: string) => void
  onNewEventDateChange: (value: string) => void
  onTargetContributorIdChange: (value: string) => void
  onChangeEvent: () => void
}

export function ContributorUploadStepEvent({
  active,
  eventCreated,
  batchEventName,
  categories,
  contributors,
  isPortalAdmin,
  staffMode = false,
  session,
  newEventName,
  newCategoryId,
  newEventDate,
  targetContributorId,
  createBusy,
  createErr,
  onNewEventNameChange,
  onNewCategoryIdChange,
  onNewEventDateChange,
  onTargetContributorIdChange,
  onChangeEvent,
}: ContributorUploadStepEventProps) {
  const photographerOptions = staffMode
    ? contributors
    : isPortalAdmin
    ? contributors.length > 0
      ? contributors
      : [{ id: session.contributor.id, displayName: session.contributor.displayName, email: session.contributor.email }]
    : [{ id: session.contributor.id, displayName: session.contributor.displayName, email: session.contributor.email }]

  const selectValue = staffMode ? targetContributorId : targetContributorId || session.contributor.id

  return (
    <ContributorUploadStepCard active={active} className="p-5 sm:p-6 md:p-7">
      <h2 className="text-base font-semibold text-foreground sm:text-lg">Event details</h2>

      {eventCreated ? (
        <div className="mt-5 sm:mt-6">
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-medium text-foreground sm:text-lg">{batchEventName}</p>
              <button
                type="button"
                className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground sm:text-sm"
                onClick={onChangeEvent}
              >
                Change
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-5 sm:mt-6 sm:space-y-6">
          {createErr ? <p className="text-sm text-destructive sm:text-base">{createErr}</p> : null}

          <div className="space-y-2 sm:space-y-2.5">
            <label htmlFor="new-event-name" className={uploadFieldLabelClass}>
              Event name <span className="text-destructive">*</span>
            </label>
            <Input
              id="new-event-name"
              value={newEventName}
              disabled={createBusy}
              onChange={(e) => onNewEventNameChange(e.target.value)}
              autoComplete="off"
              required
              className={uploadInputClass}
            />
          </div>

          <div className="space-y-2 sm:space-y-2.5">
            <label htmlFor="inline-cat" className={uploadFieldLabelClass}>
              Category <span className="text-destructive">*</span>
            </label>
            <select
              id="inline-cat"
              className={uploadSelectClass}
              value={newCategoryId}
              disabled={createBusy}
              onChange={(e) => onNewCategoryIdChange(e.target.value)}
            >
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 sm:space-y-2.5">
            <label htmlFor="new-event-date" className={uploadFieldLabelClass}>
              Event date <span className="text-destructive">*</span>
            </label>
            <ContributorUploadGlassDate
              id="new-event-date"
              value={newEventDate}
              disabled={createBusy}
              onChange={onNewEventDateChange}
            />
          </div>

          <div className="space-y-2 sm:space-y-2.5">
            <label htmlFor="inline-photo" className={uploadFieldLabelClass}>
              Photographer{staffMode ? <span className="text-destructive"> *</span> : null}
            </label>
            <select
              id="inline-photo"
              className={cn(uploadSelectClass, !isPortalAdmin && !staffMode && "bg-muted/40 text-foreground")}
              value={selectValue}
              disabled={createBusy || (!staffMode && !isPortalAdmin)}
              onChange={(e) => onTargetContributorIdChange(e.target.value)}
            >
              {staffMode ? <option value="">Select photographer…</option> : null}
              {photographerOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                  {p.email ? ` · ${p.email}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </ContributorUploadStepCard>
  )
}
