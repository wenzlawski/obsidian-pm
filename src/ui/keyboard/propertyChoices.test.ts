import { describe, expect, it } from 'vitest'
import { type CustomFieldDef, makeTask } from '@dotpm/core'
import { fieldChoices, heldValues, propertyChoices } from './propertyChoices'

const field = (over: Partial<CustomFieldDef> & Pick<CustomFieldDef, 'type'>): CustomFieldDef => ({
  id: 'f',
  name: 'Field',
  ...over
})

const taskWith = (value?: unknown) => makeTask({ customFields: value === undefined ? {} : { f: value } })
const labels = (def: CustomFieldDef, tasks: ReturnType<typeof taskWith>[], people: string[] = []) =>
  propertyChoices(def, tasks, people).map((choice) => choice.label)

describe('heldValues', () => {
  it('reads a single value, a list and nothing alike', () => {
    expect(heldValues(taskWith('a'), 'f')).toEqual(['a'])
    expect(heldValues(taskWith(['a', 'b']), 'f')).toEqual(['a', 'b'])
    expect(heldValues(taskWith(), 'f')).toEqual([])
    expect(heldValues(taskWith(4), 'f')).toEqual(['4'])
  })
})

describe('fieldChoices', () => {
  it('names each field and carries it', () => {
    const def = field({ type: 'text', name: 'Client' })
    expect(fieldChoices([def])).toEqual([{ label: 'Client', value: def }])
  })
})

describe('propertyChoices', () => {
  it('offers each option of a select, and clearing only while a task holds a value', () => {
    const def = field({ type: 'select', options: ['S', 'M'] })
    expect(labels(def, [taskWith()])).toEqual(['S', 'M'])
    expect(labels(def, [taskWith('S')])).toEqual(['S', 'M', 'Clear value'])
  })

  it('numbers the options of a numbered select', () => {
    const def = field({ type: 'select', options: ['S', 'M'], numbered: true })
    expect(labels(def, [taskWith()])).toEqual(['1. S', '2. M'])
  })

  it('says how many tasks hold the value of a select', () => {
    const def = field({ type: 'select', options: ['S'] })
    const choices = propertyChoices(def, [taskWith('S'), taskWith()], [])
    expect(choices[0].detail).toBe('On 1 of 2 tasks')
    expect(propertyChoices(def, [taskWith('S')], [])[0].detail).toBeUndefined()
  })

  it('sets the option a select row names', () => {
    const def = field({ type: 'select', options: ['S'] })
    expect(propertyChoices(def, [taskWith()], [])[0].value).toEqual({
      op: 'change',
      change: { mode: 'set', value: 'S' }
    })
  })

  it('adds a multi-select value to tasks that lack it and removes it from those that hold it', () => {
    const def = field({ type: 'multiselect', options: ['a', 'b'] })
    expect(labels(def, [taskWith(['a'])])).toEqual(['Remove a', 'Add b', 'Clear value'])
    expect(labels(def, [taskWith(['a']), taskWith()])).toEqual(['Add a', 'Remove a', 'Add b', 'Clear value'])
  })

  it('carries the add and remove of a multi-select', () => {
    const def = field({ type: 'multiselect', options: ['a'] })
    const [add, remove] = propertyChoices(def, [taskWith(['a']), taskWith()], [])
    expect(add.value).toEqual({ op: 'change', change: { mode: 'add', values: ['a'] } })
    expect(remove.value).toEqual({ op: 'change', change: { mode: 'remove', values: ['a'] } })
  })

  it('offers the people it is given for a person field', () => {
    const def = field({ type: 'person' })
    expect(labels(def, [taskWith()], ['Ann', 'Bob'])).toEqual(['Ann', 'Bob'])
  })

  it('sets a checkbox either way, with nothing to clear to', () => {
    const def = field({ type: 'checkbox' })
    const choices = propertyChoices(def, [taskWith(true)], [])
    expect(choices.map((choice) => choice.label)).toEqual(['Checked', 'Unchecked'])
    expect(choices.map((choice) => choice.value)).toEqual([
      { op: 'change', change: { mode: 'set', value: true } },
      { op: 'change', change: { mode: 'set', value: false } }
    ])
  })

  it('offers dates ahead and a typed date for a date field', () => {
    const choices = propertyChoices(field({ type: 'date' }), [taskWith()], [])
    expect(choices).toHaveLength(5)
    expect(choices[4].value).toEqual({ op: 'pickDate' })
    expect(choices[0].value).toMatchObject({
      op: 'change',
      change: { mode: 'set', value: expect.stringMatching(/^\d{4}-\d\d-\d\d$/) }
    })
  })

  it.each(['number', 'text', 'url'] as const)('asks for a typed value for a %s field', (type) => {
    const choices = propertyChoices(field({ type }), [taskWith('x')], [])
    expect(choices.map((choice) => choice.value)).toEqual([
      { op: 'enter' },
      { op: 'change', change: { mode: 'clear' } }
    ])
  })
})
