import { Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addDiveType,
  type getDiveTypes,
  removeDiveType,
  updateDiveType,
} from '@/modules/dives/server/dive-types'

type DiveType = Awaited<ReturnType<typeof getDiveTypes>>[number]

function DiveTypeRow({ diveType }: { diveType: DiveType }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(diveType.name)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await updateDiveType({ data: { id: diveType.id, name } })
      await router.invalidate()
      setEditing(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Renaming failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${diveType.name}”?`)) return
    setSaving(true)
    setMessage(null)
    try {
      await removeDiveType({ data: { id: diveType.id } })
      await router.invalidate()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Deleting failed')
      setSaving(false)
    }
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      {editing ? (
        <form onSubmit={(event) => void save(event)} className="flex gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label={`Rename ${diveType.name}`}
            required
            maxLength={120}
            autoFocus
          />
          <Button
            type="submit"
            size="icon"
            disabled={saving || !name.trim()}
            aria-label="Save"
          >
            <Check size={16} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={saving}
            aria-label="Cancel"
            onClick={() => {
              setName(diveType.name)
              setMessage(null)
              setEditing(false)
            }}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{diveType.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {diveType.diveCount.toLocaleString()}{' '}
              {diveType.diveCount === 1 ? 'dive' : 'dives'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={saving}
            onClick={() => setEditing(true)}
            aria-label={`Rename ${diveType.name}`}
          >
            <Pencil size={16} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={saving || diveType.diveCount > 0}
            onClick={() => void remove()}
            aria-label={
              diveType.diveCount > 0
                ? `${diveType.name} is in use and cannot be deleted`
                : `Delete ${diveType.name}`
            }
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
      {message ? (
        <p aria-live="polite" className="mt-2 text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </li>
  )
}

export function DiveTypesPage({ diveTypes }: { diveTypes: DiveType[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await addDiveType({ data: { name } })
      setName('')
      await router.invalidate()
      setMessage('Dive type added.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Adding the dive type failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <Link
          to="/settings"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to settings
        </Link>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Settings
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Dive types</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Keep imported and custom dive classifications in one list. Renaming a type
          updates it everywhere it is used.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <h2 className="font-semibold">Add a custom dive type</h2>
        <form onSubmit={(event) => void add(event)} className="mt-4 flex gap-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Reef survey"
            aria-label="Dive type name"
            required
            maxLength={120}
          />
          <Button type="submit" disabled={saving || !name.trim()}>
            <Plus size={16} aria-hidden="true" /> {saving ? 'Adding…' : 'Add'}
          </Button>
        </form>
        <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
          {message}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Available types · {diveTypes.length}
        </h2>
        {diveTypes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No dive types yet. Add one above or import them from DiveMate.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {diveTypes.map((diveType) => (
              <DiveTypeRow key={diveType.id} diveType={diveType} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
