import {
  type CustomFieldChange,
  type CustomFieldDef,
  type Task,
  customOptionLabel,
  displayName,
  stringifyCustomValue,
  t,
  today
} from '@dotpm/core'
import type { Choice } from './choice'

/** A change to make now, or a value the user still has to type. */
export type PropertyChoice = { op: 'change'; change: CustomFieldChange } | { op: 'enter' } | { op: 'pickDate' }

/** The values a task holds for a field, one entry each. A single value reads as a list of one. */
export function heldValues(task: Task, fieldId: string): string[] {
  const value = task.customFields[fieldId]
  return (Array.isArray(value) ? value : [value]).map(stringifyCustomValue).filter(Boolean)
}

/** The picker that comes first: which property to change. */
export function fieldChoices(fields: CustomFieldDef[]): Choice<CustomFieldDef>[] {
  return fields.map((field) => ({ label: field.name, value: field }))
}

function setTo(label: string, value: unknown, detail?: string): Choice<PropertyChoice> {
  return { label, detail, value: { op: 'change', change: { mode: 'set', value } } }
}

function onSome(count: number, total: number): string | undefined {
  return count > 0 && count < total ? t('bulk.tagOnSome', { count, total }) : undefined
}

/**
 * What can be done to one property of `tasks`. A value to pick from is a row each; a typed
 * value is one row that asks for it. A multi-select works like tags: add a value to the tasks
 * that lack it, take it off the ones that hold it. Clearing is offered only while a task has
 * something to clear.
 */
export function propertyChoices(field: CustomFieldDef, tasks: Task[], people: string[]): Choice<PropertyChoice>[] {
  const total = tasks.length
  const held = tasks.map((task) => heldValues(task, field.id))
  const count = (value: string): number => held.filter((values) => values.includes(value)).length
  const label = (option: string): string => customOptionLabel(field, option, displayName(option))
  const choices: Choice<PropertyChoice>[] = []
  let clearable = held.some((values) => values.length > 0)

  switch (field.type) {
    case 'select':
      for (const option of field.options ?? []) choices.push(setTo(label(option), option, onSome(count(option), total)))
      break
    case 'multiselect':
      for (const option of field.options ?? []) {
        const detail = onSome(count(option), total)
        const name = label(option)
        if (count(option) < total) {
          choices.push({
            label: t('bulk.valueAdd', { value: name }),
            detail,
            value: { op: 'change', change: { mode: 'add', values: [option] } }
          })
        }
        if (count(option) > 0) {
          choices.push({
            label: t('bulk.valueRemove', { value: name }),
            detail,
            value: { op: 'change', change: { mode: 'remove', values: [option] } }
          })
        }
      }
      break
    case 'person':
      for (const person of people) choices.push(setTo(displayName(person), person, onSome(count(person), total)))
      break
    // Unchecked is a value of its own, so there is nothing to clear to.
    case 'checkbox':
      choices.push(setTo(t('bulk.checked'), true), setTo(t('bulk.unchecked'), false))
      clearable = false
      break
    case 'date': {
      const now = today()
      const ahead = (days: number): string => now.add({ days }).toString()
      choices.push(
        setTo(t('bulk.today', { date: ahead(0) }), ahead(0)),
        setTo(t('bulk.tomorrow', { date: ahead(1) }), ahead(1)),
        setTo(t('bulk.inOneWeek', { date: ahead(7) }), ahead(7)),
        setTo(t('bulk.inTwoWeeks', { date: ahead(14) }), ahead(14)),
        { label: t('bulk.pickDate'), value: { op: 'pickDate' } }
      )
      break
    }
    case 'number':
    case 'text':
    case 'url':
      choices.push({ label: t('bulk.setValue'), value: { op: 'enter' } })
      break
  }

  if (clearable) choices.push({ label: t('bulk.clearValue'), value: { op: 'change', change: { mode: 'clear' } } })
  return choices
}
