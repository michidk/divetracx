import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { SaveButton, useTransientSavedState } from '@/components/save-button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  dependentEntities,
  normalizeDisabledEntities,
} from '@/modules/integrations/entity-selection'
import { updateIntegrationEntities } from '@/modules/integrations/server/operations'
import type { IntegrationEntity } from '@/modules/integrations/types'

type IntegrationKey = 'divemate' | 'garmin' | 'subsurface'

function listNames(entities: IntegrationEntity[]) {
  const names = entities.map((entity) => entity.label)
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/**
 * Per-entity switches for one integration. A switched-off entity is left out
 * of every later import; anything that depends on it is shown as switched off
 * too and cannot be turned back on until its dependency is.
 */
export function EntitySelection({
  integrationKey,
  displayName,
  entities,
  disabledEntities,
  disabled,
}: {
  integrationKey: IntegrationKey
  displayName: string
  entities: readonly IntegrationEntity[]
  disabledEntities: string[]
  disabled: boolean
}) {
  const router = useRouter()
  const [chosen, setChosen] = useState(() => new Set(disabledEntities))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { saved, clearSaved, markSaved } = useTransientSavedState()

  const effective = new Set(normalizeDisabledEntities(entities, chosen))
  const enabledCount = entities.length - effective.size
  const dirty =
    chosen.size !== disabledEntities.length ||
    disabledEntities.some((key) => !chosen.has(key))

  function toggle(entity: IntegrationEntity, checked: boolean) {
    clearSaved()
    setMessage(null)
    setChosen((current) => {
      const next = new Set(current)
      if (checked) next.delete(entity.key)
      else next.add(entity.key)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    clearSaved()
    try {
      await updateIntegrationEntities({
        data: { integrationKey, disabledEntities: [...chosen] },
      })
      await router.invalidate()
      markSaved()
      setMessage(
        effective.size === 0
          ? `Every ${displayName} entity syncs.`
          : `The next ${displayName} import leaves out ${listNames(
              entities.filter((entity) => effective.has(entity.key)),
            )}.`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Saving the selection failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">What to sync</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {enabledCount}/{entities.length}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Switched-off data is left out of future imports. Records already imported stay in
        your logbook.
      </p>
      <div className="mt-2 divide-y divide-border">
        {entities.map((entity) => {
          const id = `${integrationKey}-entity-${entity.key}`
          const inherited =
            !chosen.has(entity.key) && !entity.required && effective.has(entity.key)
          const dependants = dependentEntities(entities, entity.key)
          const locked = disabled || Boolean(entity.required) || inherited
          const blockedBy = inherited
            ? entities.filter(
                (candidate) =>
                  chosen.has(candidate.key) && entity.dependsOn?.includes(candidate.key),
              )
            : []
          return (
            <label
              key={entity.key}
              htmlFor={id}
              className={cn(
                'flex min-h-14 items-start justify-between gap-3 py-3',
                locked && !entity.required && 'text-muted-foreground',
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{entity.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {entity.description}
                </span>
                {entity.required ? (
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    Always synced — everything else in this source is read from it.
                  </span>
                ) : inherited ? (
                  <span className="mt-0.5 block text-xs leading-5 text-warning-foreground">
                    Off because {listNames(blockedBy)}{' '}
                    {blockedBy.length === 1 ? 'is' : 'are'} off.
                  </span>
                ) : dependants.length > 0 && !effective.has(entity.key) ? (
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    Switching this off also switches off {listNames(dependants)}.
                  </span>
                ) : null}
              </span>
              <Switch
                id={id}
                className="mt-0.5"
                checked={!effective.has(entity.key)}
                disabled={locked}
                onCheckedChange={(checked) => toggle(entity, checked)}
              />
            </label>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SaveButton
          type="button"
          size="sm"
          variant="outline"
          saving={saving}
          saved={saved}
          disabled={disabled || !dirty}
          onClick={() => void save()}
        >
          Save selection
        </SaveButton>
        {message ? (
          <p
            aria-live="polite"
            className={cn(
              'text-xs',
              message.includes('failed') ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  )
}
