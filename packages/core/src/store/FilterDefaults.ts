import { parsePlainDate, today } from '../dates'
import type { CustomFieldDef, FilterCondition, FilterState, PriorityConfig, StatusConfig, Task } from '../types'
import { filterKind, customFieldOf, type FilterKind } from './FilterFields'

/** What a new task's values have to be valid against: the project it is created in. */
export interface DefaultsTarget {
  statuses: StatusConfig[]
  priorities: PriorityConfig[]
  customFields: CustomFieldDef[]
}

const TASK_TYPES = ['task', 'milestone', 'subtask']

/**
 * The one value a condition pins its field to, or undefined when it leaves several open:
 * more than one value, an exclusion, an emptiness test, or a range.
 */
function decidedValue(condition: FilterCondition, kind: FilterKind): string | number | boolean | undefined {
  const { op, value } = condition
  switch (kind) {
    case 'list':
    case 'multi': {
      if (op !== 'any' && op !== 'all') return undefined
      return Array.isArray(value) && value.length === 1 && value[0] ? String(value[0]) : undefined
    }
    case 'text':
      if (op !== 'contains') return undefined
      return typeof value === 'string' && value.trim() ? value.trim() : undefined
    case 'number': {
      if (!Array.isArray(value)) return undefined
      const [a, b] = value
      if (op === 'eq') return typeof a === 'number' ? a : undefined
      if (op === 'between') return typeof a === 'number' && a === b ? a : undefined
      return undefined
    }
    case 'date': {
      if (op === 'bucket') return value === 'today' ? today().toString() : undefined
      if (op !== 'between' || !Array.isArray(value)) return undefined
      const [from, to] = value
      return typeof from === 'string' && from === to && parsePlainDate(from) ? from : undefined
    }
    case 'checkbox':
      return op === 'checked' ? true : undefined
  }
}

/** The project a filter confines the view to, when it names exactly one. */
export function filterProjectId(filter: FilterState): string | undefined {
  for (const condition of filter.conditions) {
    if (condition.field !== 'project') continue
    const id = decidedValue(condition, 'list')
    if (typeof id === 'string') return id
  }
  return undefined
}

function customDefault(def: CustomFieldDef, value: string | number | boolean): unknown {
  switch (def.type) {
    case 'select':
      return typeof value === 'string' && (!def.options || def.options.includes(value)) ? value : undefined
    case 'multiselect':
      return typeof value === 'string' && (!def.options || def.options.includes(value)) ? [value] : undefined
    case 'person':
    case 'text':
    case 'url':
    case 'date':
      return typeof value === 'string' ? value : undefined
    case 'number':
      return typeof value === 'number' ? value : undefined
    case 'checkbox':
      return value === true ? true : undefined
  }
}

/**
 * Values for a new task taken from the filter it is created under, so that it shows up in
 * that view. Only a condition that pins its field to one value counts: a single value of
 * `any`, `all` or `eq`, a text it must contain, a date of `today` or a one-day range, a
 * checked box. Several values, exclusions and ranges leave the field alone, as does a value
 * the target project has no use for, such as a status it does not define.
 *
 * A subtask keeps its own type, so `type` is left out when `subtask` is set.
 */
export function filterDefaults(
  filter: FilterState,
  target: DefaultsTarget,
  { subtask = false }: { subtask?: boolean } = {}
): Partial<Task> {
  const defaults: Partial<Task> = {}
  const customFields: Record<string, unknown> = {}
  const seen = new Set<string>()

  for (const condition of filter.conditions) {
    const { field } = condition
    if (seen.has(field)) continue
    const kind = filterKind(field, target.customFields)
    if (!kind) continue
    const value = decidedValue(condition, kind)
    if (value === undefined) continue
    seen.add(field)

    const custom = customFieldOf(field, target.customFields)
    if (custom) {
      const next = customDefault(custom, value)
      if (next !== undefined) customFields[custom.id] = next
      continue
    }
    const text = String(value)
    switch (field) {
      case 'status':
        if (target.statuses.some((s) => s.id === text)) defaults.status = text
        break
      case 'priority':
        if (target.priorities.some((p) => p.id === text)) defaults.priority = text
        break
      case 'type':
        if (!subtask && TASK_TYPES.includes(text)) defaults.type = text as Task['type']
        break
      case 'assignee':
        defaults.assignees = [text]
        break
      case 'tag':
        defaults.tags = [text]
        break
      case 'due':
        defaults.due = text
        break
      case 'start':
        defaults.start = text
        break
      case 'title':
        defaults.title = text
        break
    }
  }
  if (Object.keys(customFields).length) defaults.customFields = customFields
  return defaults
}

/** Layers `over` on `base`, merging custom field values rather than replacing them. */
export function mergeTaskDefaults(base: Partial<Task>, over: Partial<Task> | undefined | null): Partial<Task> {
  if (!over) return base
  const merged = { ...base, ...over }
  if (base.customFields || over.customFields) merged.customFields = { ...base.customFields, ...over.customFields }
  return merged
}
