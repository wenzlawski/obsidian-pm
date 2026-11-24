// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PRIORITIES, DEFAULT_STATUSES, makeTask } from '@dotpm/core'
import { KanbanCard } from './KanbanCard'
import { renderPriorityBadge, renderStatusBadge } from '../StatusBadge'

function noop(): void {}

describe('KanbanCard outside Obsidian', () => {
  it('renders the task with the plain DOM platform', () => {
    const host = document.body.createDiv()
    const onClick = vi.fn<() => void>()
    const card = new KanbanCard(host, {
      fields: ['priority', 'tags', 'due', 'cf:sprint'],
      people: [],
      task: makeTask({ id: 't1', title: 'Write the spec', due: '2030-01-01', tags: ['docs'] }),
      priorityColor: 'red',
      parentTitle: 'Launch',
      customValues: { 'cf:sprint': { name: 'Sprint', text: 'S1' } },
      loggedHours: 0,
      overdue: false,
      showTagColors: false,
      onClick,
      onContextMenu: noop,
      onDragStart: noop,
      onDragEnd: noop
    })
    expect(card.el.dataset.taskId).toBe('t1')
    expect(card.el.find('.pm-kanban-card-title')?.textContent).toBe('Write the spec')
    expect(card.el.find('.pm-kanban-card-parent')?.textContent).toBe('Launch')
    expect(card.el.find('.pm-kanban-card-priority-bar')).not.toBeNull()
    expect(card.el.find('.pm-kanban-card-field')?.textContent).toBe('SprintS1')
    card.el.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('leaves out the fields it is not given', () => {
    const host = document.body.createDiv()
    const card = new KanbanCard(host, {
      fields: [],
      people: [],
      task: makeTask({ title: 'Bare', due: '2030-01-01', tags: ['docs'], progress: 50 }),
      priorityColor: 'red',
      loggedHours: 0,
      overdue: false,
      showTagColors: false,
      onClick: noop,
      onContextMenu: noop,
      onDragStart: noop,
      onDragEnd: noop
    })
    expect(card.el.find('.pm-kanban-card-priority-bar')).toBeNull()
    expect(card.el.find('.pm-kanban-card-tags')).toBeNull()
    expect(card.el.find('.pm-kanban-card-footer')).toBeNull()
  })
})

describe('status badge outside Obsidian', () => {
  it('opens a picker of statuses and reports the pick', () => {
    const host = document.body.createDiv()
    const onChange = vi.fn<(status: string) => void>()
    const task = makeTask({ title: 'Pick me', status: DEFAULT_STATUSES[0].id })
    const badge = renderStatusBadge(host, task, DEFAULT_STATUSES, onChange)
    expect(badge.textContent).toContain(DEFAULT_STATUSES[0].label)

    badge.click()
    const items = document.body.findAll('.pm-pop .pm-pop-item')
    expect(items.map((item) => item.find('.pm-pop-item-label')?.textContent)).toEqual(
      DEFAULT_STATUSES.map((status) => status.label)
    )
    expect(items[0].find('.pm-pop-check--hidden')).toBeNull()
    expect(items[1].find('.pm-pop-check--hidden')).not.toBeNull()

    items[1].click()
    expect(onChange).toHaveBeenCalledWith(DEFAULT_STATUSES[1].id)
    expect(document.body.find('.pm-pop')).toBeNull()
  })

  it('closes the picker when the badge is clicked again, and keeps the status on the same pick', () => {
    const host = document.body.createDiv()
    const onChange = vi.fn<(status: string) => void>()
    const badge = renderStatusBadge(host, makeTask({ status: DEFAULT_STATUSES[0].id }), DEFAULT_STATUSES, onChange)
    badge.click()
    badge.click()
    expect(document.body.find('.pm-pop')).toBeNull()
    badge.click()
    document.body.findAll('.pm-pop .pm-pop-item')[0].click()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('picks a priority the same way, with the rows in the configured order', () => {
    const host = document.body.createDiv()
    const onChange = vi.fn<(priority: string) => void>()
    const task = makeTask({ priority: DEFAULT_PRIORITIES[0].id })
    const badge = renderPriorityBadge(host, task, DEFAULT_PRIORITIES, 'chevrons', onChange)

    badge.click()
    const items = document.body.findAll('.pm-pop .pm-pop-item')
    expect(items.map((item) => item.find('.pm-pop-item-label')?.textContent)).toEqual(
      DEFAULT_PRIORITIES.map((priority) => priority.label)
    )
    items[2].click()
    expect(onChange).toHaveBeenCalledExactlyOnceWith(DEFAULT_PRIORITIES[2].id)
  })
})
