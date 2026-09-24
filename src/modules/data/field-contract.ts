import type { ReactNode } from 'react'
import { z } from 'zod'

/**
 * One typed writable contract per generic entity: canonical field keys,
 * coercion/validation, and explicit MCP exposure, with UI labels/sections/
 * widgets layered on as presentation metadata. The web editor and MCP both
 * validate through the same `schema` per field, so a field either exists in
 * one place or it does not exist at all — it cannot silently drift between
 * the form, persistence, and the MCP surface the way three independent
 * declarations could.
 */

export type EditorValue = string | boolean
export type EditorValues = Record<string, EditorValue>

export interface FieldOption {
  value: string
  label: string
  leading?: ReactNode
}

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'date'
  | 'date-picker'
  | 'number'
  | 'checkbox'
  | 'rating'
  | 'select'

export interface FieldPresentation {
  label: string
  kind: FieldKind
  section: string
  /** Also enforced server-side: a field a new record cannot be created without. */
  required?: boolean
  defaultValue?: boolean
  min?: number
  max?: number
  step?: string
  help?: string
  options?: FieldOption[]
}

export interface FieldContract<TValue> {
  presentation: FieldPresentation
  /** Whether this field is writable through the MCP tool schema for its entity. */
  mcpExposed: boolean
  /** Validates the domain-typed value (number/boolean/string), as MCP supplies it directly. */
  schema: z.ZodType<TValue>
}

export type EntityContract<T extends Record<string, unknown>> = {
  [K in keyof T]: FieldContract<T[K]>
}

/**
 * The shape a save command accepts: any subset of the entity's fields, each
 * as whatever raw value the caller has — an HTML form string/boolean, or an
 * already domain-typed MCP value (including the pre-transform type for a
 * field like a decimal, e.g. a number where the persisted type is a
 * string). `validateEntityInput` coerces and validates every value before
 * it reaches persistence, so this type is intentionally loose.
 */
export type EntityWrite<T extends Record<string, unknown>> = Partial<
  Record<keyof T, unknown>
>

export type PresentationEntry = FieldPresentation & { key: string }

export function presentationList<T extends Record<string, unknown>>(
  contract: EntityContract<T>,
): PresentationEntry[] {
  return Object.entries(contract).map(([key, field]) => ({
    key,
    ...(field as FieldContract<unknown>).presentation,
  }))
}

/** Converts a raw HTML-form value into the JS primitive its schema validates. */
function coerceForKind(kind: FieldKind, raw: unknown): unknown {
  if (kind === 'checkbox') return raw === true
  if (typeof raw !== 'string') return raw
  if (raw.trim() === '') return null
  if (kind === 'number' || kind === 'rating') {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : raw
  }
  return raw.trim()
}

/** Converts a domain-typed value back into the string/boolean an HTML control edits. */
export function toEditorValue(kind: FieldKind, value: unknown): EditorValue {
  if (kind === 'checkbox') return value === true
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

/**
 * Seeds a form's editor values from a record, using only presentation
 * metadata — the client renders forms from `presentationList(contract)`
 * without needing the contract's validation schemas at all.
 */
export function initialValuesFromPresentation(
  presentation: readonly PresentationEntry[],
  record: Record<string, unknown> | null,
): Record<string, EditorValue> {
  return Object.fromEntries(
    presentation.map((field) => {
      if (field.kind === 'checkbox') {
        return [
          field.key,
          record ? record[field.key] === true : (field.defaultValue ?? false),
        ]
      }
      const value = record?.[field.key]
      if (value === null || value === undefined) return [field.key, '']
      // Selects encode numeric source codes; 0 means "not set" in imported data.
      if (field.kind === 'select' && value === 0) return [field.key, '']
      return [field.key, toEditorValue(field.kind, value)]
    }),
  )
}

export class EntityValidationError extends Error {}

/**
 * Validates a partial update against an entity's field contract. A key
 * absent from `input` is left untouched on update, and rejected on create
 * when its field is marked required. Every value is coerced by field kind
 * before validation; this is a no-op for a value that is already the right
 * JS primitive (as MCP input is), so the same path serves a raw HTML form
 * submission (string/boolean) and an already domain-typed MCP call.
 */
export function validateEntityInput<T extends Record<string, unknown>>(
  contract: EntityContract<T>,
  input: Partial<Record<keyof T, unknown>>,
  options: { mode: 'create' | 'update' },
): Partial<T> {
  const result: Partial<T> = {}
  for (const key of Object.keys(contract) as (keyof T & string)[]) {
    const field = contract[key] as FieldContract<unknown>
    if (!Object.hasOwn(input, key)) {
      if (options.mode === 'create' && field.presentation.required) {
        throw new EntityValidationError(`${field.presentation.label} is required`)
      }
      continue
    }
    const value = coerceForKind(field.presentation.kind, input[key])
    const parsed = field.schema.safeParse(value)
    if (!parsed.success) {
      throw new EntityValidationError(
        parsed.error.issues[0]?.message ?? `${field.presentation.label} is invalid`,
      )
    }
    result[key as keyof T] = parsed.data as T[keyof T]
  }
  return result
}

/**
 * Derives an MCP tool's partial writable-values schema straight from the
 * contract. The precise return type assumes every field is `mcpExposed`,
 * which holds for every contract this is currently called with; a field
 * marked `mcpExposed: false` is still correctly dropped from the schema at
 * runtime; it would just be a static, not a runtime, lie if one existed here.
 */
export function mcpValuesSchema<T extends Record<string, unknown>>(
  contract: EntityContract<T>,
): z.ZodObject<{ [K in keyof T]: z.ZodOptional<z.ZodType<T[K]>> }> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [key, field] of Object.entries(contract)) {
    const typed = field as FieldContract<unknown>
    if (typed.mcpExposed) shape[key] = typed.schema.optional()
  }
  return z.object(shape) as z.ZodObject<{
    [K in keyof T]: z.ZodOptional<z.ZodType<T[K]>>
  }>
}

// --- Common field-schema builders, matching the messages the manual
// editors previously wrote by hand, so validation errors read the same. ---

export function requiredTextSchema(label: string, maxLength = 200) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength, `${label} is too long`)
}

export function nullableTextSchema(label: string, maxLength = 10_000) {
  return z.string().trim().max(maxLength, `${label} is too long`).nullable()
}

export function nullableNumberSchema(
  label: string,
  limits: { min?: number; max?: number } = {},
) {
  let schema = z.number(`${label} must be a number`)
  if (limits.min !== undefined)
    schema = schema.min(limits.min, `${label} must be at least ${limits.min}`)
  if (limits.max !== undefined)
    schema = schema.max(limits.max, `${label} must be at most ${limits.max}`)
  return schema.nullable()
}

/**
 * For a Postgres `numeric` column, which drizzle reads and writes as a
 * string to avoid floating-point rounding. MCP and the form both work with
 * a plain number; the schema validates that number and then transforms it
 * into the string the column actually stores.
 */
export function nullableDecimalSchema(
  label: string,
  limits: { min?: number; max?: number } = {},
) {
  return nullableNumberSchema(label, limits).transform((value) =>
    value === null ? null : String(value),
  )
}

export function nullableIntegerSchema(
  label: string,
  limits: { min?: number; max?: number } = {},
) {
  return nullableNumberSchema(label, limits).refine(
    (value) => value === null || Number.isInteger(value),
    `${label} must be a whole number`,
  )
}

export function nullableDateSchema(label: string) {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a valid date`)
    .nullable()
}

export function nullableUuidSchema(label: string) {
  return z.string().uuid(`${label} must reference an existing record`).nullable()
}

export function requiredUuidSchema(label: string) {
  return z.string().uuid(`${label} must reference an existing record`)
}

export function booleanSchema() {
  return z.boolean()
}
