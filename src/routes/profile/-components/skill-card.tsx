import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SkillCard({ imageVersion }: { imageVersion: string }) {
  const previewUrl = `/profile-card.png?v=${encodeURIComponent(imageVersion)}`

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
      <img
        src={previewUrl}
        alt="Divetracx diver skill card preview"
        className="block aspect-[1200/630] w-full"
      />
    </section>
  )
}
