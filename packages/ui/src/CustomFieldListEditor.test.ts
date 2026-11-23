// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import type { CustomFieldDef } from '@dotpm/core'
import { renderCustomFieldOptions } from './CustomFieldListEditor'

function setup(overrides: Partial<CustomFieldDef> = {}) {
  const field: CustomFieldDef = { id: 'stage', name: 'Stage', type: 'select', options: ['A', 'B', 'C'], ...overrides }
  const onChanged = vi.fn<() => void>()
  const parent = document.body.createDiv()
  renderCustomFieldOptions(parent, field, onChanged)
  const rows = (): HTMLElement[] => Array.from(parent.querySelectorAll<HTMLElement>('.pm-cf-opt-row'))
  const values = (): string[] => rows().map((row) => row.querySelector<HTMLInputElement>('input')?.value ?? '')
  return { field, onChanged, parent, rows, values }
}

describe('select options editor', () => {
  it('draws nothing for a field that is not a select', () => {
    const { parent } = setup({ type: 'text' })
    expect(parent.querySelector('.pm-cf-options')).toBeNull()
  })

  it('moves an option by dragging it onto another', () => {
    const { field, onChanged, rows, values } = setup()
    rows()[2].dispatchEvent(new Event('dragstart'))
    rows()[0].dispatchEvent(new Event('drop'))
    expect(field.options).toEqual(['C', 'A', 'B'])
    expect(values()).toEqual(['C', 'A', 'B'])
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('moves an option from the keyboard with Alt and the arrow keys, keeping focus on it', () => {
    const { field, rows } = setup()
    const input = (i: number): HTMLInputElement => {
      const el = rows()[i].querySelector<HTMLInputElement>('input')
      if (!el) throw new Error('no input')
      return el
    }
    input(1).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, cancelable: true }))
    expect(field.options).toEqual(['B', 'A', 'C'])
    expect(document.activeElement).toBe(input(0))
    input(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, cancelable: true }))
    expect(field.options).toEqual(['B', 'A', 'C'])
    input(2).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, cancelable: true }))
    expect(field.options).toEqual(['B', 'A', 'C'])
  })

  describe('Enter in an option', () => {
    const press = (input: HTMLInputElement, init: KeyboardEventInit = {}): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, ...init })
      input.dispatchEvent(event)
      return event
    }
    const inputAt = (rows: () => HTMLElement[], i: number): HTMLInputElement => {
      const el = rows()[i].querySelector<HTMLInputElement>('input')
      if (!el) throw new Error('no input')
      return el
    }

    it('keeps what was typed and opens a new option after it, focused', () => {
      const { field, onChanged, rows, values } = setup()
      const first = inputAt(rows, 0)
      first.value = 'Alpha'
      expect(press(first).defaultPrevented).toBe(true)
      expect(field.options).toEqual(['Alpha', '', 'B', 'C'])
      expect(values()).toEqual(['Alpha', '', 'B', 'C'])
      expect(document.activeElement).toBe(inputAt(rows, 1))
      expect(onChanged).toHaveBeenCalledTimes(1)
    })

    it('adds at the end from the last option, so a list can be typed out with Enter alone', () => {
      const { field, parent, values } = setup({ options: [] })
      parent.querySelector<HTMLButtonElement>('.pm-prop-add')?.click()
      for (const name of ['One', 'Two', 'Three']) {
        const active = document.activeElement
        if (!(active instanceof HTMLInputElement)) throw new Error('focus left the options')
        active.value = name
        press(active)
      }
      expect(field.options).toEqual(['One', 'Two', 'Three', ''])
      expect(values()).toEqual(['One', 'Two', 'Three', ''])
    })

    it('does nothing on an empty option, so blank rows do not pile up', () => {
      const { field, onChanged, rows } = setup({ options: ['A', ''] })
      const empty = inputAt(rows, 1)
      expect(press(empty).defaultPrevented).toBe(true)
      expect(field.options).toEqual(['A', ''])
      expect(onChanged).not.toHaveBeenCalled()
    })

    it('leaves Enter to the input method while text is being composed', () => {
      const { field, rows } = setup()
      expect(press(inputAt(rows, 0), { isComposing: true }).defaultPrevented).toBe(false)
      expect(field.options).toEqual(['A', 'B', 'C'])
    })
  })

  it('turns numbering on and off, leaving the option text alone', () => {
    const { field, onChanged, parent, values } = setup()
    const toggle = parent.querySelector<HTMLInputElement>('.pm-cf-numbered input')
    if (!toggle) throw new Error('no toggle')
    const numbers = (): string[] =>
      Array.from(parent.querySelectorAll('.pm-cf-opt-num')).map((el) => el.textContent ?? '')
    expect(numbers()).toEqual([])

    toggle.checked = true
    toggle.dispatchEvent(new Event('change'))
    expect(field.numbered).toBe(true)
    expect(numbers()).toEqual(['1.', '2.', '3.'])
    expect(values()).toEqual(['A', 'B', 'C'])

    toggle.checked = false
    toggle.dispatchEvent(new Event('change'))
    expect('numbered' in field).toBe(false)
    expect(numbers()).toEqual([])
    expect(onChanged).toHaveBeenCalledTimes(2)
  })

  it('renumbers after an option is removed from the middle', () => {
    const { field, parent } = setup({ numbered: true })
    parent.querySelectorAll<HTMLElement>('.pm-cf-opt-row .pm-icon-btn')[1].click()
    expect(field.options).toEqual(['A', 'C'])
    expect(Array.from(parent.querySelectorAll('.pm-cf-opt-num')).map((el) => el.textContent)).toEqual(['1.', '2.'])
  })
})
