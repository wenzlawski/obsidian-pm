import { describe, expect, it } from 'vitest'
import type PMPlugin from '#main'
import type { ProjectScope } from '#store'
import {
  DEFAULT_PRIORITIES,
  DEFAULT_STATUSES,
  makeDefaultFilter,
  type FilterState,
  type Project,
  type Task
} from '@dotpm/core'
import { newTaskDefaults, projectNamedByFilter } from './newTaskDefaults'

function pluginWith(prefillFromFilter: boolean): PMPlugin {
  return {
    settings: { prefillFromFilter },
    store: { configFor: () => ({ statuses: DEFAULT_STATUSES, priorities: DEFAULT_PRIORITIES, customFields: [] }) }
  } as unknown as PMPlugin
}

const project = { id: 'p1' } as Project
const scope = { projects: [project, { id: 'p2' } as Project] } as ProjectScope
const status = DEFAULT_STATUSES[1].id

function filter(...conditions: FilterState['conditions']): FilterState {
  return { ...makeDefaultFilter(), conditions }
}

describe('newTaskDefaults', () => {
  const pinned = filter({ field: 'status', op: 'any', value: [status] })

  it('prefills from the filter while the setting is on', () => {
    expect(newTaskDefaults(pluginWith(true), project, { filter: pinned })).toEqual({ status })
  })

  it('ignores the filter while the setting is off', () => {
    expect(newTaskDefaults(pluginWith(false), project, { filter: pinned })).toBeUndefined()
  })

  it('keeps explicit defaults whatever the setting says', () => {
    const defaults: Partial<Task> = { type: 'milestone' }
    expect(newTaskDefaults(pluginWith(false), project, { filter: pinned, defaults })).toEqual(defaults)
    expect(newTaskDefaults(pluginWith(true), project, { filter: pinned, defaults })).toEqual({
      status,
      type: 'milestone'
    })
  })
})

describe('projectNamedByFilter', () => {
  const named = filter({ field: 'project', op: 'any', value: ['p2'] })

  it('picks the project the filter names while the setting is on', () => {
    expect(projectNamedByFilter(pluginWith(true), scope, named)?.id).toBe('p2')
  })

  it('does not pick one while the setting is off', () => {
    expect(projectNamedByFilter(pluginWith(false), scope, named)).toBeUndefined()
  })
})
