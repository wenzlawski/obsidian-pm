import { describe, expect, it } from 'vitest'
import { makeTask } from '@dotpm/core'
import { tagChoices } from './tagChoices'

const label = (tasks: ReturnType<typeof makeTask>[], known: string[]) =>
  tagChoices(tasks, known).map((choice) => choice.label)

describe('tagChoices', () => {
  it('offers to add a tag a task lacks and to remove one it holds', () => {
    const tasks = [makeTask({ tags: ['art'] })]
    expect(label(tasks, ['art', 'ui'])).toEqual(['Remove #art', 'Add #ui', '+ new tag...', 'Clear tags'])
  })

  it('offers both for a tag only some tasks hold, saying how many', () => {
    const tasks = [makeTask({ tags: ['art'] }), makeTask({ tags: [] }), makeTask({ tags: ['art'] })]
    const choices = tagChoices(tasks, ['art'])
    expect(choices.slice(0, 2).map((c) => c.label)).toEqual(['Add #art', 'Remove #art'])
    expect(choices.slice(0, 2).map((c) => c.detail)).toEqual(['On 2 of 3 tasks', 'On 2 of 3 tasks'])
  })

  it('only offers to remove a tag every task holds, with no count', () => {
    const tasks = [makeTask({ tags: ['art'] }), makeTask({ tags: ['art'] })]
    const [only] = tagChoices(tasks, ['art'])
    expect(only).toMatchObject({ label: 'Remove #art', value: { op: 'remove', tag: 'art' } })
    expect(only.detail).toBeUndefined()
  })

  it('carries the operation and the tag, matching a spelling the tasks use', () => {
    const tasks = [makeTask({ tags: ['Art'] })]
    expect(tagChoices(tasks, ['art'])[0].value).toEqual({ op: 'remove', tag: 'art' })
  })

  it('has nothing to clear when no task holds a tag', () => {
    expect(label([makeTask({ tags: [] })], ['art'])).toEqual(['Add #art', '+ new tag...'])
  })

  it('always offers a new tag, even with no tags at all', () => {
    expect(tagChoices([makeTask()], []).map((c) => c.value)).toEqual([{ op: 'new' }])
  })

  it('includes tags the tasks hold that are not otherwise known', () => {
    expect(label([makeTask({ tags: ['odd'] })], [])).toContain('Remove #odd')
  })
})
