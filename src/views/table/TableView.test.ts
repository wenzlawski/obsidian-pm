// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskQuery } from '@dotpm/core'
import type { BulkAction } from './BulkActionBar'
import { TableView } from './TableView'

const { confirmDialog } = vi.hoisted(() => ({ confirmDialog: vi.fn<() => Promise<boolean>>() }))
vi.mock('#ui/ModalFactory', () => ({ confirmDialog }))
vi.mock('#modals/PickerModals', () => ({ TaskPickerModal: vi.fn() }))

const PROJECT = { id: 'p', filePath: 'p.md' }
const IDS = ['a', 'b', 'c']

function setup(selected = IDS) {
  const updateTasks = vi.fn<() => Promise<void>>().mockResolvedValue()
  const deleteTasks = vi.fn<() => Promise<void>>().mockResolvedValue()
  const archiveTask = vi.fn<() => Promise<void>>().mockResolvedValue()
  const moveTasks = vi.fn<() => Promise<void>>().mockResolvedValue()
  const scheduleAfterChange = vi.fn<() => Promise<void>>().mockResolvedValue()
  const onRefresh = vi.fn<() => Promise<void>>().mockResolvedValue()
  const scope = {
    groupByProject: (ids: string[]) => [{ project: PROJECT, taskIds: ids }]
  }
  const plugin = {
    store: {
      updateTasks,
      deleteTasks,
      archiveTask,
      moveTasks,
      scheduleAfterChange,
      configFor: () => ({ customFields: [{ id: 'client', name: 'Client', type: 'text' }] })
    }
  }
  const view = new TableView(
    document.body.createDiv(),
    scope as never,
    plugin as never,
    onRefresh,
    {} as TaskQuery,
    [],
    vi.fn<() => void>(),
    {} as never,
    vi.fn<() => void>()
  )
  view.selection().set(new Set(selected))
  return { view, onRefresh, deleteTasks, updateTasks }
}

const selected = (view: TableView): string[] => [...view.selection().ids()]

beforeEach(() => {
  confirmDialog.mockReset()
  confirmDialog.mockResolvedValue(true)
})

describe('TableView bulk actions', () => {
  const keepers: [string, BulkAction][] = [
    ['set-status', { type: 'set-status', status: 'done' }],
    ['set-priority', { type: 'set-priority', priority: 'high' }],
    ['set-assignee', { type: 'set-assignee', assignee: 'Ada' }],
    ['edit-tags', { type: 'edit-tags', change: { add: ['x'], remove: [] } }],
    ['set-custom', { type: 'set-custom', fieldId: 'client', change: { mode: 'set', value: 'Acme' } }],
    ['set-due-date', { type: 'set-due-date', due: '2030-01-01' }],
    ['set-progress', { type: 'set-progress', progress: 50 }],
    ['set-parent', { type: 'set-parent', parentId: 'z' }],
    ['remove-parent', { type: 'remove-parent' }],
    ['archive', { type: 'archive' }]
  ]

  it.each(keepers)('keeps the same tasks selected after %s, so the next action can follow', async (_name, action) => {
    const { view, onRefresh } = setup()
    await view.handleBulkAction(action)
    expect(selected(view)).toEqual(IDS)
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('allows one action after another on the same set', async () => {
    const { view, updateTasks } = setup()
    await view.handleBulkAction({ type: 'set-status', status: 'done' })
    await view.handleBulkAction({ type: 'set-priority', priority: 'high' })
    await view.handleBulkAction({ type: 'edit-tags', change: { add: ['x'], remove: [] } })
    expect(updateTasks).toHaveBeenCalledTimes(3)
    expect(selected(view)).toEqual(IDS)
  })

  it('applies each action to every task still selected', async () => {
    const { view, updateTasks } = setup(['a', 'b'])
    await view.handleBulkAction({ type: 'set-status', status: 'done' })
    expect(updateTasks).toHaveBeenCalledWith(PROJECT, ['a', 'b'], { status: 'done' })
  })

  it('clears the selection once the tasks are deleted, since they are gone', async () => {
    const { view, deleteTasks } = setup()
    await view.handleBulkAction({ type: 'delete' })
    expect(deleteTasks).toHaveBeenCalledOnce()
    expect(selected(view)).toEqual([])
  })

  it('keeps the selection when a delete is not confirmed', async () => {
    confirmDialog.mockResolvedValue(false)
    const { view, deleteTasks } = setup()
    await view.handleBulkAction({ type: 'delete' })
    expect(deleteTasks).not.toHaveBeenCalled()
    expect(selected(view)).toEqual(IDS)
  })

  it('keeps the selection when an action fails, so it can be tried again', async () => {
    const { view, updateTasks, onRefresh } = setup()
    updateTasks.mockRejectedValue(new Error('disk full'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await view.handleBulkAction({ type: 'set-status', status: 'done' })
    expect(selected(view)).toEqual(IDS)
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('does nothing without a selection', async () => {
    const { view, updateTasks, onRefresh } = setup([])
    await view.handleBulkAction({ type: 'set-status', status: 'done' })
    expect(updateTasks).not.toHaveBeenCalled()
    expect(onRefresh).not.toHaveBeenCalled()
  })
})
