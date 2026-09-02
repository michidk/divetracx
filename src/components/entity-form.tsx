import { useRouter } from '@tanstack/react-router'
import { Save, Star } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type {
  EditorValue,
  EditorValues,
  EntityField,
  EntityKey,
} from '@/modules/data/entities'
import { entityDefinitions } from '@/modules/data/entities'
import { saveRecord } from '@/modules/data/server/mutations'

function initialValue(field: EntityField, record: Record<string, unknown> | null) {
  if (field.kind === 'checkbox') return record?.[field.key] === true
  const value = record?.[field.key]
  if (value === null || value === undefined) return ''
  // Selects encode numeric source codes; 0 means "not set" in imported data.
  if (field.kind === 'select' && value === 0) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

export function initialEntityValues(
  entity: EntityKey,
  record: Record<string, unknown> | null,
): EditorValues {
  return Object.fromEntries(
    entityDefinitions[entity].fields.map((field) => [
      field.key,
      initialValue(field, record),
    ]),
  )
}

export function RatingInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div id={id} className="mt-2 flex min-h-11 items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === value ? 0 : star)}
          aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
          aria-pressed={value >= star}
          className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Star
            size={22}
            aria-hidden="true"
            className={
              value >= star ? 'fill-primary text-primary' : 'text-muted-foreground/50'
            }
          />
        </button>
      ))}
      {value > 0 ? (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="ml-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      ) : null}
    </div>
  )
}

function FieldControl({
  field,
  value,
  options,
  onChange,
}: {
  field: EntityField
  value: EditorValue | undefined
  options?: EntityField['options']
  onChange: (value: EditorValue) => void
}) {
  const inputId = `field-${field.key}`

  if (field.kind === 'checkbox') {
    return (
      <label
        htmlFor={inputId}
        className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-4 text-sm font-medium"
      >
        <Checkbox
          id={inputId}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        {field.label}
      </label>
    )
  }

  const stringValue = typeof value === 'string' ? value : ''

  if (field.kind === 'select') {
    const items = [{ value: '', label: 'Not set' }, ...(options ?? field.options ?? [])]
    if (stringValue && !items.some((item) => item.value === stringValue)) {
      items.push({ value: stringValue, label: `Code ${stringValue}` })
    }
    return (
      <div className="text-sm font-semibold">
        {field.label}
        {field.required ? <span className="text-red-600"> *</span> : null}
        <Select
          value={stringValue}
          items={items}
          onValueChange={(value) => onChange(value ?? '')}
        >
          <SelectTrigger id={inputId} className="mt-2">
            <SelectValue placeholder="Not set" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (field.kind === 'rating') {
    return (
      <div className="text-sm font-semibold">
        {field.label}
        <RatingInput
          id={inputId}
          value={Number(stringValue) || 0}
          onChange={(rating) => onChange(rating === 0 ? '' : String(rating))}
        />
      </div>
    )
  }

  return (
    <label htmlFor={inputId} className="block text-sm font-semibold">
      {field.label}
      {field.required ? <span className="text-red-600"> *</span> : null}
      {field.kind === 'textarea' ? (
        <Textarea
          id={inputId}
          value={stringValue}
          required={field.required}
          rows={5}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2"
        />
      ) : (
        <Input
          id={inputId}
          type={field.kind}
          value={stringValue}
          required={field.required}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2"
        />
      )}
      {field.help ? (
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          {field.help}
        </span>
      ) : null}
    </label>
  )
}

export function EntityForm({
  entity,
  recordId,
  record,
  onSaved,
  renderSectionExtra,
  selectOptions,
}: {
  entity: EntityKey
  recordId: string
  record: Record<string, unknown> | null
  onSaved?: (id: string) => void | Promise<void>
  selectOptions?: Record<string, NonNullable<EntityField['options']>>
  renderSectionExtra?: (
    section: string,
    values: EditorValues,
    setValue: (key: string, value: EditorValue) => void,
  ) => React.ReactNode
}) {
  const definition = entityDefinitions[entity]
  const router = useRouter()
  const [values, setValues] = useState(() => initialEntityValues(entity, record))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const sections = Array.from(new Set(definition.fields.map((field) => field.section)))

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const result = await saveRecord({ data: { entity, recordId, values } })
      await router.invalidate()
      setMessage('Saved.')
      if (recordId === 'new') await onSaved?.(result.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Saving failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      {sections.map((section) => (
        <section
          key={section}
          className="rounded-2xl border border-border bg-card p-5 md:p-6"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {section}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {definition.fields
              .filter((field) => field.section === section)
              .map((field) => (
                <div
                  key={field.key}
                  className={field.kind === 'textarea' ? 'sm:col-span-2' : undefined}
                >
                  <FieldControl
                    field={field}
                    value={values[field.key]}
                    options={selectOptions?.[field.key]}
                    onChange={(value) =>
                      setValues((current) => ({ ...current, [field.key]: value }))
                    }
                  />
                </div>
              ))}
          </div>
          {renderSectionExtra?.(section, values, (key, value) =>
            setValues((current) => ({ ...current, [key]: value })),
          )}
        </section>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {message}
        </p>
        <Button type="submit" disabled={saving} className="px-6">
          <Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
