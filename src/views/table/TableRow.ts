import { Menu, Notice, type App } from 'obsidian'
import {
  t,
  getStatusConfig,
  customFieldPatch,
  dueUrgency,
  effectiveCustomValue,
  formatDateLong,
  inheritedShare,
  isTerminalStatus,
  stringifyCustomValue,
  type CustomFieldDef,
  type Project,
  totalLoggedHours
} from '@dotpm/core'
import {
  safeAsync,
  TaskRow,
  ActionsCell,
  AssigneesCell,
  choiceFieldValue,
  type ChoiceEdit,
  CustomFieldCell,
  type CustomFieldValue,
  DueDateCell,
  ExpandCell,
  PriorityCell,
  ProjectCell,
  ProgressCell,
  SelectCell,
  StatusCell,
  TimeCell,
  TitleCell
} from '@dotpm/ui'
import { updateSelectCheckboxes, getVisibleTaskIds } from './TableRenderer'
import type { TableContext, TableState, TableTreeRow } from './TableRenderer'
import { openTaskModal } from '#ui/ModalFactory'
import { buildTaskContextMenu } from '#ui/TaskContextMenu'
import { reorderTask } from '#ui/reorderTask'
import { toggleCollapsed } from '../collapse'
import { linkedRefs } from '../linkedRefs'

export function renderTaskRow(tbody: HTMLElement, flat: TableTreeRow, ctx: TableContext): void {
  const { task, depth } = flat
  // One row belongs to one project, so ownership is resolved here and used throughout.
  const project = ctx.scope.projectOf(task.id)
  if (!project) return
  const isDone = isTerminalStatus(task.status, ctx.scope.configOf(task.id).statuses)
  const statusConfig = getStatusConfig(ctx.statuses, task.status)

  const { el: row } = new TaskRow(tbody, {
    taskId: task.id,
    depth,
    isDone,
    isArchived: !!task.archived,
    isSelected: ctx.state.selectedTaskId === task.id,
    onRowClick: () => {
      ctx.state.selectedTaskId = task.id
      updateSelectedRow(ctx.state)
    }
  })

  wireRowReorder(row, flat, project, ctx)

  new SelectCell(row, {
    checked: ctx.state.selectedTaskIds.has(task.id),
    onClick: (e) => {
      const cb = e.target as HTMLInputElement
      const checked = cb.checked
      if (e.shiftKey && ctx.state.lastCheckedTaskId) {
        const ids = getVisibleTaskIds(ctx.state)
        const curIdx = ids.indexOf(task.id)
        const lastIdx = ids.indexOf(ctx.state.lastCheckedTaskId)
        if (curIdx !== -1 && lastIdx !== -1) {
          const [from, to] = curIdx < lastIdx ? [curIdx, lastIdx] : [lastIdx, curIdx]
          for (let i = from; i <= to; i++) {
            if (checked) ctx.state.selectedTaskIds.add(ids[i])
            else ctx.state.selectedTaskIds.delete(ids[i])
          }
          updateSelectCheckboxes(ctx.state)
        }
      } else if (checked) {
        ctx.state.selectedTaskIds.add(task.id)
      } else {
        ctx.state.selectedTaskIds.delete(task.id)
      }
      ctx.state.lastCheckedTaskId = task.id
      ctx.onSelectionChange()
    }
  })

  new ExpandCell(row, {
    hasSubtasks: task.subtasks.length > 0,
    collapsed: ctx.collapsedIds.has(task.id),
    onToggle: safeAsync(async () => {
      toggleCollapsed(ctx.plugin.settings, project, task.id)
      await ctx.plugin.saveSettings()
      await ctx.onRefresh()
    })
  })

  const customFields = ctx.scope.customFields()
  for (const column of ctx.columns) {
    switch (column) {
      case 'title':
        renderTitleCell(row, flat, project, ctx)
        break
      case 'project':
        new ProjectCell(row, {
          title: project.title,
          color: project.color,
          onClick: safeAsync(() => ctx.plugin.router.openProjectLink(project.filePath))
        })
        break
      case 'status':
        new StatusCell(row, {
          task,
          statuses: ctx.statuses,
          onChange: safeAsync(async (status) => {
            await ctx.plugin.store.updateTask(project, task.id, { status })
            await ctx.onRefresh()
          })
        })
        break
      case 'priority':
        new PriorityCell(row, {
          task,
          priorities: ctx.priorities,
          priorityIcons: ctx.priorityIcons,
          onChange: safeAsync(async (priority) => {
            await ctx.plugin.store.updateTask(project, task.id, { priority })
            await ctx.onRefresh()
          })
        })
        break
      case 'assignees':
        new AssigneesCell(row, linkedRefs(ctx.plugin.app, task.assignees, task.filePath ?? project.filePath))
        break
      case 'due':
        new DueDateCell(row, {
          task,
          urgency: dueUrgency(task, ctx.statuses),
          onSave: async (val) => {
            await ctx.plugin.store.updateTask(project, task.id, { due: val })
            await ctx.plugin.store.scheduleAfterChange(project, task.id)
            await ctx.onRefresh()
          }
        })
        break
      case 'progress':
        new ProgressCell(row, {
          value: task.progress,
          color: statusConfig?.color ?? 'var(--interactive-accent)',
          onSave: async (progress) => {
            await ctx.plugin.store.updateTask(project, task.id, { progress })
            await ctx.onRefresh()
          }
        })
        break
      case 'time':
        new TimeCell(row, { logged: totalLoggedHours(task), estimate: task.timeEstimate ?? 0 })
        break
      default: {
        const shown = customFields.find((field) => `cf:${field.id}` === column)
        // A view over several projects shows the union of their fields, but a value is
        // only edited against the definition of the project it belongs to.
        const own = shown && ctx.scope.configOf(task.id).customFields.find((field) => field.id === shown.id)
        const source = task.filePath ?? project.filePath
        const cf = own ?? shown
        // The picker edits what the task holds itself; a value an ancestor contributes is
        // shown but never written to the task.
        const edit: ChoiceEdit | undefined = own && {
          own: stringValues(task.customFields[own.id]),
          save: safeAsync(async (value: unknown) => {
            await ctx.plugin.store.updateTask(project, task.id, customFieldPatch(task, own.id, value))
            await ctx.onRefresh()
          })
        }
        new CustomFieldCell(
          row,
          cf ? customFieldValue(ctx.plugin.app, cf, effectiveCustomValue(task, cf.id), source, edit) : EMPTY,
          cf ? inheritedShare(task, cf.id) : 'none'
        )
      }
    }
  }

  new ActionsCell(row, {
    onClick: (e) => {
      const menu = new Menu()
      buildTaskContextMenu(menu, task, { plugin: ctx.plugin, project, onRefresh: ctx.onRefresh })
      menu.showAtMouseEvent(e)
    }
  })
}

const DROP_CLASSES = ['pm-table-row--drop-before', 'pm-table-row--drop-after'] as const

/**
 * Drag a row onto one of its siblings to put it there: above the sibling when dropped on its
 * upper half, below when on its lower. A row can only be placed among its own siblings, so
 * anywhere else it is dropped is refused.
 */
function wireRowReorder(row: HTMLElement, flat: TableTreeRow, project: Project, ctx: TableContext): void {
  const { task } = flat
  const { state } = ctx
  const clear = () => row.removeClass(...DROP_CLASSES)
  const accepts = () =>
    state.dragged !== null &&
    state.dragged.id !== task.id &&
    state.dragged.project === project &&
    state.dragged.parentId === flat.parentId

  row.draggable = true
  row.addEventListener('dragstart', (e) => {
    state.dragged = { id: task.id, parentId: flat.parentId, project }
    e.dataTransfer?.setData('text/plain', task.id)
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
    row.addClass('pm-table-row--dragging')
  })
  row.addEventListener('dragend', () => {
    state.dragged = null
    row.removeClass('pm-table-row--dragging')
    state.tableBody?.querySelectorAll('.' + DROP_CLASSES.join(', .')).forEach((el) => el.removeClass(...DROP_CLASSES))
  })
  row.addEventListener('dragover', (e) => {
    if (!accepts()) return
    e.preventDefault()
    const rect = row.getBoundingClientRect()
    clear()
    row.addClass(e.clientY < rect.top + rect.height / 2 ? DROP_CLASSES[0] : DROP_CLASSES[1])
  })
  row.addEventListener('dragleave', (e) => {
    if (!row.contains(e.relatedTarget as Node | null)) clear()
  })
  row.addEventListener(
    'drop',
    safeAsync(async (e: DragEvent) => {
      if (!accepts() || !state.dragged) return
      e.preventDefault()
      const position = row.hasClass(DROP_CLASSES[0]) ? 'before' : 'after'
      const { id } = state.dragged
      clear()
      state.dragged = null
      if (state.sort.length > 0) {
        new Notice(t('table.reorderNeedsNoSort'))
        return
      }
      if (await reorderTask(ctx.plugin, project, id, task.id, position)) await ctx.onRefresh()
    })
  )
}

function renderTitleCell(row: HTMLElement, flat: TableTreeRow, project: Project, ctx: TableContext): void {
  const { task } = flat
  new TitleCell(row, {
    task,
    treeGuides: ctx.showSubtreeConnections ? flat.guides : null,
    isLastChild: flat.isLastChild,
    showTagColors: ctx.plugin.settings.showTagColors,
    onTitleClick: () => {
      openTaskModal(ctx.plugin, project, {
        task,
        onSave: async () => {
          await ctx.onRefresh()
        }
      })
    },
    onTitleSave: async (title) => {
      await ctx.plugin.store.updateTask(project, task.id, { title })
      await ctx.onRefresh()
    },
    onAddSubtask: () => {
      openTaskModal(ctx.plugin, project, {
        parentId: task.id,
        onSave: async () => {
          await ctx.onRefresh()
        }
      })
    }
  })
}

const EMPTY: CustomFieldValue = { kind: 'text', text: '' }

const WIKILINK = /^\[\[.+\]\]$/

function stringValues(val: unknown): string[] {
  return (Array.isArray(val) ? val : [val]).map(stringifyCustomValue).filter(Boolean)
}

/**
 * A person is shown as the avatars assignees get; any other value naming a note, as that note.
 * `edit` is given where the field can be changed in the cell.
 */
function customFieldValue(
  app: App,
  cf: CustomFieldDef,
  val: unknown,
  sourcePath: string,
  edit?: ChoiceEdit
): CustomFieldValue {
  const values = stringValues(val)
  const choice = choiceFieldValue(cf, values, edit)
  if (choice) return choice
  if (cf.type === 'person') return { kind: 'people', people: linkedRefs(app, values, sourcePath) }
  if (cf.type === 'checkbox') return { kind: 'checkbox', checked: Boolean(val) }
  if (cf.type === 'url') return { kind: 'url', url: values.join(', ') }
  if (cf.type === 'date') return { kind: 'text', text: values.map((v) => formatDateLong(v) || v).join(', ') }
  if (values.some((v) => WIKILINK.test(v.trim()))) {
    return { kind: 'links', links: linkedRefs(app, values, sourcePath) }
  }
  return { kind: 'text', text: val !== undefined ? stringifyCustomValue(val) : '' }
}

export function updateSelectAllCheckbox(state: TableState): void {
  if (!state.tableBody) return
  const wrapper = state.tableBody.closest('.pm-table-wrapper')
  if (!wrapper) return
  const selectAllCb = wrapper.querySelector<HTMLInputElement>('.pm-select-all-checkbox')
  if (!selectAllCb) return
  const ids = getVisibleTaskIds(state)
  if (ids.length === 0) {
    selectAllCb.checked = false
    selectAllCb.indeterminate = false
  } else if (ids.every((id) => state.selectedTaskIds.has(id))) {
    selectAllCb.checked = true
    selectAllCb.indeterminate = false
  } else if (ids.some((id) => state.selectedTaskIds.has(id))) {
    selectAllCb.checked = false
    selectAllCb.indeterminate = true
  } else {
    selectAllCb.checked = false
    selectAllCb.indeterminate = false
  }
}

export function updateSelectedRow(state: TableState): void {
  if (!state.tableBody) return
  state.tableBody.querySelectorAll('.pm-table-row--selected').forEach((r) => r.removeClass('pm-table-row--selected'))
  if (!state.selectedTaskId) return

  let row = state.tableBody.querySelector(`tr[data-task-id="${state.selectedTaskId}"]`)
  if (!row && state.wrapper && state.renderWindow) {
    // Row is outside the virtual window: scroll it into range and re-render.
    const idx = state.visibleRows.findIndex((f) => f.task.id === state.selectedTaskId)
    if (idx === -1) return
    const thead = state.wrapper.querySelector('thead')
    const headerHeight = thead instanceof HTMLElement ? thead.offsetHeight : 0
    state.wrapper.scrollTop = Math.max(0, idx * state.rowHeight + headerHeight - state.wrapper.clientHeight / 2)
    state.renderWindow()
    row = state.tableBody.querySelector(`tr[data-task-id="${state.selectedTaskId}"]`)
  }
  if (row) {
    row.addClass('pm-table-row--selected')
    ;(row as HTMLElement).scrollIntoView({ block: 'nearest' })
  }
}
