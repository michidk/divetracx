import type { IntegrationEntity } from './types'

/**
 * Turns a stored or requested list of switched-off entities into the set an
 * import actually skips: unknown keys are dropped, required entities stay on,
 * and anything that depends on a switched-off entity is switched off with it.
 */
export function normalizeDisabledEntities(
  entities: readonly IntegrationEntity[],
  disabled: Iterable<string>,
): string[] {
  const known = new Map(entities.map((entity) => [entity.key, entity]))
  const result = new Set<string>()
  for (const key of disabled) {
    const entity = known.get(key)
    if (entity && !entity.required) result.add(key)
  }
  let changed = true
  while (changed) {
    changed = false
    for (const entity of entities) {
      if (result.has(entity.key) || entity.required) continue
      if (entity.dependsOn?.some((dependency) => result.has(dependency))) {
        result.add(entity.key)
        changed = true
      }
    }
  }
  return entities.map((entity) => entity.key).filter((key) => result.has(key))
}

/**
 * The owner's explicit choice, cleaned but not widened: unknown and required
 * keys are dropped so the stored list only ever names switchable entities.
 */
export function selectableDisabledEntities(
  entities: readonly IntegrationEntity[],
  disabled: Iterable<string>,
): string[] {
  const requested = new Set(disabled)
  return entities
    .filter((entity) => !entity.required && requested.has(entity.key))
    .map((entity) => entity.key)
}

/** Entities that would be switched off because they depend on `key`. */
export function dependentEntities(
  entities: readonly IntegrationEntity[],
  key: string,
): IntegrationEntity[] {
  const disabled = new Set(normalizeDisabledEntities(entities, [key]))
  disabled.delete(key)
  return entities.filter((entity) => disabled.has(entity.key))
}

export function disabledRecordTypes(
  entities: readonly IntegrationEntity[],
  disabled: Iterable<string>,
): Set<string> {
  const disabledKeys = new Set(normalizeDisabledEntities(entities, disabled))
  return new Set(
    entities
      .filter((entity) => disabledKeys.has(entity.key))
      .flatMap((entity) => entity.recordTypes ?? []),
  )
}
