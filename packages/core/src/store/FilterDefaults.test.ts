import { describe, expect, it } from 'vitest'
import { today } from '../dates'
import {
  DEFAULT_PRIORITIES,
  DEFAULT_STATUSES,
  makeDefaultFilter,
  type CustomFieldDef,
  type FilterCondition,
  type FilterState
} from '../types'
import { filterDefaults, filterProjectId, mergeTaskDefaults, type DefaultsTarget } from './FilterDefaults'

const FIELDS: CustomFieldDef[] = [
  { id: 'client', name: 'Client', type: 'select', options: ['Acme', 'Globex'] },
  { id: 'estimate', name: 'Estimate', type: 'number' },
  { id: 'reviewed', name: 'Reviewed', type: 'checkbox' },
  { id: 'sprint', name: 'Sprint', type: 'text' },
  { id: 'labels', name: 'Labels', type: 'multiselect', options: ['a', 'b'] },
  { id: 'launch', name: 'Launch', type: 'date' },
  { id: 'owner', name: 'Owner', type: 'person' }
]

const target: DefaultsTarget = { statuses: DEFAULT_STATUSES, priorities: DEFAULT_PRIORITIES, customFields: FIELDS }

function filter(...conditions: FilterCondition[]): FilterState {
  return { ...makeDefaultFilter(), conditions }
}

const defaults = (condition: FilterCondition, to: DefaultsTarget = target) => filterDefaults(filter(condition), to)

describe('filterDefaults', () => {
  it('takes the value a list field is pinned to', () => {
    const status = DEFAULT_STATUSES[1].id
    const priority = DEFAULT_PRIORITIES[0].id
    expect(defaults({ field: 'status', op: 'any', value: [status] })).toEqual({ status })
    expect(defaults({ field: 'priority', op: 'any', value: [priority] })).toEqual({ priority })
    expect(defaults({ field: 'type', op: 'any', value: ['milestone'] })).toEqual({ type: 'milestone' })
  })

  it('leaves a field alone when several values stay open', () => {
    const [a, b] = DEFAULT_STATUSES
    expect(defaults({ field: 'status', op: 'any', value: [a.id, b.id] })).toEqual({})
    expect(defaults({ field: 'assignee', op: 'any', value: ['Ann', 'Bo'] })).toEqual({})
  })

  it('leaves a field alone for an exclusion, an emptiness test or a missing value', () => {
    const id = DEFAULT_STATUSES[0].id
    expect(defaults({ field: 'status', op: 'none', value: [id] })).toEqual({})
    expect(defaults({ field: 'status', op: 'empty' })).toEqual({})
    expect(defaults({ field: 'status', op: 'not-empty' })).toEqual({})
    expect(defaults({ field: 'status', op: 'any', value: [] })).toEqual({})
    expect(defaults({ field: 'status', op: 'any' })).toEqual({})
  })

  it('wraps a multi field value in a list', () => {
    expect(defaults({ field: 'assignee', op: 'any', value: ['Ann'] })).toEqual({ assignees: ['Ann'] })
    expect(defaults({ field: 'tag', op: 'all', value: ['bug'] })).toEqual({ tags: ['bug'] })
    expect(defaults({ field: 'tag', op: 'none', value: ['bug'] })).toEqual({})
  })

  it('takes a date pinned to today or to one day', () => {
    expect(defaults({ field: 'due', op: 'bucket', value: 'today' })).toEqual({ due: today().toString() })
    expect(defaults({ field: 'start', op: 'between', value: ['2026-03-01', '2026-03-01'] })).toEqual({
      start: '2026-03-01'
    })
    expect(defaults({ field: 'due', op: 'bucket', value: 'overdue' })).toEqual({})
    expect(defaults({ field: 'due', op: 'between', value: ['2026-03-01', '2026-03-09'] })).toEqual({})
    expect(defaults({ field: 'due', op: 'between', value: ['2026-03-01', ''] })).toEqual({})
  })

  it('takes the text a title must contain', () => {
    expect(defaults({ field: 'title', op: 'contains', value: ' crash ' })).toEqual({ title: 'crash' })
    expect(defaults({ field: 'title', op: 'not-contains', value: 'crash' })).toEqual({})
  })

  it('ignores a status or priority the project does not define', () => {
    expect(defaults({ field: 'status', op: 'any', value: ['nope'] })).toEqual({})
    expect(defaults({ field: 'priority', op: 'any', value: ['nope'] })).toEqual({})
  })

  it('leaves the type of a subtask alone', () => {
    const pinned = filter({ field: 'type', op: 'any', value: ['milestone'] })
    expect(filterDefaults(pinned, target, { subtask: true })).toEqual({})
  })

  describe('custom fields', () => {
    const custom = (condition: FilterCondition) => defaults(condition).customFields

    it('takes a select option and a multiselect option as a list', () => {
      expect(custom({ field: 'cf:client', op: 'any', value: ['Acme'] })).toEqual({ client: 'Acme' })
      expect(custom({ field: 'cf:labels', op: 'any', value: ['a'] })).toEqual({ labels: ['a'] })
      expect(custom({ field: 'cf:labels', op: 'all', value: ['a'] })).toEqual({ labels: ['a'] })
    })

    it('takes a person as a single value', () => {
      expect(custom({ field: 'cf:owner', op: 'any', value: ['Ann'] })).toEqual({ owner: 'Ann' })
    })

    it('takes text, numbers, dates and checked boxes', () => {
      expect(custom({ field: 'cf:sprint', op: 'contains', value: 'S4' })).toEqual({ sprint: 'S4' })
      expect(custom({ field: 'cf:estimate', op: 'eq', value: [5] })).toEqual({ estimate: 5 })
      expect(custom({ field: 'cf:estimate', op: 'between', value: [3, 3] })).toEqual({ estimate: 3 })
      expect(custom({ field: 'cf:launch', op: 'bucket', value: 'today' })).toEqual({
        launch: today().toString()
      })
      expect(custom({ field: 'cf:reviewed', op: 'checked' })).toEqual({ reviewed: true })
    })

    it('leaves a field alone when the condition is not decisive', () => {
      expect(custom({ field: 'cf:client', op: 'any', value: ['Acme', 'Globex'] })).toBeUndefined()
      expect(custom({ field: 'cf:client', op: 'none', value: ['Acme'] })).toBeUndefined()
      expect(custom({ field: 'cf:sprint', op: 'not-contains', value: 'S4' })).toBeUndefined()
      expect(custom({ field: 'cf:sprint', op: 'empty' })).toBeUndefined()
      expect(custom({ field: 'cf:estimate', op: 'ne', value: [5] })).toBeUndefined()
      expect(custom({ field: 'cf:estimate', op: 'gte', value: [5] })).toBeUndefined()
      expect(custom({ field: 'cf:estimate', op: 'between', value: [3, 8] })).toBeUndefined()
      expect(custom({ field: 'cf:reviewed', op: 'unchecked' })).toBeUndefined()
    })

    it('ignores a property the project lacks or an option it does not offer', () => {
      expect(custom({ field: 'cf:gone', op: 'any', value: ['x'] })).toBeUndefined()
      expect(custom({ field: 'cf:client', op: 'any', value: ['Initech'] })).toBeUndefined()
      expect(custom({ field: 'cf:client', op: 'any', value: ['Acme'] })).toBeDefined()
      expect(defaults({ field: 'cf:client', op: 'any', value: ['Acme'] }, { ...target, customFields: [] })).toEqual({})
    })
  })

  it('combines every pinned field and keeps the first condition of a repeated one', () => {
    const status = DEFAULT_STATUSES[0].id
    const result = filterDefaults(
      filter(
        { field: 'status', op: 'any', value: [status] },
        { field: 'assignee', op: 'any', value: ['Ann'] },
        { field: 'cf:client', op: 'any', value: ['Acme'] },
        { field: 'cf:sprint', op: 'contains', value: 'S4' },
        { field: 'status', op: 'any', value: [DEFAULT_STATUSES[1].id] }
      ),
      target
    )
    expect(result).toEqual({
      status,
      assignees: ['Ann'],
      customFields: { client: 'Acme', sprint: 'S4' }
    })
  })

  it('gives nothing for an empty filter', () => {
    expect(filterDefaults(makeDefaultFilter(), target)).toEqual({})
  })
})

describe('filterProjectId', () => {
  it('names the project only when the filter pins exactly one', () => {
    expect(filterProjectId(filter({ field: 'project', op: 'any', value: ['p1'] }))).toBe('p1')
    expect(filterProjectId(filter({ field: 'project', op: 'any', value: ['p1', 'p2'] }))).toBeUndefined()
    expect(filterProjectId(filter({ field: 'project', op: 'none', value: ['p1'] }))).toBeUndefined()
    expect(filterProjectId(makeDefaultFilter())).toBeUndefined()
  })

  it('is not a value of the task itself', () => {
    expect(defaults({ field: 'project', op: 'any', value: ['p1'] })).toEqual({})
  })
})

describe('mergeTaskDefaults', () => {
  it('lets the upper layer win and merges custom field values', () => {
    expect(
      mergeTaskDefaults(
        { status: 'a', customFields: { x: 1, y: 2 } },
        { status: 'b', customFields: { y: 3 }, tags: ['t'] }
      )
    ).toEqual({ status: 'b', tags: ['t'], customFields: { x: 1, y: 3 } })
  })

  it('returns the base when there is nothing above it', () => {
    expect(mergeTaskDefaults({ status: 'a' }, null)).toEqual({ status: 'a' })
  })
})
