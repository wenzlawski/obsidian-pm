import { t, tagUsage, type Task } from '@dotpm/core'
import type { Choice } from './choice'

export type TagChoice = { op: 'add' | 'remove'; tag: string } | { op: 'new' } | { op: 'clear' }

/**
 * What can be done to the tags of `tasks`, one entry each: add a tag to the tasks that lack it,
 * take it off the ones that hold it. A tag only some hold offers both, with how many hold it.
 * Searching "remove" narrows the list to the removals.
 */
export function tagChoices(tasks: Task[], known: string[]): Choice<TagChoice>[] {
  const total = tasks.length
  const usage = tagUsage(tasks, known)
  const choices: Choice<TagChoice>[] = []
  for (const { tag, count } of usage) {
    const label = `#${tag}`
    const detail = count > 0 && count < total ? t('bulk.tagOnSome', { count, total }) : undefined
    if (count < total) choices.push({ label: t('bulk.tagAdd', { tag: label }), detail, value: { op: 'add', tag } })
    if (count > 0) choices.push({ label: t('bulk.tagRemove', { tag: label }), detail, value: { op: 'remove', tag } })
  }
  choices.push({ label: t('bulk.newTag'), value: { op: 'new' } })
  if (usage.some((entry) => entry.count > 0)) choices.push({ label: t('bulk.clearTags'), value: { op: 'clear' } })
  return choices
}
