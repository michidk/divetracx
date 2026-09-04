import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { TaxonomyManager } from '@/components/taxonomy-manager'
import {
  addDiveType,
  type getDiveTypes,
  removeDiveType,
  updateDiveType,
} from '@/modules/dives/server/dive-types'

type DiveType = Awaited<ReturnType<typeof getDiveTypes>>[number]

export function DiveTypesPage({ diveTypes }: { diveTypes: DiveType[] }) {
  return (
    <div className="space-y-8">
      <header>
        <Link
          to="/settings"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to settings
        </Link>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Settings
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Dive types</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Keep imported and custom dive classifications in one list. Renaming a type
          updates it everywhere it is used.
        </p>
      </header>

      <TaxonomyManager
        singular="Dive type"
        plural="Dive types"
        placeholder="e.g. Reef survey"
        emptyMessage="No dive types yet. Add one above or import them from DiveMate."
        items={diveTypes}
        onAdd={(name) => addDiveType({ data: { name } })}
        onRename={(id, name) => updateDiveType({ data: { id, name } })}
        onRemove={(id) => removeDiveType({ data: { id } })}
      />
    </div>
  )
}
