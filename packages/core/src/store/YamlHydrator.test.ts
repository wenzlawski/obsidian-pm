import { describe, expect, it } from 'vitest'
import { customFieldList } from './YamlHydrator'

describe('customFieldList', () => {
  it('keeps the numbering flag of a field', () => {
    const [field] = customFieldList([
      { id: 'stage', name: 'Stage', type: 'select', options: ['A', 'B'], numbered: true }
    ])
    expect(field.numbered).toBe(true)
  })

  it('leaves the flag off unless it is exactly true', () => {
    const fields = customFieldList([
      { id: 'a', type: 'select', options: ['A'] },
      { id: 'b', type: 'select', options: ['A'], numbered: 'yes' },
      { id: 'c', type: 'select', options: ['A'], numbered: false }
    ])
    expect(fields.map((field) => 'numbered' in field)).toEqual([false, false, false])
  })
})
