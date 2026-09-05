import { Link, useRouter } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { RatingInput } from '@/components/entity-form'
import { SaveButton, useTransientSavedState } from '@/components/save-button'
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
import { ENTRY_TYPE_OPTIONS, WATER_TYPE_OPTIONS } from '@/modules/dives/codes'
import { deleteDive, saveDive } from '@/modules/dives/server/mutations'
import type { getDiveEditor } from '@/modules/dives/server/queries'
import { BuddyPicker } from './buddy-picker'

export type DiveEditorData = NonNullable<Awaited<ReturnType<typeof getDiveEditor>>>

interface TankDraft {
  key: string
  id: string | null
  name: string
  volumeLiters: string
  oxygenPercent: string
  heliumPercent: string
  startPressureBar: string
  endPressureBar: string
}

function numberString(value: number | string | null) {
  return value === null ? '' : String(value)
}

function minutesString(seconds: number | null) {
  if (seconds === null) return ''
  const minutes = seconds / 60
  return Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1)
}

function initialDiveState(data: DiveEditorData) {
  const dive = data.dive
  return {
    number: dive ? numberString(dive.number) : String(data.nextNumber),
    diveDate: dive?.diveDate ?? new Date().toISOString().slice(0, 10),
    entryTime: dive?.entryTime?.slice(0, 5) ?? '',
    durationMinutes: dive ? minutesString(dive.durationSeconds) : '',
    surfaceIntervalMinutes: minutesString(dive?.surfaceIntervalSeconds ?? null),
    maximumDepthMeters: numberString(dive?.maximumDepthMeters ?? null),
    averageDepthMeters: numberString(dive?.averageDepthMeters ?? null),
    airTemperatureCelsius: numberString(dive?.airTemperatureCelsius ?? null),
    waterTemperatureCelsius: numberString(dive?.waterTemperatureCelsius ?? null),
    weightKg: numberString(dive?.weightKg ?? null),
    equipmentWeightKg: numberString(dive?.equipmentWeightKg ?? null),
    decompressionDive: dive?.decompressionDive ?? false,
    safetyStop: dive?.safetyStop ?? false,
    safetyStopMinutes: minutesString(dive?.safetyStopSeconds ?? null),
    pressureGroupBeforeInterval: dive?.pressureGroupBeforeInterval ?? '',
    pressureGroupAfterInterval: dive?.pressureGroupAfterInterval ?? '',
    pressureGroupEnd: dive?.pressureGroupEnd ?? '',
    residualNitrogenMinutes: minutesString(dive?.residualNitrogenSeconds ?? null),
    waterType: dive?.waterType ? String(dive.waterType) : '',
    entryType: dive?.entryType ? String(dive.entryType) : '',
    visibility: dive?.visibility ?? '',
    current: dive?.current ?? '',
    waves: dive?.waves ?? '',
    weather: dive?.weather ?? '',
    rating: dive?.rating ?? 0,
    computer: dive?.computer ?? '',
    suit: dive?.suit ?? '',
    boatId: dive?.boatId ?? '',
    notes: dive?.notes ?? '',
    siteId: dive?.siteId ?? '',
    shopId: dive?.shopId ?? '',
    diveTypeId: dive?.diveTypeId ?? '',
  }
}

function initialTanks(data: DiveEditorData): TankDraft[] {
  return data.tanks.map((tank, index) => ({
    key: tank.id ?? `tank-${index}`,
    id: tank.id,
    name: tank.name ?? '',
    volumeLiters: numberString(tank.volumeLiters),
    oxygenPercent: numberString(tank.oxygenPercent),
    heliumPercent: numberString(tank.heliumPercent),
    startPressureBar: numberString(tank.startPressureBar),
    endPressureBar: numberString(tank.endPressureBar),
  }))
}

function codeSelectOptions(
  options: ReadonlyArray<{ code: number; label: string }>,
  current: string,
) {
  const items = [
    { value: '', label: 'Not set' },
    ...options.map((option) => ({ value: String(option.code), label: option.label })),
  ]
  if (current && !items.some((item) => item.value === current)) {
    items.push({ value: current, label: `Code ${current}` })
  }
  return items
}

function CodeSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string
  value: string
  options: ReadonlyArray<{ code: number; label: string }>
  onChange: (value: string) => void
}) {
  const items = codeSelectOptions(options, value)
  return (
    <Select value={value} items={items} onValueChange={(next) => onChange(next ?? '')}>
      <SelectTrigger id={id} className="mt-2">
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
  )
}

function PressureGroupInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Input
      id={id}
      type="text"
      maxLength={1}
      pattern="[A-Za-z]"
      autoCapitalize="characters"
      placeholder="A–Z"
      value={value}
      onChange={(event) => onChange(event.target.value.toUpperCase())}
      className="mt-2 font-mono uppercase"
    />
  )
}

function totalBottomTimeLabel(residualNitrogenMinutes: string, durationMinutes: string) {
  const residual =
    residualNitrogenMinutes.trim() === '' ? null : Number(residualNitrogenMinutes)
  const duration = durationMinutes.trim() === '' ? null : Number(durationMinutes)
  if (residual === null || duration === null) return '—'
  if (!Number.isFinite(residual) || !Number.isFinite(duration)) return '—'
  return `${Math.round(residual)} + ${Math.round(duration)} = ${Math.round(residual + duration)} min`
}

function Field({
  label,
  children,
  className,
  action,
}: {
  label: string
  children: (id: string) => React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  const id = useId()
  return (
    <div className={`block text-sm font-semibold ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id}>{label}</label>
        {action}
      </div>
      {children(id)}
    </div>
  )
}

function EditorSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function DiveEditor({
  diveId,
  data,
}: {
  diveId: string | 'new'
  data: DiveEditorData
}) {
  const router = useRouter()
  const [dive, setDive] = useState(() => initialDiveState(data))
  const [tanks, setTanks] = useState(() => initialTanks(data))
  const [buddyAssignments, setBuddyAssignments] = useState(() => data.buddyAssignments)
  const [equipmentIds, setEquipmentIds] = useState(() => new Set(data.equipmentIds))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { saved, clearSaved, markSaved } = useTransientSavedState()
  const isNew = diveId === 'new'

  function update<Key extends keyof ReturnType<typeof initialDiveState>>(
    key: Key,
    value: ReturnType<typeof initialDiveState>[Key],
  ) {
    setDive((current) => ({ ...current, [key]: value }))
  }

  function updateTank(key: string, patch: Partial<TankDraft>) {
    setTanks((current) =>
      current.map((tank) => (tank.key === key ? { ...tank, ...patch } : tank)),
    )
  }

  function toggleId(set: Set<string>, id: string, checked: boolean) {
    const next = new Set(set)
    if (checked) next.add(id)
    else next.delete(id)
    return next
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    clearSaved()
    try {
      const result = await saveDive({
        data: {
          diveId,
          dive,
          buddyAssignments,
          equipmentIds: [...equipmentIds],
          tanks: tanks.map(({ key: _key, ...tank }) => tank),
        },
      })
      await router.invalidate()
      markSaved()
      setSaving(false)
      await router.navigate({ to: '/dives/$diveId', params: { diveId: result.id } })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the dive')
      setSaving(false)
    }
  }

  async function removeDive() {
    if (isNew) return
    if (
      !window.confirm('Delete this dive and its recorded profile? This cannot be undone.')
    ) {
      return
    }
    setDeleting(true)
    setMessage(null)
    try {
      await deleteDive({ data: { diveId } })
      await router.invalidate()
      await router.navigate({ to: '/dives' })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete the dive')
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-6">
      <EditorSection title="Dive">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dive number">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={1}
                step="1"
                value={dive.number}
                onChange={(event) => update('number', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Date *">
            {(id) => (
              <Input
                id={id}
                type="date"
                required
                value={dive.diveDate}
                onChange={(event) => update('diveDate', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Entry time">
            {(id) => (
              <Input
                id={id}
                type="time"
                value={dive.entryTime}
                onChange={(event) => update('entryTime', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <div className="text-sm font-semibold">
            Rating
            <RatingInput
              id="dive-rating"
              value={dive.rating}
              onChange={(rating) => update('rating', rating)}
            />
          </div>
          <Field label="Dive site" className="sm:col-span-2">
            {(id) => (
              <div className="mt-2 flex items-center gap-3">
                <Select
                  value={dive.siteId}
                  items={[
                    { value: '', label: 'Not set' },
                    ...data.options.sites.map((site) => ({
                      value: site.id,
                      label: site.country ? `${site.name} · ${site.country}` : site.name,
                    })),
                  ]}
                  onValueChange={(value) => update('siteId', value ?? '')}
                >
                  <SelectTrigger id={id} className="flex-1">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not set</SelectItem>
                    {data.options.sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.country ? `${site.name} · ${site.country}` : site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Link
                  to="/sites/new"
                  className="shrink-0 text-xs font-semibold text-primary hover:underline"
                >
                  New site
                </Link>
              </div>
            )}
          </Field>
          <Field
            label="Dive type"
            action={
              <Link
                to="/settings/dive-types"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Manage types
              </Link>
            }
          >
            {(id) => (
              <Select
                value={dive.diveTypeId}
                items={[
                  { value: '', label: 'Not set' },
                  ...data.options.diveTypes.map((type) => ({
                    value: type.id,
                    label: type.name,
                  })),
                ]}
                onValueChange={(value) => update('diveTypeId', value ?? '')}
              >
                <SelectTrigger id={id} className="mt-2">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Not set</SelectItem>
                  {data.options.diveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <div className="grid gap-5 sm:col-span-2 sm:grid-cols-2 lg:col-span-4">
            <Field
              label="Dive operator"
              action={
                <Link
                  to="/settings/operators-boats"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Manage
                </Link>
              }
            >
              {(id) => (
                <Select
                  value={dive.shopId}
                  items={[
                    { value: '', label: 'Not set' },
                    ...data.options.shops.map((shop) => ({
                      value: shop.id,
                      label: shop.name,
                    })),
                  ]}
                  onValueChange={(value) => update('shopId', value ?? '')}
                >
                  <SelectTrigger id={id} className="mt-2">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not set</SelectItem>
                    {data.options.shops.map((shop) => (
                      <SelectItem key={shop.id} value={shop.id}>
                        {shop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field
              label="Boat"
              action={
                <Link
                  to="/settings/operators-boats"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Manage
                </Link>
              }
            >
              {(id) => (
                <Select
                  value={dive.boatId}
                  items={[
                    { value: '', label: 'Not set' },
                    ...data.options.boats.map((boat) => ({
                      value: boat.id,
                      label: boat.name,
                    })),
                  ]}
                  onValueChange={(value) => update('boatId', value ?? '')}
                >
                  <SelectTrigger id={id} className="mt-2">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not set</SelectItem>
                    {data.options.boats.map((boat) => (
                      <SelectItem key={boat.id} value={boat.id}>
                        {boat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
        </div>
      </EditorSection>

      <EditorSection title="Depth & time">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Duration (min)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step="0.1"
                value={dive.durationMinutes}
                onChange={(event) => update('durationMinutes', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Maximum depth (m)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step="0.1"
                value={dive.maximumDepthMeters}
                onChange={(event) => update('maximumDepthMeters', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Average depth (m)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step="0.1"
                value={dive.averageDepthMeters}
                onChange={(event) => update('averageDepthMeters', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Surface interval (min)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step="1"
                value={dive.surfaceIntervalMinutes}
                onChange={(event) => update('surfaceIntervalMinutes', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <label
            htmlFor="dive-decompression"
            className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-4 text-sm font-medium"
          >
            <Checkbox
              id="dive-decompression"
              checked={dive.decompressionDive}
              onCheckedChange={(checked) => update('decompressionDive', checked === true)}
            />
            Decompression dive
          </label>
          <div className="flex items-center gap-2">
            <label
              htmlFor="dive-safety-stop"
              className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-4 text-sm font-medium"
            >
              <Checkbox
                id="dive-safety-stop"
                checked={dive.safetyStop}
                onCheckedChange={(checked) => update('safetyStop', checked === true)}
              />
              Safety stop
            </label>
            <Input
              type="number"
              min={0}
              step="1"
              inputMode="numeric"
              aria-label="Safety stop minutes"
              disabled={!dive.safetyStop}
              value={dive.safetyStopMinutes}
              placeholder="3"
              onChange={(event) => update('safetyStopMinutes', event.target.value)}
              className="w-20 text-center"
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </div>
        <fieldset className="mt-6 border-t border-border pt-5">
          <legend className="sr-only">Dive tables</legend>
          <p className="text-sm font-semibold">Dive tables</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pressure-group letters and residual nitrogen time from a paper logbook. Total
            bottom time is residual nitrogen time plus the dive duration.
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="PG before interval">
              {(id) => (
                <PressureGroupInput
                  id={id}
                  value={dive.pressureGroupBeforeInterval}
                  onChange={(value) => update('pressureGroupBeforeInterval', value)}
                />
              )}
            </Field>
            <Field label="PG after interval">
              {(id) => (
                <PressureGroupInput
                  id={id}
                  value={dive.pressureGroupAfterInterval}
                  onChange={(value) => update('pressureGroupAfterInterval', value)}
                />
              )}
            </Field>
            <Field label="PG at end">
              {(id) => (
                <PressureGroupInput
                  id={id}
                  value={dive.pressureGroupEnd}
                  onChange={(value) => update('pressureGroupEnd', value)}
                />
              )}
            </Field>
            <Field label="Residual nitrogen (min)">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  step="1"
                  value={dive.residualNitrogenMinutes}
                  onChange={(event) =>
                    update('residualNitrogenMinutes', event.target.value)
                  }
                  className="mt-2"
                />
              )}
            </Field>
            <div className="text-sm font-semibold">
              Total bottom time
              <p className="mt-2 flex min-h-11 items-center rounded-xl bg-muted/60 px-4 font-mono text-sm font-medium">
                {totalBottomTimeLabel(dive.residualNitrogenMinutes, dive.durationMinutes)}
              </p>
            </div>
          </div>
        </fieldset>
      </EditorSection>

      <EditorSection title="Conditions">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Water temperature (°C)">
            {(id) => (
              <Input
                id={id}
                type="number"
                step="0.1"
                value={dive.waterTemperatureCelsius}
                onChange={(event) =>
                  update('waterTemperatureCelsius', event.target.value)
                }
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Air temperature (°C)">
            {(id) => (
              <Input
                id={id}
                type="number"
                step="0.1"
                value={dive.airTemperatureCelsius}
                onChange={(event) => update('airTemperatureCelsius', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Water">
            {(id) => (
              <CodeSelect
                id={id}
                value={dive.waterType}
                options={WATER_TYPE_OPTIONS}
                onChange={(value) => update('waterType', value)}
              />
            )}
          </Field>
          <Field label="Entry">
            {(id) => (
              <CodeSelect
                id={id}
                value={dive.entryType}
                options={ENTRY_TYPE_OPTIONS}
                onChange={(value) => update('entryType', value)}
              />
            )}
          </Field>
          <Field label="Visibility">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={dive.visibility}
                placeholder="e.g. 15 m"
                onChange={(event) => update('visibility', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Current">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={dive.current}
                onChange={(event) => update('current', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Waves">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={dive.waves}
                onChange={(event) => update('waves', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Weather">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={dive.weather}
                onChange={(event) => update('weather', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
        </div>
      </EditorSection>

      <EditorSection
        title="Tanks & gas"
        description="Cylinders you took on this dive. Pressure readings recorded by a dive computer stay linked automatically."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tanks.map((tank, index) => (
            <article key={tank.key} className="rounded-xl bg-muted/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Tank {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-red-600"
                  onClick={() =>
                    setTanks((current) => current.filter((item) => item.key !== tank.key))
                  }
                >
                  <Trash2 size={14} aria-hidden="true" /> Remove
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Name" className="col-span-2">
                  {(id) => (
                    <Input
                      id={id}
                      type="text"
                      value={tank.name}
                      placeholder="e.g. 12 L steel"
                      onChange={(event) =>
                        updateTank(tank.key, { name: event.target.value })
                      }
                      className="mt-2 bg-background"
                    />
                  )}
                </Field>
                <Field label="Volume (L)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      step="0.1"
                      value={tank.volumeLiters}
                      onChange={(event) =>
                        updateTank(tank.key, { volumeLiters: event.target.value })
                      }
                      className="mt-2 bg-background"
                    />
                  )}
                </Field>
                <Field label="Oxygen (%)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={tank.oxygenPercent}
                      placeholder="21"
                      onChange={(event) =>
                        updateTank(tank.key, { oxygenPercent: event.target.value })
                      }
                      className="mt-2 bg-background"
                    />
                  )}
                </Field>
                <Field label="Helium (%)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={tank.heliumPercent}
                      onChange={(event) =>
                        updateTank(tank.key, { heliumPercent: event.target.value })
                      }
                      className="mt-2 bg-background"
                    />
                  )}
                </Field>
                <Field label="Start (bar)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      step="1"
                      value={tank.startPressureBar}
                      onChange={(event) =>
                        updateTank(tank.key, { startPressureBar: event.target.value })
                      }
                      className="mt-2 bg-background"
                    />
                  )}
                </Field>
                <Field label="End (bar)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      step="1"
                      value={tank.endPressureBar}
                      onChange={(event) =>
                        updateTank(tank.key, { endPressureBar: event.target.value })
                      }
                      className="mt-2 bg-background"
                    />
                  )}
                </Field>
              </div>
            </article>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() =>
            setTanks((current) => [
              ...current,
              {
                key: `new-${Date.now()}-${current.length}`,
                id: null,
                name: '',
                volumeLiters: '',
                oxygenPercent: '',
                heliumPercent: '',
                startPressureBar: '',
                endPressureBar: '',
              },
            ])
          }
        >
          <Plus size={15} aria-hidden="true" /> Add tank
        </Button>
      </EditorSection>

      <EditorSection title="People">
        <BuddyPicker
          options={data.options.buddies}
          value={buddyAssignments}
          onChange={setBuddyAssignments}
        />
      </EditorSection>

      <EditorSection title="Gear">
        {data.options.equipmentSets.length > 0 ? (
          <fieldset className="mb-5">
            <legend className="text-sm font-semibold">Quick-select a gear set</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.options.equipmentSets.map((set) => {
                const selected =
                  set.equipmentIds.length > 0 &&
                  set.equipmentIds.every((id) => equipmentIds.has(id))
                return (
                  <button
                    key={set.id}
                    type="button"
                    disabled={set.equipmentIds.length === 0 || selected}
                    aria-pressed={selected}
                    onClick={() =>
                      setEquipmentIds((current) => {
                        const next = new Set(current)
                        for (const id of set.equipmentIds) next.add(id)
                        return next
                      })
                    }
                    className={`min-h-10 rounded-xl border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted'
                    } ${set.inactive ? 'opacity-60' : ''}`}
                  >
                    {set.name} · {set.equipmentIds.length}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Sets select their individual items; the dive keeps its own gear history.
            </p>
          </fieldset>
        ) : null}
        <fieldset>
          <legend className="text-sm font-semibold">Gear used</legend>
          {data.options.equipment.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No gear yet — add items under Gear first.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.options.equipment.map((item) => (
                <label
                  key={item.id}
                  htmlFor={`equipment-${item.id}`}
                  className={`flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted ${item.inactive ? 'text-muted-foreground' : ''}`}
                >
                  <Checkbox
                    id={`equipment-${item.id}`}
                    checked={equipmentIds.has(item.id)}
                    onCheckedChange={(checked) =>
                      setEquipmentIds((current) =>
                        toggleId(current, item.id, checked === true),
                      )
                    }
                  />
                  <span className="truncate">
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
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Suit">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={dive.suit}
                onChange={(event) => update('suit', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Dive computer">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={dive.computer}
                onChange={(event) => update('computer', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Lead weight (kg)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step="0.1"
                value={dive.weightKg}
                onChange={(event) => update('weightKg', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Equipment weight (kg)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step="0.1"
                value={dive.equipmentWeightKg}
                onChange={(event) => update('equipmentWeightKg', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
        </div>
      </EditorSection>

      <EditorSection title="Notes">
        <label htmlFor="dive-notes" className="block text-sm font-semibold">
          <span className="sr-only">Notes</span>
          <Textarea
            id="dive-notes"
            value={dive.notes}
            rows={6}
            placeholder="How was the dive?"
            onChange={(event) => update('notes', event.target.value)}
          />
        </label>
      </EditorSection>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur md:px-6">
        <div className="flex items-center gap-4">
          {!isNew ? (
            <Button
              type="button"
              variant="ghost"
              disabled={deleting}
              onClick={() => void removeDive()}
              className="text-red-600 hover:bg-red-500/10 hover:text-red-600"
            >
              <Trash2 size={15} aria-hidden="true" />{' '}
              {deleting ? 'Deleting…' : 'Delete dive'}
            </Button>
          ) : null}
          <p aria-live="polite" className="text-sm text-red-600">
            {message}
          </p>
        </div>
        <SaveButton type="submit" saving={saving} saved={saved} className="px-6">
          {isNew ? 'Log dive' : 'Save dive'}
        </SaveButton>
      </div>
    </form>
  )
}
