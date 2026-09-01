import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { GearSetForm } from '@/modules/gear/components/gear-set-form'
import { deleteGearSetRecord } from '@/modules/gear/server/mutations'
import type { getGearSetEditor } from '@/modules/gear/server/queries'

type GearSetData = NonNullable<Awaited<ReturnType<typeof getGearSetEditor>>>

export function GearSetPage({ data }: { data: GearSetData }) {
  const router = useRouter()
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  if (!data.set) return null

  async function remove() {
    if (!data.set || !window.confirm(`Delete “${data.set.name}”? Gear items are kept.`)) {
      return
    }
    setDeleting(true)
    setMessage(null)
    try {
      await deleteGearSetRecord({ data: { id: data.set.id } })
      await router.invalidate()
      await navigate({ to: '/gear' })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Deleting failed')
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <Link
          to="/gear"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> All gear
        </Link>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          {data.set.name}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {data.equipmentIds.length} {data.equipmentIds.length === 1 ? 'item' : 'items'}{' '}
          in this set.
        </p>
      </header>

      <GearSetForm data={data} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={deleting}
          onClick={() => void remove()}
          className="text-red-600 hover:bg-red-500/10 hover:text-red-600"
        >
          <Trash2 size={15} aria-hidden="true" />
          {deleting ? 'Deleting…' : 'Delete gear set'}
        </Button>
        {message ? (
          <p aria-live="polite" className="text-sm text-red-600">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  )
}
