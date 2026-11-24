// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CustomFieldChange, CustomFieldDef } from '@dotpm/core'
import { bulkEditableFields, openBulkPropertyPicker } from './BulkFieldEditors'

const { promptText } = vi.hoisted(() => ({ promptText: vi.fn<() => Promise<string | null>>() }))
vi.mock('#ui/ModalFactory', () => ({ promptText }))
vi.mock('#ui/PersonPicker', () => ({ peopleSource: () => ({ known: () => ['Ada', 'Grace'], search: () => [] }) }))

const FIELDS: CustomFieldDef[] = [
  { id: 'client', name: 'Client', type: 'select', options: ['Acme', 'Globex'] },
  { id: 'labels', name: 'Labels', type: 'multiselect', options: ['a', 'b', 'c'] },
  { id: 'owner', name: 'Owner', type: 'person' },
  { id: 'done', name: 'Done', type: 'checkbox' },
  { id: 'start', name: 'Start', type: 'date' },
  { id: 'size', name: 'Size', type: 'number' },
  { id: 'note', name: 'Note', type: 'text' },
  { id: 'link', name: 'Link', type: 'url' }
]

function makeCtx(defined: CustomFieldDef[] = FIELDS) {
  const project = { id: 'p' }
  return {
    state: { selectedTaskIds: new Set(['t1']) },
    scope: {
      groupByProject: () => [{ project, taskIds: ['t1'] }],
      customFields: () => FIELDS,
      teamMembers: () => [],
      tasks: () => [],
      primary: null
    },
    plugin: { store: { configFor: () => ({ customFields: defined }) }, app: {}, settings: { globalTeamMembers: [] } }
  } as never
}

const rows = (): HTMLElement[] => Array.from(document.body.querySelectorAll<HTMLElement>('.pm-pop-item'))
const labels = (): (string | null)[] => rows().map((r) => r.querySelector('.pm-pop-item-label')?.textContent ?? null)
const click = (label: string): void => {
  const row = rows().find((r) => r.querySelector('.pm-pop-item-label')?.textContent === label)
  if (!row) throw new Error(`no row "${label}" in ${JSON.stringify(labels())}`)
  row.click()
}
const escape = (): void => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}
/** Closes every popover the way a reader does, so none is left listening for keys. */
const closePopovers = (): void => {
  for (let i = 0; i < 20 && document.querySelector('.pm-pop'); i++) escape()
}
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** Picks a field in the first picker and returns what the editor then reports. */
function openEditor(name: string, ctx = makeCtx()) {
  const anchor = document.body.createEl('button')
  const applied = vi.fn<(field: CustomFieldDef, change: CustomFieldChange) => void>()
  openBulkPropertyPicker(ctx, anchor, applied)
  click(name)
  return applied
}

afterEach(() => {
  closePopovers()
  document.body.empty()
  promptText.mockReset()
})

describe('bulk property picker', () => {
  it('lists the fields and opens an editor for every one of them', () => {
    for (const field of FIELDS) {
      closePopovers()
      document.body.empty()
      const anchor = document.body.createEl('button')
      openBulkPropertyPicker(makeCtx(), anchor, vi.fn<() => void>())
      expect(labels()).toEqual(FIELDS.map((f) => f.name))
      click(field.name)
      expect(rows().length, `${field.name} (${field.type})`).toBeGreaterThan(0)
    }
  })

  it('only offers fields a selected task has', () => {
    expect(bulkEditableFields(makeCtx([FIELDS[0], FIELDS[3]])).map((f) => f.id)).toEqual(['client', 'done'])
    expect(bulkEditableFields(makeCtx([]))).toEqual([])
  })
})

describe('bulk property picker on its button', () => {
  const popovers = (): number => document.body.querySelectorAll('.pm-pop').length
  const press = (anchor: HTMLElement): void => {
    openBulkPropertyPicker(makeCtx(), anchor, vi.fn<() => void>())
  }

  it('toggles instead of stacking pickers when the button is pressed repeatedly', () => {
    const anchor = document.body.createEl('button')
    for (let i = 0; i < 6; i++) {
      press(anchor)
      expect(popovers()).toBe(i % 2 === 0 ? 1 : 0)
    }
  })

  it('closes the editor of a field when the button is pressed again, without opening a new picker', () => {
    const anchor = document.body.createEl('button')
    press(anchor)
    click('Client')
    expect(labels()).toEqual(['Clear value', 'Acme', 'Globex'])
    press(anchor)
    expect(popovers()).toBe(0)
  })

  it('opens the list of fields again after that', () => {
    const anchor = document.body.createEl('button')
    press(anchor)
    click('Client')
    press(anchor)
    press(anchor)
    expect(labels()).toEqual(FIELDS.map((f) => f.name))
    expect(popovers()).toBe(1)
  })
})

describe('bulk field editors', () => {
  it('sets a select to the option picked', () => {
    const applied = openEditor('Client')
    expect(labels()).toEqual(['Clear value', 'Acme', 'Globex'])
    click('Globex')
    expect(applied).toHaveBeenCalledExactlyOnceWith(FIELDS[0], { mode: 'set', value: 'Globex' })
  })

  it('clears a field from its clear row', () => {
    const applied = openEditor('Client')
    click('Clear value')
    expect(applied).toHaveBeenCalledExactlyOnceWith(FIELDS[0], { mode: 'clear' })
  })

  it('adds the values ticked in a multi-select once its picker closes', () => {
    const applied = openEditor('Labels')
    click('a')
    click('c')
    expect(applied).not.toHaveBeenCalled()
    escape()
    expect(applied).toHaveBeenCalledExactlyOnceWith(FIELDS[1], { mode: 'add', values: ['a', 'c'] })
  })

  it('adds nothing when a multi-select is closed untouched', () => {
    const applied = openEditor('Labels')
    escape()
    expect(applied).not.toHaveBeenCalled()
  })

  it('sets a person', () => {
    const applied = openEditor('Owner')
    expect(labels()).toEqual(['Clear value', 'Ada', 'Grace'])
    click('Grace')
    expect(applied).toHaveBeenCalledExactlyOnceWith(FIELDS[2], { mode: 'set', value: 'Grace' })
  })

  it('checks or unchecks, with nothing to clear', () => {
    const applied = openEditor('Done')
    expect(labels()).toEqual(['Checked', 'Unchecked'])
    click('Unchecked')
    expect(applied).toHaveBeenCalledExactlyOnceWith(FIELDS[3], { mode: 'set', value: false })
  })

  it('sets a date from the quick choices', () => {
    const applied = openEditor('Start')
    expect(labels().slice(0, 1)).toEqual(['Clear value'])
    expect(labels()).toHaveLength(6)
    rows()[1].click()
    const [, change] = applied.mock.calls[0]
    expect(change).toMatchObject({ mode: 'set' })
    expect((change as { value: string }).value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('sets a number typed into the prompt', async () => {
    promptText.mockResolvedValue('4.5')
    const applied = openEditor('Size')
    click('Enter a value...')
    await flush()
    expect(applied).toHaveBeenCalledExactlyOnceWith(FIELDS[5], { mode: 'set', value: 4.5 })
  })

  it('refuses text that is not a number', async () => {
    promptText.mockResolvedValue('abc')
    const applied = openEditor('Size')
    click('Enter a value...')
    await flush()
    expect(applied).not.toHaveBeenCalled()
  })

  it('sets text and links as typed, and does nothing when the prompt is cancelled', async () => {
    promptText.mockResolvedValue('hello')
    const note = openEditor('Note')
    click('Enter a value...')
    await flush()
    expect(note).toHaveBeenCalledExactlyOnceWith(FIELDS[6], { mode: 'set', value: 'hello' })

    closePopovers()
    document.body.empty()
    promptText.mockResolvedValue(null)
    const link = openEditor('Link')
    click('Enter a value...')
    await flush()
    expect(link).not.toHaveBeenCalled()
  })
})
