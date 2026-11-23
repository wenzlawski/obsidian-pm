import type PMPlugin from '#main'
import { findParentId, findTaskById, type Project, type Task } from '@dotpm/core'

/** The list a task sits in, which is its parent's subtasks, or the project's own tasks at the top. */
function siblingsOf(project: Project, taskId: string): Task[] | null {
  const parentId = findParentId(project, taskId)
  const list = parentId ? findTaskById(project, parentId)?.subtasks : project.tasks
  return list?.some((task) => task.id === taskId) ? list : null
}

/** Whether `targetId` is a sibling of `taskId`, the only place a task can be put by reordering. */
export function canReorderBetween(project: Project, taskId: string, targetId: string): boolean {
  const list = siblingsOf(project, taskId)
  return taskId !== targetId && !!list?.some((task) => task.id === targetId)
}

/**
 * Puts a task before or after one of its siblings and records the move on the undo stack.
 * False when the target is not a sibling or the order does not change.
 */
export async function reorderTask(
  plugin: PMPlugin,
  project: Project,
  taskId: string,
  targetId: string,
  position: 'before' | 'after'
): Promise<boolean> {
  if (!canReorderBetween(project, taskId, targetId)) return false
  const before = (siblingsOf(project, taskId) ?? []).map((task) => task.id)
  const index = before.indexOf(taskId)
  // Undoing puts the task back beside whichever sibling follows it, or precedes it when it was last.
  const back =
    index + 1 < before.length
      ? { id: before[index + 1], position: 'before' as const }
      : { id: before[index - 1], position: 'after' as const }

  await plugin.store.reorderTask(project, taskId, targetId, position)

  const after = (siblingsOf(project, taskId) ?? []).map((task) => task.id)
  if (after.every((id, i) => id === before[i])) return false
  plugin.pushUndo({
    undo: () => plugin.store.reorderTask(project, taskId, back.id, back.position),
    redo: () => plugin.store.reorderTask(project, taskId, targetId, position)
  })
  return true
}
