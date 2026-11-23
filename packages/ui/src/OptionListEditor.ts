import { t } from '@dotpm/core'
import { createReorderGroup } from './dom'
import { setIcon } from './platform'
import { IconButton } from './primitives/IconButton'
import { renderAddButton } from './composites/addButton'

export interface OptionListOpts {
  options: string[]
  numbered: boolean
  /** The options worth keeping, in order. A blank one is only ever in the editor, never in this. */
  onChange: (options: string[]) => void
}

export interface OptionList {
  setNumbered: (on: boolean) => void
}

interface Item {
  key: string
  value: string
}

interface RowView {
  el: HTMLElement
  input: HTMLInputElement
  num: HTMLElement | null
}

/**
 * An editable, reorderable list of option names. The items are the state; rows are made once
 * per item and `reconcile` puts them in order, so a row is never rebuilt under a click.
 * Enter confirms an option and opens the next, and an option left blank goes when focus
 * leaves it.
 */
export function renderOptionList(parent: HTMLElement, opts: OptionListOpts): OptionList {
  const root = parent.createDiv('pm-cf-opt-editor')
  const list = root.createDiv('pm-cf-opt-list')
  const views = new Map<string, RowView>()
  let numbered = opts.numbered
  let nextKey = 0
  let reconciling = false
  let saved = [...opts.options]
  const newItem = (value: string): Item => ({ key: String(nextKey++), value })
  let items = opts.options.map(newItem)

  const isBlank = (item: Item): boolean => !item.value.trim()

  const commit = (): void => {
    const next = items.map((item) => item.value).filter((value) => value.trim())
    if (next.length === saved.length && next.every((value, i) => value === saved[i])) return
    saved = next
    opts.onChange(next)
  }

  const syncRow = (view: RowView, index: number): void => {
    view.input.placeholder = t('customField.option', { index: index + 1 })
    if (!numbered) {
      view.num?.remove()
      view.num = null
      return
    }
    if (!view.num) {
      view.num = view.el.createSpan('pm-cf-opt-num')
      view.el.insertBefore(view.num, view.input)
    }
    view.num.textContent = `${index + 1}.`
  }

  /** Makes the rows match `items`: drops the gone, adds the new, moves only what is out of place. */
  const reconcile = (focus?: string): void => {
    reconciling = true
    const live = new Set(items.map((item) => item.key))
    for (const [key, view] of views) {
      if (live.has(key)) continue
      view.el.remove()
      views.delete(key)
    }
    items.forEach((item, i) => {
      const view = views.get(item.key) ?? createRow(item)
      const at = list.children[i]
      if (at !== view.el) list.insertBefore(view.el, at ?? null)
      syncRow(view, i)
    })
    reconciling = false
    if (focus) views.get(focus)?.input.focus()
  }

  const dropBlanks = (keep?: Item): void => {
    const next = items.filter((item) => item === keep || !isBlank(item))
    if (next.length === items.length) return
    items = next
    reconcile()
  }

  const move = (item: Item, by: -1 | 1): void => {
    const from = items.indexOf(item)
    const to = from + by
    if (to < 0 || to >= items.length) return
    items.splice(from, 1)
    items.splice(to, 0, item)
    reconcile(item.key)
    commit()
  }

  const wireDrag = createReorderGroup(
    () => items.map((item) => item.key),
    (keys) => {
      const byKey = new Map(items.map((item) => [item.key, item]))
      items = keys.flatMap((key) => byKey.get(key) ?? [])
      reconcile()
      commit()
    }
  )

  const onKeydown = (e: KeyboardEvent, item: Item): void => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault()
      e.stopPropagation()
      if (isBlank(item)) return
      items = items.filter((other) => other === item || !isBlank(other))
      const next = newItem('')
      items.splice(items.indexOf(item) + 1, 0, next)
      reconcile(next.key)
      commit()
      return
    }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      e.stopPropagation()
      move(item, e.key === 'ArrowUp' ? -1 : 1)
    }
  }

  function createRow(item: Item): RowView {
    const el = list.createDiv('pm-cf-opt-row')
    const grip = el.createSpan('pm-cf-opt-grip')
    setIcon(grip, 'grip-vertical')
    const input = el.createEl('input', { type: 'text', value: item.value, cls: 'pm-input pm-cf-opt-input' })
    input.addEventListener('input', () => {
      item.value = input.value
    })
    input.addEventListener('change', commit)
    input.addEventListener('keydown', (e) => onKeydown(e, item))
    new IconButton(el)
      .setIcon('x')
      .setTooltip(t('customField.removeOption'))
      .onClick(() => {
        items = items.filter((other) => other !== item && !isBlank(other))
        reconcile()
        commit()
      })
    wireDrag(el, item.key, grip)
    const view: RowView = { el, input, num: null }
    views.set(item.key, view)
    return view
  }

  root.addEventListener('focusout', (e) => {
    // Not leaving at all: rows being moved, or the window losing focus (to copy text elsewhere).
    if (reconciling || !root.ownerDocument.hasFocus()) return
    const next = e.relatedTarget as HTMLElement | null
    // Rows shifting under a click on one of the editor's buttons would make it miss, so a
    // button acts first; whatever it does tidies up, or leaving the editor does.
    if (next && root.contains(next) && !next.matches('input.pm-cf-opt-input')) return
    const into = next ? [...views].find(([, view]) => view.el.contains(next))?.[0] : undefined
    dropBlanks(items.find((item) => item.key === into))
  })

  renderAddButton(root, t('customField.addOption'), () => {
    const blank = items.find(isBlank)
    if (blank) {
      views.get(blank.key)?.input.focus()
      return
    }
    const item = newItem('')
    items.push(item)
    reconcile(item.key)
  })

  reconcile()
  return {
    setNumbered: (on) => {
      numbered = on
      reconcile()
    }
  }
}
