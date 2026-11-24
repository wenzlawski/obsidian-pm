// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CustomFieldDef } from '@dotpm/core'
import { choiceFieldValue, CustomFieldCell } from './CustomFieldCell'

const SELECT: CustomFieldDef = { id: 'client', name: 'Client', type: 'select', options: ['Acme', 'Globex'] }
const MULTI: CustomFieldDef = { id: 'labels', name: 'Labels', type: 'multiselect', options: ['a', 'b', 'c'] }

type Save = (stored: string | string[]) => void

function cell(cf: CustomFieldDef, values: string[], save?: Save, shown = values) {
  const value = choiceFieldValue(cf, shown, save && { own: values, save })
  if (!value) throw new Error('not a choice field')
  const row = document.body.createEl('tr')
  const { el } = new CustomFieldCell(row, value)
  return { el, trigger: el.find('.pm-cf-value') as HTMLElement }
}

const rows = (): HTMLElement[] => Array.from(document.body.querySelectorAll<HTMLElement>('.pm-pop-item'))
const labels = (): (string | null)[] => rows().map((r) => r.querySelector('.pm-pop-item-label')?.textContent ?? null)
const picked = (): (string | null)[] =>
  rows()
    .filter((r) => !r.querySelector('.pm-pop-check--hidden'))
    .map((r) => r.querySelector('.pm-pop-item-label')?.textContent ?? null)

afterEach(() => {
  document.body.empty()
})

describe('choiceFieldValue', () => {
  it('only describes select and multi-select fields', () => {
    expect(choiceFieldValue({ id: 'n', name: 'N', type: 'number' }, [])).toBeNull()
    expect(choiceFieldValue(SELECT, ['Acme'])).toMatchObject({ kind: 'choice', multiple: false, values: ['Acme'] })
    expect(choiceFieldValue(MULTI, [])).toMatchObject({ kind: 'choice', multiple: true })
  })

  it('has no way to edit without a save', () => {
    expect(choiceFieldValue(SELECT, [])).toMatchObject({ onChange: undefined })
  })
})

describe('CustomFieldCell choice', () => {
  it('shows the values, or a dash when there are none', () => {
    expect(cell(MULTI, ['a', 'c']).trigger.textContent).toBe('a, c')
    expect(cell(SELECT, []).trigger.textContent).toBe('—')
  })

  it('is inert without a save', () => {
    const { trigger } = cell(SELECT, ['Acme'])
    trigger.click()
    expect(rows()).toHaveLength(0)
    expect(trigger.hasClass('pm-cf-value--editable')).toBe(false)
  })

  it('saves a picked select option as a string and closes', () => {
    const save = vi.fn<Save>()
    const { trigger } = cell(SELECT, ['Acme'], save)
    trigger.click()
    expect(labels()).toEqual(['None', 'Acme', 'Globex'])
    expect(picked()).toEqual(['Acme'])
    rows()[2].click()
    expect(save).toHaveBeenCalledExactlyOnceWith('Globex')
    expect(rows()).toHaveLength(0)
  })

  it('clears a select through the None row', () => {
    const save = vi.fn<Save>()
    cell(SELECT, ['Acme'], save).trigger.click()
    rows()[0].click()
    expect(save).toHaveBeenCalledExactlyOnceWith('')
  })

  it('does not save when the same option is picked again', () => {
    const save = vi.fn<Save>()
    cell(SELECT, ['Acme'], save).trigger.click()
    rows()[1].click()
    expect(save).not.toHaveBeenCalled()
  })

  it('holds a multi-select open and saves the list once it closes', () => {
    const save = vi.fn<Save>()
    const { trigger } = cell(MULTI, ['a'], save)
    trigger.click()
    expect(labels()).toEqual(['a', 'b', 'c'])
    rows()[1].click()
    rows()[2].click()
    rows()[0].click()
    expect(save).not.toHaveBeenCalled()
    expect(picked()).toEqual(['b', 'c'])
    trigger.click()
    expect(save).toHaveBeenCalledExactlyOnceWith(['b', 'c'])
    expect(rows()).toHaveLength(0)
  })

  it('saves nothing when a multi-select is left as it was', () => {
    const save = vi.fn<Save>()
    const { trigger } = cell(MULTI, ['a'], save)
    trigger.click()
    rows()[1].click()
    rows()[1].click()
    trigger.click()
    expect(save).not.toHaveBeenCalled()
  })

  it('keeps a value the field no longer offers so it can be removed', () => {
    const save = vi.fn<Save>()
    const { trigger } = cell(MULTI, ['gone', 'a'], save)
    trigger.click()
    expect(labels()).toEqual(['a', 'b', 'c', 'gone'])
    rows()[3].click()
    trigger.click()
    expect(save).toHaveBeenCalledExactlyOnceWith(['a'])
  })

  it('numbers the options of a numbered field, in the cell and the picker', () => {
    const save = vi.fn<Save>()
    const { trigger } = cell({ ...SELECT, numbered: true }, ['Globex'], save)
    expect(trigger.textContent).toBe('2. Globex')
    trigger.click()
    expect(labels()).toEqual(['None', '1. Acme', '2. Globex'])
    rows()[1].click()
    expect(save).toHaveBeenCalledExactlyOnceWith('Acme')
  })

  it('shows what an ancestor contributes but edits only the values the task holds', () => {
    const save = vi.fn<Save>()
    const { trigger } = cell(MULTI, ['b'], save, ['a', 'b'])
    expect(trigger.textContent).toBe('a, b')
    trigger.click()
    expect(picked()).toEqual(['b'])
    rows()[2].click()
    trigger.click()
    expect(save).toHaveBeenCalledExactlyOnceWith(['b', 'c'])
  })

  it('opens from the keyboard', () => {
    const { trigger } = cell(SELECT, [], vi.fn<Save>())
    expect(trigger.getAttribute('role')).toBe('button')
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(rows().length).toBeGreaterThan(0)
  })
})
