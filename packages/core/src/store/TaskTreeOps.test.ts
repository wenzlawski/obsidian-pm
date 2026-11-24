import { describe, expect, it } from 'vitest'
import { makeTask, type Task } from '../types'
import {
  addTaskToTree,
  applyTagChange,
  diffTagChange,
  tagUsage,
  collectAllAssignees,
  collectAllTags,
  deleteTaskFromTree,
  filterArchived,
  findTask,
  flattenTasks,
  moveTaskInTree,
  totalLoggedHours,
  updateTaskInTree
} from './TaskTreeOps'

function task(overrides: Partial<Task> & { id: string }): Task {
  return makeTask(overrides)
}

describe('flattenTasks', () => {
  it('flattens a single-level list with depth 0', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'b' })]
    const flat = flattenTasks(tasks)
    expect(flat).toHaveLength(2)
    expect(flat[0]).toMatchObject({ depth: 0, parentId: null, visible: true })
    expect(flat[1]).toMatchObject({ depth: 0, parentId: null, visible: true })
  })

  it('assigns depth and parentId to subtasks', () => {
    const tasks = [task({ id: 'a', subtasks: [task({ id: 'a1' })] })]
    const flat = flattenTasks(tasks)
    expect(flat[1]).toMatchObject({ depth: 1, parentId: 'a', visible: true })
  })

  it('marks descendants of a collapsed parent as invisible', () => {
    const tasks = [task({ id: 'a', subtasks: [task({ id: 'a1' })] })]
    const flat = flattenTasks(tasks, new Set(['a']))
    expect(flat[0].visible).toBe(true)
    expect(flat[1].visible).toBe(false)
  })

  it('keeps every row visible when no ids are collapsed', () => {
    const tasks = [task({ id: 'a', subtasks: [task({ id: 'a1' })] })]
    expect(flattenTasks(tasks).every((f) => f.visible)).toBe(true)
  })

  it('propagates invisibility through multiple levels', () => {
    const grandchild = task({ id: 'a1x' })
    const child = task({ id: 'a1', subtasks: [grandchild] })
    const root = task({ id: 'a', subtasks: [child] })
    const flat = flattenTasks([root], new Set(['a']))
    expect(flat.find((f) => f.task.id === 'a1x')?.visible).toBe(false)
  })
})

describe('findTask', () => {
  it('finds a top-level task', () => {
    const target = task({ id: 'b' })
    expect(findTask([task({ id: 'a' }), target], 'b')).toBe(target)
  })

  it('finds a nested task', () => {
    const target = task({ id: 'deep' })
    const tasks = [task({ id: 'a', subtasks: [task({ id: 'a1', subtasks: [target] })] })]
    expect(findTask(tasks, 'deep')).toBe(target)
  })

  it('returns null when the id is not found', () => {
    expect(findTask([task({ id: 'a' })], 'missing')).toBeNull()
  })
})

describe('updateTaskInTree', () => {
  it('updates a top-level task and bumps updatedAt', () => {
    const t = task({ id: 'a', title: 'Old', updatedAt: '2020-01-01T00:00:00.000Z' })
    const tasks = [t]
    expect(updateTaskInTree(tasks, 'a', { title: 'New' })).toBe(true)
    expect(t.title).toBe('New')
    expect(t.updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
  })

  it('updates a nested task', () => {
    const child = task({ id: 'c', title: 'Old' })
    const tasks = [task({ id: 'a', subtasks: [child] })]
    expect(updateTaskInTree(tasks, 'c', { title: 'New' })).toBe(true)
    expect(child.title).toBe('New')
  })

  it('returns false when the id is not found', () => {
    expect(updateTaskInTree([task({ id: 'a' })], 'missing', { title: 'x' })).toBe(false)
  })
})

describe('deleteTaskFromTree', () => {
  it('removes a top-level task', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'b' })]
    expect(deleteTaskFromTree(tasks, 'a')).toBe(true)
    expect(tasks.map((t) => t.id)).toEqual(['b'])
  })

  it('removes a nested task', () => {
    const tasks = [task({ id: 'a', subtasks: [task({ id: 'a1' }), task({ id: 'a2' })] })]
    expect(deleteTaskFromTree(tasks, 'a1')).toBe(true)
    expect(tasks[0].subtasks.map((t) => t.id)).toEqual(['a2'])
  })

  it('returns false when the id is not found', () => {
    expect(deleteTaskFromTree([task({ id: 'a' })], 'missing')).toBe(false)
  })
})

describe('addTaskToTree', () => {
  it('appends at top level when parentId is null', () => {
    const tasks = [task({ id: 'a' })]
    addTaskToTree(tasks, task({ id: 'b' }), null)
    expect(tasks.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('appends under the named parent', () => {
    const tasks = [task({ id: 'a', subtasks: [] })]
    addTaskToTree(tasks, task({ id: 'a1' }), 'a')
    expect(tasks[0].subtasks.map((t) => t.id)).toEqual(['a1'])
  })

  it('falls back to top-level when the parent id is unknown', () => {
    const tasks = [task({ id: 'a' })]
    addTaskToTree(tasks, task({ id: 'orphan' }), 'missing')
    expect(tasks.map((t) => t.id)).toEqual(['a', 'orphan'])
  })
})

describe('moveTaskInTree', () => {
  it('moves a task before a sibling', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })]
    expect(moveTaskInTree(tasks, 'c', 'a', 'before')).toBe(true)
    expect(tasks.map((t) => t.id)).toEqual(['c', 'a', 'b'])
  })

  it('moves a task after a sibling', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })]
    expect(moveTaskInTree(tasks, 'a', 'c', 'after')).toBe(true)
    expect(tasks.map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })

  it('recurses into subtask lists', () => {
    const tasks = [task({ id: 'p', subtasks: [task({ id: 'x' }), task({ id: 'y' })] })]
    expect(moveTaskInTree(tasks, 'y', 'x', 'before')).toBe(true)
    expect(tasks[0].subtasks.map((t) => t.id)).toEqual(['y', 'x'])
  })

  it('returns false when source and target are not siblings', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'p', subtasks: [task({ id: 'x' })] })]
    expect(moveTaskInTree(tasks, 'a', 'x', 'before')).toBe(false)
  })
})

describe('filterArchived', () => {
  it('drops archived tasks at each level', () => {
    const tasks = [
      task({ id: 'a', archived: true }),
      task({ id: 'b', subtasks: [task({ id: 'b1', archived: true }), task({ id: 'b2' })] })
    ]
    const filtered = filterArchived(tasks)
    expect(filtered.map((t) => t.id)).toEqual(['b'])
    expect(filtered[0].subtasks.map((t) => t.id)).toEqual(['b2'])
  })

  it('does not mutate the input tree', () => {
    const original = [task({ id: 'a', archived: true })]
    filterArchived(original)
    expect(original.map((t) => t.id)).toEqual(['a'])
  })
})

describe('collectAllAssignees', () => {
  it('returns a sorted, deduplicated list across nested tasks', () => {
    const tasks = [
      task({ id: 'a', assignees: ['Bob', 'Alice'] }),
      task({ id: 'b', subtasks: [task({ id: 'b1', assignees: ['Alice', 'Carol'] })] })
    ]
    expect(collectAllAssignees(tasks)).toEqual(['Alice', 'Bob', 'Carol'])
  })

  it('merges the extra list in', () => {
    const tasks = [task({ id: 'a', assignees: ['Alice'] })]
    expect(collectAllAssignees(tasks, ['Dave'])).toEqual(['Alice', 'Dave'])
  })

  it('filters out empty strings', () => {
    const tasks = [task({ id: 'a', assignees: ['', 'Alice'] })]
    expect(collectAllAssignees(tasks)).toEqual(['Alice'])
  })
})

describe('collectAllTags', () => {
  it('returns a sorted, deduplicated list', () => {
    const tasks = [
      task({ id: 'a', tags: ['foo', 'bar'] }),
      task({ id: 'b', subtasks: [task({ id: 'b1', tags: ['bar', 'baz'] })] })
    ]
    expect(collectAllTags(tasks)).toEqual(['bar', 'baz', 'foo'])
  })
})

describe('totalLoggedHours', () => {
  it('returns 0 when no logs exist', () => {
    expect(totalLoggedHours(task({ id: 'a' }))).toBe(0)
  })

  it('sums hours across logs', () => {
    const t = task({
      id: 'a',
      timeLogs: [
        { date: '2026-04-01', hours: 2, note: '' },
        { date: '2026-04-02', hours: 3.5, note: '' }
      ]
    })
    expect(totalLoggedHours(t)).toBe(5.5)
  })
})

describe('applyTagChange', () => {
  const tagged = task({ id: 'a', tags: ['art', 'wip', 'UI'] })

  it('adds tags after the ones a task has', () => {
    expect(applyTagChange(tagged, { add: ['new'], remove: [] })?.tags).toEqual(['art', 'wip', 'UI', 'new'])
  })

  it('takes a tag off without touching the rest', () => {
    expect(applyTagChange(tagged, { add: [], remove: ['wip'] })?.tags).toEqual(['art', 'UI'])
  })

  it('matches tags the way Obsidian does, ignoring case and a leading #', () => {
    expect(applyTagChange(tagged, { add: [], remove: ['#Art', 'ui'] })?.tags).toEqual(['wip'])
    expect(applyTagChange(tagged, { add: ['#ART', ' Wip '], remove: [] })).toBeNull()
  })

  it('writes an added tag without its #', () => {
    expect(applyTagChange(tagged, { add: ['#fresh'], remove: [] })?.tags).toEqual(['art', 'wip', 'UI', 'fresh'])
  })

  it('does both at once, and ignores blank tags', () => {
    expect(applyTagChange(tagged, { add: ['x', '', '#'], remove: ['art'] })?.tags).toEqual(['wip', 'UI', 'x'])
  })

  it('leaves a task alone when it already ends up as asked', () => {
    expect(applyTagChange(tagged, { add: ['art'], remove: [] })).toBeNull()
    expect(applyTagChange(tagged, { add: [], remove: ['missing'] })).toBeNull()
    expect(applyTagChange(tagged, { add: [], remove: [] })).toBeNull()
  })

  it('does not touch the task it reads', () => {
    applyTagChange(tagged, { add: ['x'], remove: ['art'] })
    expect(tagged.tags).toEqual(['art', 'wip', 'UI'])
  })
})

describe('tagUsage', () => {
  const tasks = [task({ id: 'a', tags: ['art', 'wip'] }), task({ id: 'b', tags: ['Art'] }), task({ id: 'c', tags: [] })]

  it('counts the tasks holding each tag, a spelling variant included', () => {
    expect(tagUsage(tasks, ['art', 'wip', 'idle'])).toEqual([
      { tag: 'art', count: 2 },
      { tag: 'wip', count: 1 },
      { tag: 'idle', count: 0 }
    ])
  })

  it('adds tags held by a task that were not known, sorted, after the known ones', () => {
    const extra = [task({ id: 'a', tags: ['zed', 'amy'] })]
    expect(tagUsage(extra, ['mid']).map((u) => u.tag)).toEqual(['mid', 'amy', 'zed'])
  })

  it('counts a task once however often it holds a tag', () => {
    expect(tagUsage([task({ id: 'a', tags: ['x', 'X'] })])).toEqual([{ tag: 'x', count: 1 }])
  })

  it('skips blank tags', () => {
    expect(tagUsage([task({ id: 'a', tags: ['', '#'] })], [''])).toEqual([])
  })
})

describe('diffTagChange', () => {
  it('adds what was turned on and removes what was turned off', () => {
    const before = { on: ['a', 'b'], mixed: ['c', 'd'] }
    const after = { on: ['a', 'd', 'new'], mixed: ['c'] }
    expect(diffTagChange(before, after)).toEqual({ add: ['d', 'new'], remove: ['b'] })
  })

  it('removes a mixed tag turned off, and leaves one still mixed', () => {
    expect(diffTagChange({ on: [], mixed: ['m', 'n'] }, { on: [], mixed: ['n'] })).toEqual({ add: [], remove: ['m'] })
  })

  it('asks for nothing when nothing changed', () => {
    const same = { on: ['a'], mixed: ['b'] }
    expect(diffTagChange(same, same)).toEqual({ add: [], remove: [] })
  })

  it('compares tags as Obsidian does', () => {
    expect(diffTagChange({ on: ['Art'], mixed: [] }, { on: ['art'], mixed: [] })).toEqual({ add: [], remove: [] })
  })
})
