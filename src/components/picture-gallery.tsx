import { useState } from 'react'
import { ImageLightbox } from '@/components/image-lightbox'

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
        <ImageLightbox
          src={mediaUrl(selected.storagePath)}
          alt={selected.description || 'Picture'}
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null)
          }}
        />
      ) : null}
    </>
  )
}
