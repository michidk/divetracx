import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export interface GalleryPicture {
  id: string
  path: string
  storagePath: string | null
  thumbnailStoragePath: string | null
  description: string | null
}

function mediaUrl(path: string) {
  return `/media/${path.split('/').map(encodeURIComponent).join('/')}`
}

export function PictureGallery({
  pictures,
  onDelete,
}: {
  pictures: GalleryPicture[]
  onDelete?: (picture: GalleryPicture) => void
}) {
  const [selected, setSelected] = useState<GalleryPicture | null>(null)
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!selected) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    document.addEventListener('keydown', close)
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    return () => {
      document.removeEventListener('keydown', close)
      document.body.style.overflow = ''
    }
  }, [selected])

  return (
    <>
      <ul className="mt-5 grid gap-5 sm:grid-cols-2">
        {pictures.map((picture) => (
          <li key={picture.id} className="min-w-0">
            {picture.storagePath ? (
              <button
                type="button"
                onClick={() => setSelected(picture)}
                className="block w-full overflow-hidden rounded-xl bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label={`Open ${picture.description || 'picture'}`}
              >
                <img
                  src={mediaUrl(picture.thumbnailStoragePath || picture.storagePath)}
                  alt={picture.description || 'Picture'}
                  className="aspect-[4/3] w-full object-cover transition-transform hover:scale-[1.02]"
                  loading="lazy"
                />
              </button>
            ) : null}
            <div className="mt-3 flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm font-medium">
                {picture.description || picture.path.split('/').at(-1)}
              </p>
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(picture)}
                  className="shrink-0 text-xs font-semibold text-muted-foreground transition hover:text-red-600"
                >
                  Delete
                </button>
              ) : null}
            </div>
            <code className="mt-1 block break-all text-xs text-muted-foreground">
              {picture.path}
            </code>
          </li>
        ))}
      </ul>

      {selected?.storagePath ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selected.description || 'Picture'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 md:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null)
          }}
        >
          <button
            ref={closeButton}
            type="button"
            onClick={() => setSelected(null)}
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Close picture"
          >
            <X aria-hidden="true" />
          </button>
          <img
            src={mediaUrl(selected.storagePath)}
            alt={selected.description || 'Picture'}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : null}
    </>
  )
}
