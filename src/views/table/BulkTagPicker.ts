import { collectAllTags, diffTagChange, t, tagUsage, type Task, type TagChange } from '@dotpm/core'
import { openOptionPicker } from '@dotpm/ui'
import type { TableContext } from './TableRenderer'

/**
 * Edits the tags of every selected task in one picker. A tag every task holds is ticked, one
 * only some hold is marked with a dash and the count, and picking a row puts the tag on all
 * of them or takes it off all of them. Typing a new name adds it. What is applied is the
 * difference, worked out once the picker closes, so a tag left alone is left alone on each task.
 */
export function openBulkTagPicker(ctx: TableContext, anchor: HTMLElement, apply: (change: TagChange) => void): void {
  const selected = [...ctx.state.selectedTaskIds]
    .map((id) => ctx.scope.taskById(id))
    .filter((task): task is Task => task !== null)
  const total = selected.length
  const usage = tagUsage(selected, collectAllTags(ctx.scope.tasks()))
  const before = {
    on: usage.filter((u) => u.count === total).map((u) => u.tag),
    mixed: usage.filter((u) => u.count > 0 && u.count < total).map((u) => u.tag)
  }
  const held = usage.filter((u) => u.count > 0).map((u) => u.tag)

  openOptionPicker({
    anchor,
    multiple: true,
    options: usage.map((u) => ({
      id: u.tag,
      label: u.tag,
      note: u.count > 0 && u.count < total ? `${u.count}/${total}` : undefined
    })),
    selected: before.on,
    mixed: before.mixed,
    searchPlaceholder: t('bulk.tagPlaceholder'),
    create: {
      label: (name) => t('property.create', { name }),
      normalize: (name) => name.trim().replace(/^#/, '')
    },
    clear: held.length ? { label: t('bulk.clearTags'), run: () => apply({ add: [], remove: held }) } : undefined,
    onCommit: (on, mixed) => {
      const change = diffTagChange(before, { on, mixed })
      if (change.add.length || change.remove.length) apply(change)
    }
  })
}
