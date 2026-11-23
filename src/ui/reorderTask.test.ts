import { describe, expect, it } from 'vitest'
import { makeProject, makeTask, moveTaskInTree, rebuildTaskIndex, type Project } from '@dotpm/core'
import type PMPlugin from '#main'
import { canReorderBetween, reorderTask } from './reorderTask'

function setup() {
  const project = makeProject('Roadmap', 'Projects/Roadmap.md')
  project.tasks = [
    makeTask({
      id: 'a',
      title: 'a',
      subtasks: [makeTask({ id: 'a1' }), makeTask({ id: 'a2' }), makeTask({ id: 'a3' })]
    }),
    makeTask({ id: 'b' }),
    makeTask({ id: 'c' })
  ]
  rebuildTaskIndex(project)
  const undo: { undo: () => Promise<void>; redo: () => Promise<void> }[] = []
  const plugin = {
    store: {
      reorderTask: async (p: Project, id: string, target: string, position: 'before' | 'after') => {
        moveTaskInTree(p.tasks, id, target, position)
      }
    },
    pushUndo: (entry: (typeof undo)[number]) => undo.push(entry)
  } as unknown as PMPlugin
  const order = (list = project.tasks) => list.map((task) => task.id)
  return { project, plugin, undo, order }
}

describe('reorderTask', () => {
  it('puts a task before or after a sibling', async () => {
    const { project, plugin, order } = setup()
    expect(await reorderTask(plugin, project, 'c', 'a', 'before')).toBe(true)
    expect(order()).toEqual(['c', 'a', 'b'])
    expect(await reorderTask(plugin, project, 'c', 'b', 'after')).toBe(true)
    expect(order()).toEqual(['a', 'b', 'c'])
  })

  it('reorders subtasks within their parent', async () => {
    const { project, plugin, order } = setup()
    await reorderTask(plugin, project, 'a3', 'a1', 'before')
    expect(order(project.tasks[0].subtasks)).toEqual(['a3', 'a1', 'a2'])
  })

  it('refuses a target that is not a sibling', async () => {
    const { project, plugin, undo, order } = setup()
    expect(canReorderBetween(project, 'a1', 'b')).toBe(false)
    expect(await reorderTask(plugin, project, 'a1', 'b', 'after')).toBe(false)
    expect(await reorderTask(plugin, project, 'a', 'a', 'after')).toBe(false)
    expect(order()).toEqual(['a', 'b', 'c'])
    expect(undo).toHaveLength(0)
  })

  it('does not record a move that changes nothing', async () => {
    const { project, plugin, undo } = setup()
    expect(await reorderTask(plugin, project, 'a', 'b', 'before')).toBe(false)
    expect(undo).toHaveLength(0)
  })

  it('undoes and redoes the move, also for the last task of a list', async () => {
    const { project, plugin, undo, order } = setup()
    await reorderTask(plugin, project, 'c', 'a', 'before')
    await reorderTask(plugin, project, 'a', 'c', 'before')
    expect(order()).toEqual(['a', 'c', 'b'])
    await undo[1].undo()
    expect(order()).toEqual(['c', 'a', 'b'])
    await undo[0].undo()
    expect(order()).toEqual(['a', 'b', 'c'])
    await undo[0].redo()
    expect(order()).toEqual(['c', 'a', 'b'])
  })
})
