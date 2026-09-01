import { Link, useRouter } from '@tanstack/react-router'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { RatingInput } from '@/components/entity-form'
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
import { formatPersonName } from '@/modules/dives/format'
import { deleteDive, saveDive } from '@/modules/dives/server/mutations'
import type { getDiveEditor } from '@/modules/dives/server/queries'

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
    waterType: dive?.waterType ? String(dive.waterType) : '',
    entryType: dive?.entryType ? String(dive.entryType) : '',
    visibility: dive?.visibility ?? '',
    current: dive?.current ?? '',
    waves: dive?.waves ?? '',
    weather: dive?.weather ?? '',
    rating: dive?.rating ?? 0,
    computer: dive?.computer ?? '',
    suit: dive?.suit ?? '',
    boat: dive?.boat ?? '',
    divemaster: dive?.divemaster ?? '',
    notes: dive?.notes ?? '',
    siteId: dive?.siteId ?? '',
    shopId: dive?.shopId ?? '',
    diveTypeId: dive?.diveTypeId ?? '',
    newShopName: '',
    newDiveTypeName: '',
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

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: (id: string) => React.ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <label htmlFor={id} className={`block text-sm font-semibold ${className ?? ''}`}>
      {label}
      {children(id)}
    </label>
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
  const [buddyIds, setBuddyIds] = useState(() => new Set(data.buddyIds))
  const [equipmentIds, setEquipmentIds] = useState(() => new Set(data.equipmentIds))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
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
    try {
      const result = await saveDive({
        data: {
          diveId,
          dive,
          buddyIds: [...buddyIds],
          equipmentIds: [...equipmentIds],
          tanks: tanks.map(({ key: _key, ...tank }) => tank),
        },
      })
      await router.invalidate()
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
          <Field label="Dive type">
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
          <Field label="Or add a new type">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={dive.newDiveTypeName}
                placeholder="e.g. Night dive"
                onChange={(event) => update('newDiveTypeName', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Dive shop / operator" className="sm:col-span-2 lg:col-span-2">
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
          <Field label="Or add a new shop" className="sm:col-span-2 lg:col-span-2">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={dive.newShopName}
                placeholder="e.g. Blue Ocean Diving"
                onChange={(event) => update('newShopName', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
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
        <label
          htmlFor="dive-decompression"
          className="mt-5 flex min-h-11 max-w-xs items-center gap-3 rounded-xl border border-border bg-background px-4 text-sm font-medium"
        >
          <Checkbox
            id="dive-decompression"
            checked={dive.decompressionDive}
            onCheckedChange={(checked) => update('decompressionDive', checked === true)}
          />
          Decompression dive
        </label>
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
        <fieldset>
          <legend className="text-sm font-semibold">Buddies</legend>
          {data.options.buddies.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No buddies yet — add them under Buddies first.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.options.buddies.map((buddy) => (
                <label
                  key={buddy.id}
                  htmlFor={`buddy-${buddy.id}`}
                  className="flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted"
                >
                  <Checkbox
                    id={`buddy-${buddy.id}`}
                    checked={buddyIds.has(buddy.id)}
                    onCheckedChange={(checked) =>
                      setBuddyIds((current) =>
                        toggleId(current, buddy.id, checked === true),
                      )
                    }
                  />
                  <span className="truncate">{formatPersonName(buddy)}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Divemaster / guide">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={dive.divemaster}
                onChange={(event) => update('divemaster', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
          <Field label="Boat">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={dive.boat}
                onChange={(event) => update('boat', event.target.value)}
                className="mt-2"
              />
            )}
          </Field>
        </div>
      </EditorSection>

      <EditorSection title="Gear">
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
        <Button type="submit" disabled={saving} className="px-6">
          <Save size={16} aria-hidden="true" />{' '}
          {saving ? 'Saving…' : isNew ? 'Log dive' : 'Save dive'}
        </Button>
      </div>
    </form>
  )
}
