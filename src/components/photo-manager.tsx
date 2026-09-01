import { useRouter } from '@tanstack/react-router'
import { ImagePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { type GalleryPicture, PictureGallery } from '@/components/picture-gallery'
import { Button } from '@/components/ui/button'
import { deletePicture } from '@/modules/media/server/mutations'

export function PhotoManager({
  target,
  targetId,
  pictures,
}: {
  target: 'dive' | 'site'
  targetId: string
  pictures: GalleryPicture[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.set('target', target)
      form.set('id', targetId)
      for (const file of files) form.append('files', file)
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

  async function remove(picture: GalleryPicture) {
    if (!window.confirm('Delete this photo? This cannot be undone.')) return
    setBusy(true)
    setMessage(null)
    try {
      await deletePicture({ data: { pictureId: picture.id } })
      await router.invalidate()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Deleting failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="sr-only"
          aria-label="Choose photos to upload"
          onChange={(event) => void upload(event.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus size={15} aria-hidden="true" /> {busy ? 'Working…' : 'Add photos'}
        </Button>
        <p aria-live="polite" className="text-sm text-red-600">
          {message}
        </p>
      </div>
      {pictures.length > 0 ? (
        <PictureGallery
          pictures={pictures}
          onDelete={(picture) => void remove(picture)}
        />
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No photos yet.</p>
      )}
    </div>
  )
}
