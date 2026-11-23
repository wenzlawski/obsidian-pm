import { describe, expect, it } from 'vitest'
import { makeTask, type CustomFieldDef } from '@dotpm/core'
import { cardCustomValues } from './boardCards'

const stage: CustomFieldDef = {
  id: 'stage',
  name: 'Stage',
  type: 'multiselect',
  options: ['Draft', '[[Review]]', 'Done']
}

const text = (field: CustomFieldDef, value: unknown): string | undefined =>
  cardCustomValues(makeTask({ customFields: { stage: value } }), [field], ['cf:stage'])['cf:stage']?.text

describe('cardCustomValues', () => {
  it('shows a plain select value as it is, a link as its note name', () => {
    expect(text(stage, ['Draft', '[[Review]]'])).toBe('Draft, Review')
  })

  it('numbers the values of a numbered field, links included', () => {
    expect(text({ ...stage, numbered: true }, ['Draft', '[[Review]]'])).toBe('1. Draft, 2. Review')
  })

  it('leaves a value that is not an option as it is', () => {
    expect(text({ ...stage, numbered: true }, ['Gone'])).toBe('Gone')
  })
})
