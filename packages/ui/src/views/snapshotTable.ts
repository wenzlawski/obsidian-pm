import {
  type CustomFieldDef,
  type TaskTreeRow,
  arrangeTaskRows,
  applyTaskFilterFlat,
  dueUrgency,
  effectiveCustomValue,
  flattenTasks,
  formatDateLong,
  getStatusConfig,
  inheritedShare,
  isCompact,
  isTerminalStatus,
  columnWidth,
  shownFields,
  stringifyCustomValue,
  totalLoggedHours,
  viewFieldLabel
} from '@dotpm/core'
import { TaskRow } from '../composites/TaskRow'
import { AssigneesCell } from '../composites/cells/AssigneesCell'
import { choiceFieldValue, CustomFieldCell, type CustomFieldValue } from '../composites/cells/CustomFieldCell'
import { DueDateCell } from '../composites/cells/DueDateCell'
import { ExpandCell } from '../composites/cells/ExpandCell'
import { PriorityCell } from '../composites/cells/PriorityCell'
import { ProgressCell } from '../composites/cells/ProgressCell'
import { ProjectCell } from '../composites/cells/ProjectCell'
import { StatusCell } from '../composites/cells/StatusCell'
import { TimeCell } from '../composites/cells/TimeCell'
import { TitleCell } from '../composites/cells/TitleCell'
import {
  allTasks,
  configOf,
  customFieldColumns,
  fieldCatalogOf,
  filterContextOf,
  mergedConfig,
  personOf,
  projectOf,
  queryOf,
  type ViewModel
} from './model'
import { compareTasks } from './tableSort'

const noop = (): void => {}
const noSave = async (): Promise<void> => {}

/** Filtered, sorted, tree-ordered rows. */
export function tableRows(model: ViewModel): TaskTreeRow[] {
  const config = mergedConfig(model)
  const all = flattenTasks(allTasks(model))
  const shown = applyTaskFilterFlat(all, queryOf(model), filterContextOf(model))
  return arrangeTaskRows(all, shown, (a, b) => compareTasks(a, b, model.sort, config.statuses, config.priorities))
}

function customFieldValue(model: ViewModel, cf: CustomFieldDef, val: unknown): CustomFieldValue {
  const values = (Array.isArray(val) ? val : [val]).map(stringifyCustomValue).filter(Boolean)
  const choice = choiceFieldValue(cf, values)
  if (choice) return choice
  if (cf.type === 'person') return { kind: 'people', people: values.map((raw) => personOf(model, raw)) }
  if (cf.type === 'checkbox') return { kind: 'checkbox', checked: Boolean(val) }
  if (cf.type === 'url') return { kind: 'url', url: values.join(', ') }
  if (cf.type === 'date') return { kind: 'text', text: values.map((v) => formatDateLong(v) || v).join(', ') }
  return { kind: 'text', text: val !== undefined ? stringifyCustomValue(val) : '' }
}

/** The table view without any way to change it: no selection, no editing, no actions. */
export function renderSnapshotTable(container: HTMLElement, model: ViewModel): HTMLElement {
  const config = mergedConfig(model)
  const customFields = customFieldColumns(model)
  const columns = shownFields(model.fields, 'table', fieldCatalogOf(model))

  const wrapper = container.createDiv('pm-table-wrapper')
  wrapper.setAttr('data-borders', model.settings.lineBorders)
  if (isCompact(model.fields, 'table')) wrapper.addClass('pm-table-wrapper--compact')
  const table = wrapper.createEl('table', { cls: 'pm-table' })
  const hrow = table.createEl('thead').createEl('tr')

  hrow.createEl('th').setCssStyles({ width: '32px' })
  for (const id of columns) {
    const th = hrow.createEl('th', { text: viewFieldLabel(id, customFields) })
    const width = columnWidth(model.fields, id)
    const titleMin = id === 'title' ? model.fields.table?.widths?.title : undefined
    if (width !== undefined) th.setCssStyles({ width: `${width}px`, minWidth: `${width}px` })
    else th.setCssStyles({ width: 'auto', minWidth: titleMin === undefined ? '' : `${titleMin}px` })
    const rank = model.sort.findIndex((rule) => rule.key === id)
    if (rank >= 0) {
      const indicator = th.createSpan({
        text: model.sort[rank].dir === 'asc' ? ' \u2191' : ' \u2193',
        cls: 'pm-sort-indicator'
      })
      if (model.sort.length > 1) indicator.createEl('sup', { text: String(rank + 1) })
    }
  }

  const tbody = table.createEl('tbody')
  for (const flat of tableRows(model)) {
    const { task, depth } = flat
    const owner = projectOf(model, task.id)
    const ownConfig = configOf(model, task.id)
    const isDone = isTerminalStatus(task.status, ownConfig.statuses)
    const statusConfig = getStatusConfig(config.statuses, task.status)

    const { el: row } = new TaskRow(tbody, {
      taskId: task.id,
      depth,
      isDone,
      isArchived: task.archived === true,
      isSelected: false,
      onRowClick: noop
    })
    new ExpandCell(row, { hasSubtasks: task.subtasks.length > 0, collapsed: false, onToggle: noop })
    for (const id of columns) {
      switch (id) {
        case 'title':
          new TitleCell(row, {
            task,
            treeGuides: model.settings.showSubtreeConnections ? flat.guides : null,
            isLastChild: flat.isLastChild,
            detachedFrom: flat.detachedFrom,
            showTagColors: model.settings.showTagColors,
            onTitleClick: noop,
            onTitleSave: noSave,
            onAddSubtask: noop
          })
          break
        case 'project':
          new ProjectCell(row, { title: owner?.title ?? '', color: owner?.color ?? '', onClick: noop })
          break
        case 'status':
          new StatusCell(row, { task, statuses: config.statuses, onChange: noop })
          break
        case 'priority':
          new PriorityCell(row, {
            task,
            priorities: config.priorities,
            priorityIcons: model.settings.priorityIcons,
            onChange: noop
          })
          break
        case 'assignees':
          new AssigneesCell(
            row,
            task.assignees.map((raw) => personOf(model, raw))
          )
          break
        case 'due':
          new DueDateCell(row, { task, urgency: dueUrgency(task, ownConfig.statuses), onSave: noSave })
          break
        case 'progress':
          new ProgressCell(row, {
            value: task.progress,
            color: statusConfig?.color ?? 'var(--interactive-accent)',
            onSave: noSave
          })
          break
        case 'time':
          new TimeCell(row, { logged: totalLoggedHours(task), estimate: task.timeEstimate ?? 0 })
          break
        default: {
          const cf = customFields.find((field) => `cf:${field.id}` === id)
          new CustomFieldCell(
            row,
            cf ? customFieldValue(model, cf, effectiveCustomValue(task, cf.id)) : { kind: 'text', text: '' },
            cf ? inheritedShare(task, cf.id) : 'none'
          )
        }
      }
    }
  }
  return wrapper
}

export function visibleTaskCount(model: ViewModel): number {
  return tableRows(model).length
}
