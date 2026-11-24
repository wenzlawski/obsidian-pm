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

const rows = (): HTMLElement[] => Array.from(document.body.querySelectorAll<HTMLElement>('.pm-pop-item'))
const labels = (): (string | null)[] => rows().map((r) => r.querySelector('.pm-pop-item-label')?.textContent ?? null)

afterEach(() => {
  document.body.empty()
})

describe('openOptionPicker clear row', () => {
  it('comes first and runs at once, committing nothing', () => {
    const run = vi.fn<() => void>()
    const { onCommit } = open({ clear: { label: 'Clear', run } })
    expect(labels()).toEqual(['Clear', 'a', 'b', 'c'])
    rows()[0].click()
    expect(run).toHaveBeenCalledOnce()
    expect(onCommit).not.toHaveBeenCalled()
    expect(rows()).toHaveLength(0)
  })

  it('drops values toggled in a multiple choice before it was clicked', () => {
    const run = vi.fn<() => void>()
    const { onCommit } = open({ multiple: true, clear: { label: 'Clear', run } })
    rows()[1].click()
    rows()[2].click()
    rows()[0].click()
    expect(run).toHaveBeenCalledOnce()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('runs even when nothing was held to begin with, unlike the none row', () => {
    const run = vi.fn<() => void>()
    open({ noneLabel: 'None', clear: { label: 'Clear', run } })
    expect(labels()).toEqual(['Clear', 'None', 'a', 'b', 'c'])
    rows()[0].click()
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
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(['b'])
    expect(rows()).toHaveLength(0)
  })

  it('commits a multiple choice when it closes, not before', () => {
    const { pop, onCommit } = open({ multiple: true })
    rows()[0].click()
    rows()[2].click()
    expect(onCommit).not.toHaveBeenCalled()
    pop.close()
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(['a', 'c'])
  })
})
