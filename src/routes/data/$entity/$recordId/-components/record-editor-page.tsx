import { Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, ExternalLink, Save, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { PictureGallery } from '@/components/picture-gallery'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { saveRecord } from '@/modules/data/server/records'
import type { DataEditorPayload, EditorOption } from '@/modules/data/types'

function initialValues(entity: EntityKey, payload: DataEditorPayload): EditorValues {
  if (payload.record) return payload.record.values

  return Object.fromEntries(
    entityDefinitions[entity].fields.map((field) => {
      if (field.kind === 'checkbox') return [field.key, false]
      if (field.kind === 'multi-select') return [field.key, []]
      if (entity === 'dives' && field.key === 'diveDate') {
        return [field.key, new Date().toISOString().slice(0, 10)]
      }
      if (entity === 'dives' && field.key === 'durationSeconds') {
        return [field.key, '0']
      }
      return [field.key, '']
    }),
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
  options: EditorOption[]
  onChange: (value: EditorValue) => void
}) {
  if (field.kind === 'checkbox') {
    const checkboxId = `field-${field.key}`
    return (
      <label
        htmlFor={checkboxId}
        className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-4 text-sm font-medium"
      >
        <Checkbox
          id={checkboxId}
          checked={value === true}
          disabled={field.readOnly}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        {field.label}
      </label>
    )
  }

  if (field.kind === 'multi-select') {
    const selected = Array.isArray(value) ? value : []
    return (
      <fieldset>
        <legend className="text-sm font-semibold">{field.label}</legend>
        {options.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No records available.</p>
        ) : (
          <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-border bg-background p-3 sm:grid-cols-2">
            {options.map((option) => (
              <label
                key={option.value}
                htmlFor={`field-${field.key}-${option.value}`}
                className="flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted"
              >
                <Checkbox
                  id={`field-${field.key}-${option.value}`}
                  checked={selected.includes(option.value)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true
                        ? [...selected, option.value]
                        : selected.filter((item) => item !== option.value),
                    )
                  }
                />
                <span className="truncate">{option.label}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    )
  }

  const stringValue = typeof value === 'string' ? value : ''
  const inputId = `field-${field.key}`
  return (
    <label htmlFor={inputId} className="block text-sm font-semibold">
      {field.label}
      {field.required ? <span className="text-red-600"> *</span> : null}
      {field.kind === 'textarea' ? (
        <Textarea
          id={inputId}
          value={stringValue}
          readOnly={field.readOnly}
          required={field.required}
          rows={5}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2"
        />
      ) : field.kind === 'select' ? (
        <Select
          value={stringValue}
          disabled={field.readOnly}
          onValueChange={(value) => {
            if (value !== null) onChange(value)
          }}
        >
          <SelectTrigger id={inputId} className="mt-2">
            <SelectValue placeholder="Not set" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={inputId}
          type={field.kind}
          value={stringValue}
          readOnly={field.readOnly}
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

export function RecordEditorPage({
  entity,
  recordId,
  payload,
}: {
  entity: EntityKey
  recordId: string
  payload: DataEditorPayload
}) {
  const definition = entityDefinitions[entity]
  const router = useRouter()
  const [values, setValues] = useState(() => initialValues(entity, payload))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const sections = Array.from(new Set(definition.fields.map((field) => field.section)))
  const isNew = recordId === 'new'

  function updateField(key: string, value: EditorValue) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const result = await saveRecord({ data: { entity, recordId, values } })
      if (isNew) {
        await router.navigate({
          to: '/data/$entity/$recordId',
          params: { entity, recordId: result.id },
        })
      }
      await router.invalidate()
      setMessage('Saved successfully.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the record')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header>
        <Link
          to="/data/$entity"
          params={{ entity }}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> {definition.plural}
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              {definition.mutable ? (isNew ? 'Create record' : 'Edit record') : 'Record'}
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              {isNew ? `New ${definition.singular.toLowerCase()}` : definition.singular}
            </h1>
          </div>
          {entity === 'dives' && !isNew ? (
            <Link
              to="/dives/$diveId"
              params={{ diveId: recordId }}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
            >
              View dive <ExternalLink size={15} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </header>

      {payload.record?.sourceKey === 'divemate' ? (
        <Alert variant="warning">
          <ShieldAlert
            className="mt-0.5 shrink-0 text-amber-600"
            size={21}
            aria-hidden="true"
          />
          <div>
            <AlertTitle>Imported from DiveMate</AlertTitle>
            <AlertDescription>
              You can edit this record, but a later synchronization may refresh fields
              owned by the DiveMate source. The original source payload remains preserved.
            </AlertDescription>
          </div>
        </Alert>
      ) : null}

      {payload.record ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Record metadata</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Record ID
              </dt>
              <dd className="mt-1 break-all font-mono text-xs">{payload.record.id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Source
              </dt>
              <dd className="mt-1 font-medium">{payload.record.sourceKey}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Source ID
              </dt>
              <dd className="mt-1 font-medium">{payload.record.externalId || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Source UUID
              </dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {payload.record.externalUuid || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Source changed
              </dt>
              <dd className="mt-1 font-medium">
                {payload.record.sourceUpdatedAt || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Created
              </dt>
              <dd className="mt-1 font-medium">
                {payload.record.createdAt?.replace('T', ' ').replace('Z', ' UTC') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Last changed
              </dt>
              <dd className="mt-1 font-medium">
                <time dateTime={payload.record.updatedAt}>
                  {payload.record.updatedAt.replace('T', ' ').replace('Z', ' UTC')}
                </time>
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {payload.record?.sourcePayload ? (
        <details className="rounded-2xl border border-border bg-card p-5">
          <summary className="cursor-pointer text-sm font-semibold">
            Raw source payload
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">
            Read-only data retained from the source for fields that are not part of the
            normalized model.
          </p>
          <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-muted p-4 font-mono text-xs leading-5">
            {payload.record.sourcePayload}
          </pre>
        </details>
      ) : null}

      {payload.record?.media.length ? (
        <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <h2 className="text-lg font-semibold">Pictures</h2>
          <PictureGallery pictures={payload.record.media} />
        </section>
      ) : null}

      <form onSubmit={(event) => void submit(event)} className="space-y-6">
        {sections.map((section) => (
          <section
            key={section}
            className="rounded-2xl border border-border bg-card p-6 md:p-8"
          >
            <h2 className="text-lg font-semibold">{section}</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {definition.fields
                .filter((field) => field.section === section)
                .map((field) => (
                  <div
                    key={field.key}
                    className={
                      field.kind === 'textarea' || field.kind === 'multi-select'
                        ? 'sm:col-span-2'
                        : undefined
                    }
                  >
                    <FieldControl
                      field={field}
                      value={values[field.key]}
                      options={payload.options[field.key] ?? []}
                      onChange={(value) => updateField(field.key, value)}
                    />
                  </div>
                ))}
            </div>
          </section>
        ))}

        {definition.mutable ? (
          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur md:px-6">
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {message ||
                (isNew
                  ? 'This record will be stored as manual data.'
                  : 'Unsaved changes stay in this browser.')}
            </p>
            <Button type="submit" disabled={saving} className="px-6">
              <Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Synchronization history is immutable and cannot be edited.
          </p>
        )}
      </form>
    </div>
  )
}
