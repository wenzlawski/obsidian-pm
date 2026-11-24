// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openOptionPicker, type OptionPickerOpts } from './OptionPicker'

const OPTIONS = ['a', 'b', 'c'].map((id) => ({ id, label: id }))

function open(opts: Partial<OptionPickerOpts> = {}) {
  const anchor = document.body.createEl('button')
  const onCommit = vi.fn<(selected: string[]) => void>()
  const pop = openOptionPicker({ anchor, options: OPTIONS, selected: [], onCommit, ...opts })
  return { pop, onCommit }
}

const escape = (): void => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}
const rows = (): HTMLElement[] => Array.from(document.body.querySelectorAll<HTMLElement>('.pm-pop-item'))
const labels = (): (string | null)[] => rows().map((r) => r.querySelector('.pm-pop-item-label')?.textContent ?? null)

afterEach(() => {
  for (let i = 0; i < 10 && document.querySelector('.pm-pop'); i++) escape()
  document.body.empty()
})

describe('openOptionPicker clear row', () => {
  it('comes last and runs at once, committing nothing', () => {
    const run = vi.fn<() => void>()
    const { onCommit } = open({ clear: { label: 'Clear', run } })
    expect(labels()).toEqual(['a', 'b', 'c', 'Clear'])
    rows()[3].click()
    expect(run).toHaveBeenCalledOnce()
    expect(onCommit).not.toHaveBeenCalled()
    expect(rows()).toHaveLength(0)
  })

  it('drops values toggled in a multiple choice before it was clicked', () => {
    const run = vi.fn<() => void>()
    const { onCommit } = open({ multiple: true, clear: { label: 'Clear', run } })
    rows()[0].click()
    rows()[1].click()
    rows()[3].click()
    expect(run).toHaveBeenCalledOnce()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('runs even when nothing was held to begin with, unlike the none row', () => {
    const run = vi.fn<() => void>()
    open({ noneLabel: 'None', clear: { label: 'Clear', run } })
    expect(labels()).toEqual(['None', 'a', 'b', 'c', 'Clear'])
    rows()[4].click()
    expect(run).toHaveBeenCalledOnce()
  })

  it('is left out while searching', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `o${i}`, label: `o${i}` }))
    open({ options: many, clear: { label: 'Clear', run: vi.fn<() => void>() } })
    const search = document.body.querySelector<HTMLInputElement>('.pm-pop-field')
    if (!search) throw new Error('no search field')
    search.value = 'o3'
    search.dispatchEvent(new Event('input'))
    expect(labels()).toEqual(['o3'])
  })

  it('is absent unless asked for', () => {
    open()
    expect(labels()).toEqual(['a', 'b', 'c'])
  })
})

describe('openOptionPicker commit', () => {
  it('commits a single pick once and closes', () => {
    const { onCommit } = open()
    rows()[1].click()
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(['b'], [])
    expect(rows()).toHaveLength(0)
  })

  it('commits a multiple choice when it closes, not before', () => {
    const { pop, onCommit } = open({ multiple: true })
    rows()[0].click()
    rows()[2].click()
    expect(onCommit).not.toHaveBeenCalled()
    pop?.close()
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(['a', 'c'], [])
  })
})

describe('openOptionPicker mixed rows', () => {
  const state = (): { checked: boolean; mixed: boolean }[] =>
    rows().map((r) => ({
      checked: !r.querySelector('.pm-pop-check--hidden'),
      mixed: r.hasClass('pm-pop-item--mixed')
    }))

  it('marks a mixed row apart from a held one and one that is not held', () => {
    open({ multiple: true, selected: ['a'], mixed: ['b'] })
    expect(state()).toEqual([
      { checked: true, mixed: false },
      { checked: true, mixed: true },
      { checked: false, mixed: false }
    ])
    expect(rows()[1].getAttribute('aria-pressed')).toBe('mixed')
  })

  it('makes a mixed row held on the first pick and takes it off on the second', () => {
    const { pop, onCommit } = open({ multiple: true, mixed: ['b'] })
    rows()[1].click()
    expect(state()[1]).toEqual({ checked: true, mixed: false })
    rows()[1].click()
    expect(state()[1]).toEqual({ checked: false, mixed: false })
    pop?.close()
    expect(onCommit).toHaveBeenCalledExactlyOnceWith([], [])
  })

  it('reports a mixed row that was left alone as still mixed, with nothing else to commit', () => {
    const { pop, onCommit } = open({ multiple: true, mixed: ['b'] })
    rows()[0].click()
    pop?.close()
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(['a'], ['b'])
  })

  it('commits nothing when it closes untouched', () => {
    const { pop, onCommit } = open({ multiple: true, selected: ['a'], mixed: ['b'] })
    pop?.close()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('keeps a mixed value the list does not offer', () => {
    open({ multiple: true, options: [], mixed: ['gone'] })
    expect(labels()).toEqual(['gone'])
    expect(state()).toEqual([{ checked: true, mixed: true }])
  })

  it('shows a note on a row', () => {
    open({ multiple: true, options: [{ id: 'a', label: 'a', note: '2/5' }] })
    expect(rows()[0].querySelector('.pm-pop-item-note')?.textContent).toBe('2/5')
  })
})

describe('openOptionPicker create row', () => {
  const create = {
    label: (name: string) => `Create ${name}`,
    normalize: (name: string) => name.replace(/^#/, '').trim()
  }
  const type = (text: string): void => {
    const input = document.body.querySelector<HTMLInputElement>('.pm-pop-field')
    if (!input) throw new Error('no search field')
    input.value = text
    input.dispatchEvent(new Event('input'))
  }

  it('has a search field however short the list', () => {
    open({ multiple: true, create })
    expect(document.body.querySelector('.pm-pop-field')).not.toBeNull()
  })

  it('offers to create what is typed when no option matches, and holds it once made', () => {
    const { pop, onCommit } = open({ multiple: true, create })
    type('#fresh')
    expect(labels()).toEqual(['Create fresh'])
    rows()[0].click()
    expect(labels()).toEqual(['a', 'b', 'c', 'fresh'])
    expect(rows()[3].querySelector('.pm-pop-check--hidden')).toBeNull()
    pop?.close()
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(['fresh'], [])
  })

  it('offers nothing to create when an option has that name, whatever its case', () => {
    open({ multiple: true, create })
    type('A')
    expect(labels()).toEqual(['a'])
  })

  it('refuses text its normalizer empties', () => {
    open({ multiple: true, create })
    type('#')
    expect(labels()).toEqual([])
  })

  it('is absent unless asked for', () => {
    open({ multiple: true, options: Array.from({ length: 9 }, (_, i) => ({ id: `o${i}`, label: `o${i}` })) })
    type('zzz')
    expect(labels()).toEqual([])
  })

  it('does not commit a created value that was taken off again', () => {
    const { pop, onCommit } = open({ multiple: true, create })
    type('x')
    rows()[0].click()
    rows()[3].click()
    pop?.close()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('closes on Escape without committing what was never changed', () => {
    const { onCommit } = open({ multiple: true, create })
    escape()
    expect(onCommit).not.toHaveBeenCalled()
  })
})

describe('openOptionPicker on a button that has one open', () => {
  const popovers = (): number => document.body.querySelectorAll('.pm-pop').length

  it('closes the open picker instead of stacking another', () => {
    const anchor = document.body.createEl('button')
    const first = openOptionPicker({ anchor, options: OPTIONS, selected: [], onCommit: vi.fn<() => void>() })
    expect(first).not.toBeNull()
    expect(popovers()).toBe(1)
    const second = openOptionPicker({ anchor, options: OPTIONS, selected: [], onCommit: vi.fn<() => void>() })
    expect(second).toBeNull()
    expect(popovers()).toBe(0)
  })

  it('never has more than one open however often the button is pressed', () => {
    const anchor = document.body.createEl('button')
    for (let i = 0; i < 7; i++) {
      openOptionPicker({ anchor, options: OPTIONS, selected: [], onCommit: vi.fn<() => void>() })
      expect(popovers()).toBe(i % 2 === 0 ? 1 : 0)
    }
  })

  it('opens again once the picker was closed another way', () => {
    const anchor = document.body.createEl('button')
    openOptionPicker({ anchor, options: OPTIONS, selected: [], onCommit: vi.fn<() => void>() })
    escape()
    expect(popovers()).toBe(0)
    expect(openOptionPicker({ anchor, options: OPTIONS, selected: [], onCommit: vi.fn<() => void>() })).not.toBeNull()
    expect(popovers()).toBe(1)
  })

  it('commits a multiple choice when the button closes it', () => {
    const anchor = document.body.createEl('button')
    const onCommit = vi.fn<(selected: string[]) => void>()
    openOptionPicker({ anchor, options: OPTIONS, selected: [], multiple: true, onCommit })
    rows()[1].click()
    openOptionPicker({ anchor, options: OPTIONS, selected: [], multiple: true, onCommit })
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(['b'], [])
  })

  it('leaves the pickers of other buttons alone', () => {
    const one = document.body.createEl('button')
    const two = document.body.createEl('button')
    openOptionPicker({ anchor: one, options: OPTIONS, selected: [], onCommit: vi.fn<() => void>() })
    openOptionPicker({ anchor: two, options: OPTIONS, selected: [], onCommit: vi.fn<() => void>() })
    expect(popovers()).toBe(2)
  })

  it('lets a commit open the next picker on the same button', () => {
    const anchor = document.body.createEl('button')
    openOptionPicker({
      anchor,
      options: OPTIONS,
      selected: [],
      onCommit: () => {
        openOptionPicker({ anchor, options: [{ id: 'x', label: 'x' }], selected: [], onCommit: vi.fn<() => void>() })
      }
    })
    rows()[0].click()
    expect(labels()).toEqual(['x'])
    expect(popovers()).toBe(1)
  })
})
