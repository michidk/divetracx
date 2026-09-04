import { Download } from 'lucide-react'
import { useState } from 'react'
import { ImageLightbox } from '@/components/image-lightbox'
import { Button } from '@/components/ui/button'

export function SkillCard({ imageVersion }: { imageVersion: string }) {
  const previewUrl = `/profile-card.png?v=${encodeURIComponent(imageVersion)}`
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <section aria-labelledby="skill-card-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="skill-card-heading"
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Your Divetracx card
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A shareable snapshot generated from your current logbook and credentials.
          </p>
        </div>
        <Button
          render={<a href="/profile-card.png?download=1" download />}
          nativeButton={false}
          variant="outline"
          size="sm"
        >
          <Download size={15} aria-hidden="true" /> Download PNG
        </Button>
      </div>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="block w-full overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label="Open Divetracx diver skill card"
      >
        <img
          src={previewUrl}
          alt="Divetracx diver skill card preview"
          className="block aspect-[1200/630] w-full transition-transform hover:scale-[1.02]"
        />
      </button>
      <ImageLightbox
        src={previewUrl}
        alt="Divetracx diver skill card"
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </section>
  )
}
