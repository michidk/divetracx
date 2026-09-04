import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { TaxonomyManager } from '@/components/taxonomy-manager'
import {
  addOperationTaxonomy,
  type getOperatorsAndBoats,
  removeOperationTaxonomy,
  updateOperationTaxonomy,
} from '@/modules/dives/server/operators-boats'

type OperatorsAndBoats = Awaited<ReturnType<typeof getOperatorsAndBoats>>

export function OperatorsBoatsPage({ data }: { data: OperatorsAndBoats }) {
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
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Dive operators & boats
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Manage the operators and boats available in the dive editor. Renaming an entry
          updates every dive that uses it.
        </p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <TaxonomyManager
          singular="Dive operator"
          plural="Dive operators"
          placeholder="e.g. Blue Current Diving"
          emptyMessage="No dive operators yet. Add one above or import one from DiveMate."
          items={data.operators}
          onAdd={(name) => addOperationTaxonomy({ data: { taxonomy: 'operator', name } })}
          onRename={(id, name) =>
            updateOperationTaxonomy({ data: { taxonomy: 'operator', id, name } })
          }
          onRemove={(id) =>
            removeOperationTaxonomy({ data: { taxonomy: 'operator', id } })
          }
        />
        <TaxonomyManager
          singular="Boat"
          plural="Boats"
          placeholder="e.g. Sea Star"
          emptyMessage="No boats yet. Add one above or import one from DiveMate."
          items={data.boats}
          onAdd={(name) => addOperationTaxonomy({ data: { taxonomy: 'boat', name } })}
          onRename={(id, name) =>
            updateOperationTaxonomy({ data: { taxonomy: 'boat', id, name } })
          }
          onRemove={(id) => removeOperationTaxonomy({ data: { taxonomy: 'boat', id } })}
        />
      </div>
    </div>
  )
}
