import { useRouter } from '@tanstack/react-router'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface TaxonomyItem {
  id: string
  name: string
  diveCount: number
}

interface TaxonomyManagerProps {
  singular: string
  plural: string
  placeholder: string
  emptyMessage: string
  items: TaxonomyItem[]
  onAdd: (name: string) => Promise<unknown>
  onRename: (id: string, name: string) => Promise<unknown>
  onRemove: (id: string) => Promise<unknown>
}

function TaxonomyRow({
  item,
  onRename,
  onRemove,
}: {
  item: TaxonomyItem
  onRename: TaxonomyManagerProps['onRename']
  onRemove: TaxonomyManagerProps['onRemove']
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await onRename(item.id, name)
      await router.invalidate()
      setEditing(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Renaming failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${item.name}”?`)) return
    setSaving(true)
    setMessage(null)
    try {
      await onRemove(item.id)
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
            aria-label={`Rename ${item.name}`}
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
              setName(item.name)
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
            <p className="truncate font-semibold">{item.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.diveCount.toLocaleString()} {item.diveCount === 1 ? 'dive' : 'dives'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={saving}
            onClick={() => setEditing(true)}
            aria-label={`Rename ${item.name}`}
          >
            <Pencil size={16} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={saving || item.diveCount > 0}
            onClick={() => void remove()}
            aria-label={
              item.diveCount > 0
                ? `${item.name} is in use and cannot be deleted`
                : `Delete ${item.name}`
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

export function TaxonomyManager({
  singular,
  plural,
  placeholder,
  emptyMessage,
  items,
  onAdd,
  onRename,
  onRemove,
}: TaxonomyManagerProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await onAdd(name)
      setName('')
      await router.invalidate()
      setMessage(`${singular} added.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Adding the ${singular} failed`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <h2 className="font-semibold">Add {singular.toLowerCase()}</h2>
        <form onSubmit={(event) => void add(event)} className="mt-4 flex gap-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={placeholder}
            aria-label={`${singular} name`}
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
          Available {plural.toLowerCase()} · {items.length}
        </h2>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <ul className="grid gap-3">
            {items.map((item) => (
              <TaxonomyRow
                key={item.id}
                item={item}
                onRename={onRename}
                onRemove={onRemove}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
