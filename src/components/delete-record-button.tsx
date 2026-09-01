import { useRouter } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { EntityKey } from '@/modules/data/entities'
import { deleteRecord } from '@/modules/data/server/mutations'

export function DeleteRecordButton({
  entity,
  recordId,
  label,
  confirmText,
  onDeleted,
}: {
  entity: Exclude<EntityKey, 'divers'>
  recordId: string
  label: string
  confirmText: string
  onDeleted: () => void | Promise<void>
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function run() {
    if (!window.confirm(confirmText)) return
    setDeleting(true)
    setMessage(null)
    try {
      await deleteRecord({ data: { entity, recordId } })
      await router.invalidate()
      await onDeleted()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Deleting failed')
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="ghost"
        disabled={deleting}
        onClick={() => void run()}
        className="text-red-600 hover:bg-red-500/10 hover:text-red-600"
      >
        <Trash2 size={15} aria-hidden="true" /> {deleting ? 'Deleting…' : label}
      </Button>
      {message ? (
        <p aria-live="polite" className="text-sm text-red-600">
          {message}
        </p>
      ) : null}
    </div>
  )
}
