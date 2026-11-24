import type { Task } from '../types'
import type { FlatTask } from './TaskTreeOps'

export interface TaskTreeRow extends FlatTask {
  /** One entry per indent column: does an ancestor at that column still have rows below it. */
  guides: boolean[]
  isLastChild: boolean
  /** The parent the filter left out. The row then stands at the top level instead of under it. */
  detachedFrom?: Task
}

/**
 * Lays out the tasks a filter kept as rows. A task under a parent that is also kept nests under
 * it; one whose parent was filtered out stands on its own at the top level, with no indent or
 * connectors pointing at a row that is not there, and names the parent it was cut from.
 * `depth` is the depth the row is drawn at, `parentId` stays the task's real parent.
 */
export function arrangeTaskRows(
  all: FlatTask[],
  shown: FlatTask[],
  compare: (a: Task, b: Task) => number
): TaskTreeRow[] {
  const shownIds = new Set(shown.map((f) => f.task.id))
  const byId = new Map(all.map((f) => [f.task.id, f.task]))

  const childrenByParent = new Map<string | null, FlatTask[]>()
  for (const f of shown) {
    const nested = f.parentId !== null && shownIds.has(f.parentId)
    const bucket = nested ? f.parentId : null
    const list = childrenByParent.get(bucket) ?? []
    list.push(f)
    childrenByParent.set(bucket, list)
  }
  for (const list of childrenByParent.values()) list.sort((a, b) => compare(a.task, b.task))

  const rows: TaskTreeRow[] = []
  const add = (parentId: string | null, trail: boolean[]): void => {
    const items = childrenByParent.get(parentId)
    if (!items) return
    items.forEach((item, i) => {
      const isLastChild = i === items.length - 1
      const row: TaskTreeRow = { ...item, depth: trail.length, guides: trail, isLastChild }
      const parent = parentId === null && item.parentId !== null ? byId.get(item.parentId) : undefined
      if (parent) row.detachedFrom = parent
      rows.push(row)
      add(item.task.id, childTreeGuides(trail, isLastChild))
    })
  }
  add(null, [])
  return rows
}

/**
 * The child's elbow claims a new column, and the column this row sits in keeps its line
 * only while more siblings follow it. A root row has no column of its own.
 */
export function childTreeGuides(guides: boolean[], isLastChild: boolean): boolean[] {
  if (!guides.length) return [false]
  return [...guides.slice(0, -1), !isLastChild, false]
}
