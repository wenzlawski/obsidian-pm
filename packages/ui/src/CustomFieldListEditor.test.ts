// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CustomFieldDef } from '@dotpm/core'
import { renderCustomFieldOptions } from './CustomFieldListEditor'

afterEach(() => document.body.empty())

function setup(overrides: Partial<CustomFieldDef> = {}) {
  const field: CustomFieldDef = { id: 'stage', name: 'Stage', type: 'select', options: ['A', 'B', 'C'], ...overrides }
  const onChanged = vi.fn<() => void>()
  const parent = document.body.createDiv()
  renderCustomFieldOptions(parent, field, onChanged)
  const rows = (): HTMLElement[] => Array.from(parent.querySelectorAll<HTMLElement>('.pm-cf-opt-row'))
  const inputAt = (i: number): HTMLInputElement => {
    const el = rows()[i].querySelector<HTMLInputElement>('input')
    if (!el) throw new Error(`no option ${i}`)
    return el
  }
  const values = (): string[] => rows().map((_, i) => inputAt(i).value)
  const numbers = (): string[] =>
    Array.from(parent.querySelectorAll('.pm-cf-opt-num')).map((el) => el.textContent ?? '')
  const addButton = (): HTMLButtonElement => {
    const el = parent.querySelector<HTMLButtonElement>('.pm-prop-add')
    if (!el) throw new Error('no add button')
    return el
  }
  return { field, onChanged, parent, rows, inputAt, values, numbers, addButton }
}

const type = (input: HTMLInputElement, text: string): void => {
  input.value = text
  input.dispatchEvent(new Event('input'))
  input.dispatchEvent(new Event('change'))
}

const press = (input: HTMLInputElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init })
  input.dispatchEvent(event)
  return event
}

describe('select options editor', () => {
  it('draws nothing for a field that is not a select', () => {
    const { parent } = setup({ type: 'text' })
    expect(parent.querySelector('.pm-cf-options')).toBeNull()
  })

  it('saves an edited option', () => {
    const { field, onChanged, inputAt } = setup()
    type(inputAt(1), 'Beta')
    expect(field.options).toEqual(['A', 'Beta', 'C'])
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('removes an option and renumbers the rest in place', () => {
    const { field, parent, rows, numbers } = setup({ numbered: true })
    const [first, , third] = rows()
    parent.querySelectorAll<HTMLElement>('.pm-cf-opt-row .pm-icon-btn')[1].click()
    expect(field.options).toEqual(['A', 'C'])
    expect(rows()).toEqual([first, third])
    expect(numbers()).toEqual(['1.', '2.'])
  })

  describe('reordering', () => {
    it('moves an option by dragging its row onto another', () => {
      const { field, onChanged, rows, values } = setup()
      rows()[2].dispatchEvent(new Event('dragstart'))
      rows()[0].dispatchEvent(new Event('drop'))
      expect(field.options).toEqual(['C', 'A', 'B'])
      expect(values()).toEqual(['C', 'A', 'B'])
      expect(onChanged).toHaveBeenCalledTimes(1)
    })

    it('keeps the rows themselves, only moved', () => {
      const { rows } = setup()
      const [a, b, c] = rows()
      c.dispatchEvent(new Event('dragstart'))
      a.dispatchEvent(new Event('drop'))
      expect(rows()).toEqual([c, a, b])
    })

    it('is draggable only while its grip is held, so text can be selected', () => {
      const { rows } = setup()
      const row = rows()[0]
      const grip = row.querySelector<HTMLElement>('.pm-cf-opt-grip')
      if (!grip) throw new Error('no grip')
      expect(row.hasAttribute('draggable')).toBe(false)
      grip.dispatchEvent(new Event('mousedown'))
      expect(row.getAttribute('draggable')).toBe('true')
      row.dispatchEvent(new Event('dragend'))
      expect(row.hasAttribute('draggable')).toBe(false)
      grip.dispatchEvent(new Event('mousedown'))
      grip.dispatchEvent(new Event('mouseup'))
      expect(row.hasAttribute('draggable')).toBe(false)
    })

    it('moves an option with Alt and the arrow keys, keeping focus on it', () => {
      const { field, inputAt } = setup()
      press(inputAt(1), 'ArrowUp', { altKey: true })
      expect(field.options).toEqual(['B', 'A', 'C'])
      expect(document.activeElement).toBe(inputAt(0))
      press(inputAt(0), 'ArrowUp', { altKey: true })
      press(inputAt(2), 'ArrowDown', { altKey: true })
      expect(field.options).toEqual(['B', 'A', 'C'])
    })

    it('keeps an edit made just before a move', () => {
      const { field, inputAt } = setup()
      const input = inputAt(0)
      input.value = 'Alpha'
      input.dispatchEvent(new Event('input'))
      press(input, 'ArrowDown', { altKey: true })
      expect(field.options).toEqual(['B', 'Alpha', 'C'])
    })
  })

  describe('Enter', () => {
    it('keeps what was typed and opens a new option after it, focused', () => {
      const { field, onChanged, inputAt, values } = setup()
      const first = inputAt(0)
      first.value = 'Alpha'
      first.dispatchEvent(new Event('input'))
      expect(press(first, 'Enter').defaultPrevented).toBe(true)
      expect(values()).toEqual(['Alpha', '', 'B', 'C'])
      expect(document.activeElement).toBe(inputAt(1))
      expect(field.options).toEqual(['Alpha', 'B', 'C'])
      expect(onChanged).toHaveBeenCalledTimes(1)
    })

    it('lets a whole list be typed with Enter alone', () => {
      const { field, parent, values, addButton } = setup({ options: [] })
      addButton().click()
      for (const name of ['One', 'Two', 'Three']) {
        const active = document.activeElement
        if (!(active instanceof HTMLInputElement)) throw new Error('focus left the options')
        active.value = name
        active.dispatchEvent(new Event('input'))
        press(active, 'Enter')
      }
      expect(values()).toEqual(['One', 'Two', 'Three', ''])
      expect(field.options).toEqual(['One', 'Two', 'Three'])
      expect(parent.querySelectorAll('.pm-cf-opt-row')).toHaveLength(4)
    })

    it('does nothing on an empty option, so blank rows do not pile up', () => {
      const { field, onChanged, inputAt, values } = setup({ options: ['A'] })
      press(inputAt(0), 'Enter')
      onChanged.mockClear()
      expect(press(inputAt(1), 'Enter').defaultPrevented).toBe(true)
      expect(values()).toEqual(['A', ''])
      expect(field.options).toEqual(['A'])
      expect(onChanged).not.toHaveBeenCalled()
    })

    it('leaves Enter to the input method while text is being composed', () => {
      const { inputAt, values } = setup()
      expect(press(inputAt(0), 'Enter', { isComposing: true }).defaultPrevented).toBe(false)
      expect(values()).toEqual(['A', 'B', 'C'])
    })
  })

  describe('an empty option', () => {
    const withBlank = () => {
      const s = setup({ options: ['A', 'B'] })
      press(s.inputAt(0), 'Enter')
      s.onChanged.mockClear()
      return { ...s, blank: s.inputAt(1) }
    }

    it('goes when focus moves out of the editor', () => {
      const { field, onChanged, blank, values } = withBlank()
      blank.focus()
      const outside = document.body.createEl('input')
      outside.focus()
      expect(values()).toEqual(['A', 'B'])
      expect(field.options).toEqual(['A', 'B'])
      expect(onChanged).not.toHaveBeenCalled()
    })

    it('goes when focus moves to another option, which stays the same element and keeps focus', () => {
      const { rows, blank, inputAt, values } = withBlank()
      const other = inputAt(2)
      blank.focus()
      other.focus()
      expect(values()).toEqual(['A', 'B'])
      expect(inputAt(1)).toBe(other)
      expect(document.activeElement).toBe(other)
      expect(rows()).toHaveLength(2)
    })

    it('renumbers the options that remain', () => {
      const { parent, blank, numbers } = withBlank()
      parent.querySelector<HTMLInputElement>('.pm-cf-numbered input')?.click()
      expect(numbers()).toEqual(['1.', '2.', '3.'])
      blank.focus()
      document.body.createEl('input').focus()
      expect(numbers()).toEqual(['1.', '2.'])
    })

    it('stays while focus moves to a button of the editor, until that button acts', () => {
      const { parent, rows, blank, values } = withBlank()
      const remove = rows()[0].querySelector<HTMLElement>('.pm-icon-btn')
      if (!remove) throw new Error('no remove button')
      blank.focus()
      remove.focus()
      expect(values()).toEqual(['A', '', 'B'])
      remove.click()
      expect(values()).toEqual(['B'])
      expect(parent.querySelectorAll('.pm-cf-opt-row')).toHaveLength(1)
    })

    it('stays while the window loses focus', () => {
      const { blank, values } = withBlank()
      blank.focus()
      const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false)
      blank.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }))
      hasFocus.mockRestore()
      expect(values()).toEqual(['A', '', 'B'])
    })

    it('is kept once text is typed into it', () => {
      const { field, blank, values } = withBlank()
      type(blank, 'New')
      blank.focus()
      document.body.createEl('input').focus()
      expect(values()).toEqual(['A', 'New', 'B'])
      expect(field.options).toEqual(['A', 'New', 'B'])
    })

    it('is reused by Add option rather than adding a second one', () => {
      const { values, blank, addButton } = withBlank()
      addButton().click()
      expect(values()).toEqual(['A', '', 'B'])
      expect(document.activeElement).toBe(blank)
    })

    it('never reaches what is saved', () => {
      const { field, inputAt, addButton } = setup({ options: ['A'] })
      addButton().click()
      type(inputAt(0), 'Alpha')
      expect(field.options).toEqual(['Alpha'])
    })

    it('still lets rows be dragged after one has gone', () => {
      const { field, rows, blank } = withBlank()
      blank.focus()
      document.body.createEl('input').focus()
      rows()[1].dispatchEvent(new Event('dragstart'))
      rows()[0].dispatchEvent(new Event('drop'))
      expect(field.options).toEqual(['B', 'A'])
    })
  })

  it('turns numbering on and off, leaving the option text alone', () => {
    const { field, onChanged, parent, values, numbers } = setup()
    const toggle = parent.querySelector<HTMLInputElement>('.pm-cf-numbered input')
    if (!toggle) throw new Error('no toggle')
    expect(numbers()).toEqual([])

    toggle.click()
    expect(field.numbered).toBe(true)
    expect(numbers()).toEqual(['1.', '2.', '3.'])
    expect(values()).toEqual(['A', 'B', 'C'])

    toggle.click()
    expect('numbered' in field).toBe(false)
    expect(numbers()).toEqual([])
    expect(onChanged).toHaveBeenCalledTimes(2)
  })
})
