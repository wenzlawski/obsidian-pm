import {
  type Task,
  type TaskStatus,
  type TaskPriority,
  type StatusConfig,
  type PriorityConfig,
  type PriorityIconSet,
  getStatusConfig,
  getPriorityConfig,
  priorityIcon
} from '@dotpm/core'
import { formatBadgeText, isIconName } from './icons'
import { Chip } from './primitives/Chip'
import type { Popover } from './primitives/Popover'
import { openOptionPicker } from './composites/properties/OptionPicker'
import type { SelectItem } from './composites/properties/optionList'

/** Named icons only. Emoji and text render inline through formatBadgeText instead. */
function namedIcon(config: { icon: string } | undefined): string | null {
  return config?.icon && isIconName(config.icon) ? config.icon : null
}

/** Statuses as picker rows: each with its own color and icon. */
export function statusPickerItems(statuses: StatusConfig[]): SelectItem[] {
  return statuses.map((s) => ({ id: s.id, label: s.label, color: s.color, icon: s.icon || undefined }))
}

/** Priorities as picker rows, each with the icon the badge shows for it. */
export function priorityPickerItems(priorities: PriorityConfig[], iconSet: PriorityIconSet): SelectItem[] {
  return priorities.map((p) => ({
    id: p.id,
    label: p.label,
    color: p.color,
    icon: priorityIcon(priorities, p.id, iconSet) || undefined
  }))
}

/**
 * Makes a badge open a picker of `items` under it, so status and priority are chosen the
 * way a custom select is. Clicking the badge again closes the picker.
 */
function pickOnClick(badge: Chip, items: SelectItem[], current: string, onChange: (id: string) => void): void {
  let picker: Popover | null = null
  badge.onClick(() => {
    if (picker?.isOpen) {
      picker.close()
      return
    }
    picker = openOptionPicker({
      anchor: badge.el,
      options: items,
      selected: [current],
      onCommit: ([id]) => onChange(id)
    })
  })
}

export function renderStatusBadge(
  container: HTMLElement,
  task: Task,
  statuses: StatusConfig[],
  onChange: (status: TaskStatus) => void
): HTMLElement {
  const config = getStatusConfig(statuses, task.status)
  const badge = new Chip(container)
    .setLabel(formatBadgeText(config?.icon, config?.label ?? task.status))
    .setColor(config?.color ?? 'var(--text-muted)')
    .setVariant('solid')
    .setDot(!config?.icon)
  pickOnClick(badge, statusPickerItems(statuses), task.status, onChange)
  const icon = namedIcon(config)
  if (icon) badge.setLeadingIcon(icon)
  return badge.el
}

export function renderPriorityBadge(
  container: HTMLElement,
  task: Task,
  priorities: PriorityConfig[],
  iconSet: PriorityIconSet,
  onChange: (priority: TaskPriority) => void
): HTMLElement {
  const config = getPriorityConfig(priorities, task.priority)
  const badge = new Chip(container)
    .setLabel(formatBadgeText(config?.icon, config?.label ?? task.priority))
    .setColor(config?.color ?? 'var(--text-muted)')
    .setVariant('plain')
  const icon = priorityIcon(priorities, task.priority, iconSet)
  if (isIconName(icon)) badge.setLeadingIcon(icon)
  pickOnClick(badge, priorityPickerItems(priorities, iconSet), task.priority, onChange)
  return badge.el
}

export function renderStatusDot(
  container: HTMLElement,
  status: TaskStatus,
  statuses: StatusConfig[],
  cls = 'pm-subtask-dot'
): HTMLElement {
  const config = getStatusConfig(statuses, status)
  const dot = container.createSpan({ cls })
  dot.style.background = config?.color ?? 'var(--text-muted)'
  return dot
}
