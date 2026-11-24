import type PMPlugin from '#main'
import type { ProjectScope } from '#store'
import {
  filterDefaults,
  filterProjectId,
  mergeTaskDefaults,
  type FilterState,
  type Project,
  type Task
} from '@dotpm/core'

/**
 * The values a new task in `project` starts with: what the filter pins down, under
 * `defaults`. Resolved per project, because a status or property only counts where the
 * project defines it.
 */
export function newTaskDefaults(
  plugin: PMPlugin,
  project: Project,
  opts: { filter?: FilterState; defaults?: Partial<Task> | null; parentId?: string | null }
): Partial<Task> | undefined {
  const fromFilter = opts.filter
    ? filterDefaults(opts.filter, plugin.store.configFor(project), { subtask: !!opts.parentId })
    : {}
  const merged = mergeTaskDefaults(fromFilter, opts.defaults)
  return Object.keys(merged).length ? merged : undefined
}

/** The project in scope that a filter narrows the view to, so there is no need to ask. */
export function projectNamedByFilter(scope: ProjectScope, filter: FilterState | undefined): Project | undefined {
  const id = filter ? filterProjectId(filter) : undefined
  return id ? scope.projects.find((project) => project.id === id) : undefined
}
