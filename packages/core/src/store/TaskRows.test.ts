import { describe, expect, it } from 'vitest'
import { makeTask, type Task } from '../types'
import { arrangeTaskRows } from './TaskRows'
import { flattenTasks } from './TaskTreeOps'

function task(id: string, subtasks: Task[] = []): Task {
  return makeTask({ id, title: id.toUpperCase(), subtasks })
}

const byId = (a: Task, b: Task): number => a.id.localeCompare(b.id)

describe('arrangeTaskRows', () => {
  const tree = [task('a', [task('a1'), task('a2', [task('a21')])]), task('b')]

  it('nests every row under its parent when nothing is filtered', () => {
    const all = flattenTasks(tree)
    const rows = arrangeTaskRows(all, all, byId)
    expect(rows.map((r) => [r.task.id, r.depth])).toEqual([
      ['a', 0],
      ['a1', 1],
      ['a2', 1],
      ['a21', 2],
      ['b', 0]
    ])
    expect(rows.some((r) => r.detachedFrom)).toBe(false)
  })

  it('keeps a subtask under its parent when both are kept', () => {
    const all = flattenTasks(tree)
    const shown = all.filter((f) => ['a', 'a1'].includes(f.task.id))
    const rows = arrangeTaskRows(all, shown, byId)
    expect(rows.map((r) => [r.task.id, r.depth, r.guides])).toEqual([
      ['a', 0, []],
      ['a1', 1, [false]]
    ])
  })

  it('stands a subtask whose parent was filtered out at the top level, with no connectors', () => {
    const all = flattenTasks(tree)
    const shown = all.filter((f) => ['a1', 'a21'].includes(f.task.id))
    const rows = arrangeTaskRows(all, shown, byId)
    expect(rows.map((r) => [r.task.id, r.depth, r.guides])).toEqual([
      ['a1', 0, []],
      ['a21', 0, []]
    ])
    expect(rows.map((r) => r.detachedFrom?.id)).toEqual(['a', 'a2'])
    expect(rows.map((r) => r.parentId)).toEqual(['a', 'a2'])
  })

  it('names no parent for a task that has none', () => {
    const all = flattenTasks(tree)
    const rows = arrangeTaskRows(
      all,
      all.filter((f) => f.task.id === 'b'),
      byId
    )
    expect(rows[0].detachedFrom).toBeUndefined()
  })

  it('nests the children of a detached subtask under it', () => {
    const all = flattenTasks(tree)
    const shown = all.filter((f) => ['a2', 'a21'].includes(f.task.id))
    const rows = arrangeTaskRows(all, shown, byId)
    expect(rows.map((r) => [r.task.id, r.depth, r.detachedFrom?.id])).toEqual([
      ['a2', 0, 'a'],
      ['a21', 1, undefined]
    ])
  })
})
