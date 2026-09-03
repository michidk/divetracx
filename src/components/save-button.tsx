import { Check, LoaderCircle, Save } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

const SAVED_INDICATOR_DURATION_MS = 2_000

export function useTransientSavedState() {
  const [saved, setSaved] = useState(false)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearSaved() {
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = null
    setSaved(false)
  }

  function markSaved() {
    if (timeout.current) clearTimeout(timeout.current)
    setSaved(true)
    timeout.current = setTimeout(() => {
      timeout.current = null
      setSaved(false)
    }, SAVED_INDICATOR_DURATION_MS)
  }

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current)
    },
    [],
  )

  return { saved, clearSaved, markSaved }
}

export function SaveButton({
  saving,
  saved,
  children,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & {
  saving: boolean
  saved: boolean
}) {
  return (
    <Button disabled={saving || disabled} {...props}>
      {saving ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : saved ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Save className="size-4" aria-hidden="true" />
      )}
      {children}
      <span className="sr-only" aria-live="polite">
        {saving ? 'Saving.' : saved ? 'Saved.' : ''}
      </span>
    </Button>
  )
}
