import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { SaveButton, useTransientSavedState } from '@/components/save-button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { saveGearSetRecord } from '@/modules/gear/server/mutations'
import type { getGearSetEditor } from '@/modules/gear/server/queries'

type GearSetEditorData = NonNullable<Awaited<ReturnType<typeof getGearSetEditor>>>

export function GearSetForm({
  data,
  onSaved,
}: {
  data: GearSetEditorData
  onSaved?: (id: string) => void | Promise<void>
}) {
  const router = useRouter()
  const [name, setName] = useState(data.set?.name ?? '')
  const [notes, setNotes] = useState(data.set?.notes ?? '')
  const [inactive, setInactive] = useState(data.set?.inactive ?? false)
  const [equipmentIds, setEquipmentIds] = useState(() => new Set(data.equipmentIds))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { saved, clearSaved, markSaved } = useTransientSavedState()

  function toggleItem(id: string, checked: boolean) {
    setEquipmentIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    clearSaved()
    try {
      const result = await saveGearSetRecord({
        data: {
          id: data.set?.id ?? 'new',
          name,
          notes,
          inactive,
          equipmentIds: [...equipmentIds],
        },
      })
      await router.invalidate()
      markSaved()
      await onSaved?.(result.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Saving failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 md:p-6">
        <label htmlFor="gear-set-name" className="block text-sm font-semibold">
          Name <span className="text-red-600">*</span>
          <Input
            id="gear-set-name"
            value={name}
            required
            maxLength={200}
            onChange={(event) => setName(event.target.value)}
            className="mt-2"
          />
        </label>
        <label htmlFor="gear-set-notes" className="block text-sm font-semibold">
          Notes
          <Textarea
            id="gear-set-notes"
            value={notes}
            maxLength={10_000}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2"
          />
        </label>
        <label
          htmlFor="gear-set-inactive"
          className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-4 text-sm font-medium"
        >
          <Checkbox
            id="gear-set-inactive"
            checked={inactive}
            onCheckedChange={(checked) => setInactive(checked === true)}
          />
          No longer in use
        </label>
      </section>

      <fieldset className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Gear in this set
        </legend>
        {data.equipment.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add gear items before creating a set.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {data.equipment.map((item) => (
              <label
                key={item.id}
                htmlFor={`set-equipment-${item.id}`}
                className={`flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-3 text-sm ${item.inactive ? 'text-muted-foreground' : ''}`}
              >
                <Checkbox
                  id={`set-equipment-${item.id}`}
                  checked={equipmentIds.has(item.id)}
                  onCheckedChange={(checked) => toggleItem(item.id, checked === true)}
                />
                <span className="min-w-0 truncate">
                  {item.name}
                  {item.category ? (
                    <span className="text-muted-foreground"> · {item.category}</span>
                  ) : null}
                  {item.inactive ? ' (retired)' : ''}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton type="submit" saving={saving} saved={saved}>
          Save gear set
        </SaveButton>
        {message ? (
          <p aria-live="polite" className="text-sm text-red-600">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  )
}
