import { useRouter } from '@tanstack/react-router'
import { Camera, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import diverFallbackUrl from '@/assets/diver-fallback.png?url'
import { Button } from '@/components/ui/button'
import { deletePicture } from '@/modules/media/server/mutations'

interface ProfileImageRecord {
  id: string
  storagePath: string | null
  thumbnailStoragePath: string | null
}

function mediaUrl(path: string) {
  return `/media/${path.split('/').map(encodeURIComponent).join('/')}`
}

export function ProfileImage({
  diverId,
  image,
}: {
  diverId: string | null
  image: ProfileImageRecord | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const imagePath = image?.thumbnailStoragePath ?? image?.storagePath

  async function upload(files: FileList | null) {
    const file = files?.item(0)
    if (!file || !diverId) return
    setBusy(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.set('target', 'profile')
      form.set('id', diverId)
      form.set('files', file)
      const response = await fetch('/api/media/upload', { method: 'POST', body: form })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error || 'Upload failed')
      }
      await router.invalidate()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove() {
    if (!image || !window.confirm('Remove your profile image?')) return
    setBusy(true)
    setMessage(null)
    try {
      await deletePicture({ data: { pictureId: image.id } })
      await router.invalidate()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Removing failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:items-end">
      <div className="grid size-32 place-items-center overflow-hidden rounded-full border-4 border-card bg-accent shadow-lg ring-1 ring-border">
        {imagePath ? (
          <img
            src={mediaUrl(imagePath)}
            alt="Diver profile"
            className="size-full object-cover"
          />
        ) : (
          <img
            src={diverFallbackUrl}
            alt="Generic scuba diver profile"
            className="size-full object-cover"
          />
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-label="Choose a profile image"
        onChange={(event) => void upload(event.target.files)}
      />
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !diverId}
          onClick={() => inputRef.current?.click()}
        >
          <Camera size={15} aria-hidden="true" />
          {busy ? 'Working…' : image ? 'Change image' : 'Add image'}
        </Button>
        {image ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            aria-label="Remove profile image"
            onClick={() => void remove()}
          >
            <Trash2 size={15} aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {!diverId ? (
        <p className="max-w-48 text-center text-xs text-muted-foreground sm:text-right">
          Save your personal details before adding an image.
        </p>
      ) : null}
      <p aria-live="polite" className="max-w-56 text-center text-xs text-red-600">
        {message}
      </p>
    </div>
  )
}
