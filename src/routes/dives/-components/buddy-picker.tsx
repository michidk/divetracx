import { Popover } from '@base-ui/react/popover'
import { Plus, Search, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DIVE_BUDDY_ROLE_OPTIONS, type DiveBuddyRole } from '@/modules/dives/buddy-role'
import { formatPersonName } from '@/modules/dives/format'

interface BuddyOption {
  id: string
  firstName: string | null
  lastName: string | null
}

export interface BuddyAssignment {
  buddyId: string
  role: DiveBuddyRole
}

export function BuddyPicker({
  options,
  value,
  onChange,
}: {
  options: BuddyOption[]
  value: BuddyAssignment[]
  onChange: (value: BuddyAssignment[]) => void
}) {
  const searchId = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const optionsById = useMemo(
    () => new Map(options.map((buddy) => [buddy.id, buddy])),
    [options],
  )
  const selectedIds = new Set(value.map((assignment) => assignment.buddyId))
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const available = options.filter((buddy) => {
    if (selectedIds.has(buddy.id)) return false
    return formatPersonName(buddy).toLocaleLowerCase().includes(normalizedSearch)
  })

  function addBuddy(buddyId: string) {
    onChange([...value, { buddyId, role: 'buddy' }])
    setSearch('')
    setOpen(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Buddies and dive team</span>
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger
            render={<Button type="button" variant="outline" size="sm" />}
            disabled={selectedIds.size === options.length}
          >
            <Plus size={15} aria-hidden="true" /> Add person
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner sideOffset={6} align="end" className="isolate z-50">
              <Popover.Popup className="w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-xl outline-none">
                <label htmlFor={searchId} className="sr-only">
                  Search buddies
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id={searchId}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search buddies…"
                    autoFocus
                    className="pl-9"
                  />
                </div>
                <div className="mt-2 max-h-64 overflow-y-auto">
                  {available.length > 0 ? (
                    <ul className="space-y-1">
                      {available.map((buddy) => (
                        <li key={buddy.id}>
                          <button
                            type="button"
                            onClick={() => addBuddy(buddy.id)}
                            className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            {formatPersonName(buddy)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-3 py-5 text-center text-sm text-muted-foreground">
                      {options.length === 0
                        ? 'No buddies yet.'
                        : normalizedSearch
                          ? 'No matching buddies.'
                          : 'Everyone has already been added.'}
                    </p>
                  )}
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {value.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {value.map((assignment) => {
            const buddy = optionsById.get(assignment.buddyId)
            if (!buddy) return null
            return (
              <li
                key={assignment.buddyId}
                className="grid gap-3 rounded-xl border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center"
              >
                <span className="truncate text-sm font-medium">
                  {formatPersonName(buddy)}
                </span>
                <Select
                  value={assignment.role}
                  items={DIVE_BUDDY_ROLE_OPTIONS}
                  onValueChange={(role) => {
                    if (!role) return
                    onChange(
                      value.map((item) =>
                        item.buddyId === assignment.buddyId ? { ...item, role } : item,
                      ),
                    )
                  }}
                >
                  <SelectTrigger aria-label={`Role for ${formatPersonName(buddy)}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIVE_BUDDY_ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  aria-label={`Remove ${formatPersonName(buddy)} from dive`}
                  onClick={() =>
                    onChange(value.filter((item) => item.buddyId !== assignment.buddyId))
                  }
                  className="grid size-10 place-items-center justify-self-end rounded-lg text-muted-foreground hover:bg-muted hover:text-red-600 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-border bg-background px-4 py-5 text-center text-sm text-muted-foreground">
          No buddies or dive team added.
        </p>
      )}
    </div>
  )
}
