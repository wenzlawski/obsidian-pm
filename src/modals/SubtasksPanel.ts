import {
  type StatusConfig,
  type Task,
  makeTask,
  isTerminalStatus,
  getCompleteStatusId,
  getDefaultStatusId,
  t
} from '@dotpm/core'
import { renderNoteLink, Checkbox, IconButton, makeReorderable, setIcon } from '@dotpm/ui'

/** The header count is how many subtasks sit in a terminal status. */
export function renderSubtasksPanel(
  container: HTMLElement,
  task: Task,
  statuses: StatusConfig[],
  openSubtask: (filePath: string) => void
): void {
  const subSection = container.createDiv('pm-modal-section')

  const subHeader = subSection.createDiv('pm-subtasks-header')
  const heading = subHeader.createEl('h4', { text: `${t('subtasks.heading')} `, cls: 'pm-modal-section-title' })
  const countEl = heading.createSpan({ cls: 'pm-subtasks-count' })

  const subList = subSection.createDiv('pm-modal-subtask-list')

  const renderCount = () => {
    const total = task.subtasks.length
    if (total === 0) {
      countEl.setText('')
      return
    }
    const done = task.subtasks.filter((s) => isTerminalStatus(s.status, statuses)).length
    countEl.setText(`${done}/${total}`)
  }

  const reorder = (ids: string[], focusId?: string) => {
    const byId = new Map(task.subtasks.map((s) => [s.id, s]))
    task.subtasks = ids.flatMap((id) => byId.get(id) ?? [])
    renderSubtasks()
    if (focusId)
      subList.querySelector<HTMLElement>(`[data-subtask-id="${CSS.escape(focusId)}"] .pm-subtask-grip`)?.focus()
  }

  const moveBy = (id: string, by: -1 | 1) => {
    const ids = task.subtasks.map((s) => s.id)
    const from = ids.indexOf(id)
    const to = from + by
    if (from < 0 || to < 0 || to >= ids.length) return
    ids.splice(from, 1)
    ids.splice(to, 0, id)
    reorder(ids, id)
  }

  const renderSubtasks = () => {
    subList.empty()
    const rows: { el: HTMLElement; id: string }[] = []
    for (const sub of task.subtasks) {
      const row = subList.createDiv('pm-modal-subtask-row')
      row.dataset.subtaskId = sub.id
      rows.push({ el: row, id: sub.id })

      const grip = row.createSpan({
        cls: 'pm-subtask-grip',
        attr: { role: 'button', tabindex: '0', 'aria-label': t('subtasks.reorder', { title: sub.title }) }
      })
      setIcon(grip, 'grip-vertical')
      grip.addEventListener('keydown', (e) => {
        if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
        e.preventDefault()
        e.stopPropagation()
        moveBy(sub.id, e.key === 'ArrowUp' ? -1 : 1)
      })

      const done = isTerminalStatus(sub.status, statuses)

      new Checkbox(row)
        .setChecked(done)
        .setAriaLabel(t('subtasks.done', { title: sub.title }))
        .onChange((checked) => {
          sub.status = checked ? getCompleteStatusId(statuses) : getDefaultStatusId(statuses)
          sub.progress = checked ? 100 : 0
          renderSubtasks()
          renderCount()
        })

      // A subtask typed into the add field below has no note yet, so there is nothing to
      // open until the editor saves.
      const cls = done ? 'pm-subtask-title pm-subtask-title--done' : 'pm-subtask-title'
      const filePath = sub.filePath
      if (filePath) {
        renderNoteLink(row, { label: sub.title, path: filePath, open: () => openSubtask(filePath), cls })
      } else {
        row.createSpan({ text: sub.title, cls })
      }

      new IconButton(row)
        .setIcon('x')
        .setTooltip(t('subtasks.remove'))
        .setRevealOnHover(true)
        .onClick(() => {
          task.subtasks = task.subtasks.filter((s) => s.id !== sub.id)
          renderSubtasks()
          renderCount()
        })
    }
    makeReorderable(rows, (ids) => reorder(ids))
  }

  renderSubtasks()
  renderCount()

  const addRow = subSection.createDiv('pm-modal-subtask-row pm-subtask-add-row')
  addRow.createSpan({ cls: 'pm-subtask-grip', attr: { 'aria-hidden': 'true' } })
  addRow.createSpan({ cls: 'pm-subtask-checkbox-ghost', attr: { 'aria-hidden': 'true' } })
  const addInput = addRow.createEl('input', {
    cls: 'pm-subtask-add-input',
    attr: { placeholder: t('subtasks.addPlaceholder') }
  })
  addInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    const title = addInput.value.trim()
    if (!title) return
    task.subtasks.push(makeTask({ title, type: 'subtask' }))
    addInput.value = ''
    renderSubtasks()
    renderCount()
  })
}
