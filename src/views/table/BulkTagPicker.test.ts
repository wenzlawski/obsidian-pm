// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTask, type TagChange, type Task } from '@dotpm/core'
import { openBulkTagPicker } from './BulkTagPicker'

const TASKS: Task[] = [
  makeTask({ id: 'a', tags: ['art', 'wip'] }),
  makeTask({ id: 'b', tags: ['art'] }),
  makeTask({ id: 'c', tags: ['art', 'ui'] }),
  makeTask({ id: 'd', tags: ['idle'] })
]

function makeCtx(selected: string[]) {
  return {
    state: { selectedTaskIds: new Set(selected) },
    scope: {
      taskById: (id: string) => TASKS.find((task) => task.id === id) ?? null,
      tasks: () => TASKS
    }
  } as never
}

const rows = (): HTMLElement[] => Array.from(document.body.querySelectorAll<HTMLElement>('.pm-pop-item'))
const labels = (): (string | null)[] => rows().map((r) => r.querySelector('.pm-pop-item-label')?.textContent ?? null)
const row = (label: string): HTMLElement => {
  const found = rows().find((r) => r.querySelector('.pm-pop-item-label')?.textContent === label)
  if (!found) throw new Error(`no row "${label}" in ${JSON.stringify(labels())}`)
  return found
}
const holding = (label: string): 'all' | 'some' | 'none' => {
  const el = row(label)
  if (el.hasClass('pm-pop-item--mixed')) return 'some'
  return el.querySelector('.pm-pop-check--hidden') ? 'none' : 'all'
}
const escape = (): void => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}
const type = (text: string): void => {
  const input = document.body.querySelector<HTMLInputElement>('.pm-pop-field')
  if (!input) throw new Error('no search field')
  input.value = text
  input.dispatchEvent(new Event('input'))
}

function open(selected: string[]) {
  const apply = vi.fn<(change: TagChange) => void>()
  openBulkTagPicker(makeCtx(selected), document.body.createEl('button'), apply)
  return apply
}

afterEach(() => {
  for (let i = 0; i < 5 && document.querySelector('.pm-pop'); i++) escape()
  document.body.empty()
})

describe('bulk tag picker', () => {
  it('lists every tag, ticking those all selected tasks hold and marking those only some hold', () => {
    open(['a', 'b', 'c'])
    expect(labels()).toEqual(['art', 'idle', 'ui', 'wip', 'Clear tags'])
    expect(holding('art')).toBe('all')
    expect(holding('wip')).toBe('some')
    expect(holding('ui')).toBe('some')
    expect(holding('idle')).toBe('none')
    expect(row('wip').querySelector('.pm-pop-item-note')?.textContent).toBe('1/3')
  })

  it('takes one tag off every selected task without touching the rest', () => {
    const apply = open(['a', 'b', 'c'])
    row('art').click()
    escape()
    expect(apply).toHaveBeenCalledExactlyOnceWith({ add: [], remove: ['art'] })
  })

  it('puts a tag only some hold on all of them with one pick, and takes it off all with a second', () => {
    const adds = open(['a', 'b', 'c'])
    row('wip').click()
    expect(holding('wip')).toBe('all')
    escape()
    expect(adds).toHaveBeenCalledExactlyOnceWith({ add: ['wip'], remove: [] })

    document.body.empty()
    const removes = open(['a', 'b', 'c'])
    row('wip').click()
    row('wip').click()
    escape()
    expect(removes).toHaveBeenCalledExactlyOnceWith({ add: [], remove: ['wip'] })
  })

  it('makes several changes in one go, leaving a mixed tag it was not asked about alone', () => {
    const apply = open(['a', 'b'])
    expect(holding('wip')).toBe('some')
    row('idle').click()
    row('art').click()
    escape()
    expect(apply).toHaveBeenCalledExactlyOnceWith({ add: ['idle'], remove: ['art'] })
  })

  it('adds a tag typed that does not exist yet, without a leading #', () => {
    const apply = open(['a', 'b'])
    type('#fresh')
    expect(labels()).toEqual(['Create "fresh"'])
    row('Create "fresh"').click()
    expect(holding('fresh')).toBe('all')
    escape()
    expect(apply).toHaveBeenCalledExactlyOnceWith({ add: ['fresh'], remove: [] })
  })

  it('does not offer to create a tag that exists, in any case', () => {
    open(['a'])
    type('ART')
    expect(labels()).toEqual(['art'])
  })

  it('applies nothing when closed untouched, or when a change is undone', () => {
    const untouched = open(['a', 'b'])
    escape()
    expect(untouched).not.toHaveBeenCalled()

    document.body.empty()
    const undone = open(['a', 'b'])
    row('idle').click()
    row('idle').click()
    escape()
    expect(undone).not.toHaveBeenCalled()
  })

  it('clears every tag the selected tasks hold, and only those', () => {
    const apply = open(['a', 'b'])
    row('Clear tags').click()
    expect(apply).toHaveBeenCalledExactlyOnceWith({ add: [], remove: ['art', 'wip'] })
  })

  it('drops the changes made before clear was picked', () => {
    const apply = open(['a', 'b'])
    row('idle').click()
    row('Clear tags').click()
    expect(apply).toHaveBeenCalledExactlyOnceWith({ add: [], remove: ['art', 'wip'] })
  })

  it('has nothing to clear when the selected tasks hold no tags', () => {
    open(['d'])
    expect(labels()).toEqual(['art', 'idle', 'ui', 'wip', 'Clear tags'])
    document.body.empty()
    const bare = makeTask({ id: 'e', tags: [] })
    const ctx = {
      state: { selectedTaskIds: new Set(['e']) },
      scope: { taskById: () => bare, tasks: () => [bare] }
    } as never
    openBulkTagPicker(ctx, document.body.createEl('button'), vi.fn<() => void>())
    expect(labels()).toEqual([])
  })

  it('is one tick per tag for a single task', () => {
    open(['a'])
    expect(holding('art')).toBe('all')
    expect(holding('wip')).toBe('all')
    expect(holding('ui')).toBe('none')
  })
})
