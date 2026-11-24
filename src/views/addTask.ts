import { Menu } from 'obsidian'
import type PMPlugin from '#main'
import type { ProjectScope } from '#store'
import type { FilterState, Project, Task } from '@dotpm/core'
import { openTaskModal } from '#ui/ModalFactory'
import { newTaskDefaults, projectNamedByFilter } from '#ui/newTaskDefaults'

export interface AddTaskOptions {
  defaults?: Partial<Task>
  /** The view's filter. A field it pins to one value starts with that value on the new task. */
  filter?: FilterState
  parentId?: string | null
  onSave: () => void | Promise<void>
  /** Anchors the project menu when the view covers more than one project. */
  event?: MouseEvent
}

/**
 * Opens the task editor for a new task. With several projects in view the task has to
 * say which one it belongs to, so the choice is asked for rather than guessed, unless the
 * filter already names one.
 */
export function openAddTask(plugin: PMPlugin, scope: ProjectScope, opts: AddTaskOptions): void {
  const open = (project: Project): void => {
    openTaskModal(plugin, project, {
      defaults: newTaskDefaults(plugin, project, opts),
      parentId: opts.parentId ?? null,
      onSave: () => opts.onSave()
    })
  }
  const primary = scope.primary
  if (!primary) return
  const named = projectNamedByFilter(plugin, scope, opts.filter)
  if (named) {
    open(named)
    return
  }
  if (!scope.isMulti || !opts.event) {
    open(primary)
    return
  }
  const menu = new Menu()
  for (const project of scope.projects) {
    menu.addItem((item) =>
      item
        .setTitle(project.title)
        .setIcon('plus')
        .onClick(() => open(project))
    )
  }
  menu.showAtMouseEvent(opts.event)
}
