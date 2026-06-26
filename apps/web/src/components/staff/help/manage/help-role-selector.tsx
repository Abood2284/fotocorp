import {
  STAFF_HELP_ROLE_LABELS,
  STAFF_HELP_ROLES,
  type StaffHelpRole,
} from "@/lib/staff/help-form"

interface HelpRoleSelectorProps {
  value: StaffHelpRole[]
  onChange: (value: StaffHelpRole[]) => void
  error?: string
}

export function HelpRoleSelector({ value, onChange, error }: HelpRoleSelectorProps) {
  const allSelected = STAFF_HELP_ROLES.every((role) => value.includes(role))

  function toggleRole(role: StaffHelpRole) {
    if (value.includes(role)) onChange(value.filter((item) => item !== role))
    else onChange([...value, role])
  }

  function selectAllRoles() {
    onChange([...STAFF_HELP_ROLES])
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">Audience roles</legend>
      <p className="text-xs text-muted-foreground">Choose which staff roles can see this article.</p>

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => (allSelected ? onChange([]) : selectAllRoles())}
          className="h-4 w-4 rounded border-border"
        />
        <span className="font-medium">All staff roles</span>
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        {STAFF_HELP_ROLES.map((role) => (
          <label
            key={role}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={value.includes(role)}
              onChange={() => toggleRole(role)}
              className="h-4 w-4 rounded border-border"
            />
            <span>{STAFF_HELP_ROLE_LABELS[role]}</span>
          </label>
        ))}
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </fieldset>
  )
}
