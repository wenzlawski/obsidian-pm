import { t } from '@dotpm/core'
import { activeDocument, showNotice, type PlatformMenu } from './platform'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number>
): SVGElementTagNameMap[K] {
  const el = activeDocument().createElementNS(SVG_NS, tag)
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, String(v))
    }
  }
  return el
}

/**
 * Makes an element that isn't a button open something: click and Enter or Space both reach
 * `open`, and neither reaches the row or card behind it.
 */
export function makeActivatable(el: HTMLElement, open: () => void): void {
  el.setAttr('role', 'link')
  el.setAttr('tabindex', '0')
  el.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    open()
  })
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    e.stopPropagation()
    open()
  })
}

/**
 * Wires rows to be dragged into another order, for a list whose rows come and go: `ids` is
 * read at each drop, so it names the rows as they are then. A row dropped on another takes
 * that row's place, so it lands after a row below it and before a row above it. `onReorder`
 * gets every id in the new order; nothing is called when the order stays the same.
 *
 * Give a `handle` and the row can only be dragged by it, so text inside the row can still be
 * selected with the mouse.
 */
export function createReorderGroup<T extends string>(
  ids: () => T[],
  onReorder: (ids: T[]) => void
): (el: HTMLElement, id: T, handle?: HTMLElement) => void {
  let dragged: T | null = null
  return (el, id, handle) => {
    if (handle) {
      handle.addEventListener('mousedown', () => el.setAttr('draggable', 'true'))
      handle.addEventListener('mouseup', () => el.removeAttribute('draggable'))
    } else {
      el.setAttr('draggable', 'true')
    }
    el.addEventListener('dragstart', (e) => {
      dragged = id
      e.dataTransfer?.setData('text/plain', id)
      el.addClass('is-dragging')
    })
    el.addEventListener('dragend', () => {
      el.removeClass('is-dragging')
      if (handle) el.removeAttribute('draggable')
    })
    el.addEventListener('dragover', (e) => e.preventDefault())
    el.addEventListener('drop', (e) => {
      e.preventDefault()
      const from = dragged
      dragged = null
      const all = ids()
      if (from === null || from === id || !all.includes(from)) return
      const next = all.filter((other) => other !== from)
      next.splice(all.indexOf(id), 0, from)
      onReorder(next)
    })
  }
}

/** Lets a fixed set of rows be dragged into another order; see `createReorderGroup`. */
export function makeReorderable<T extends string>(
  rows: { el: HTMLElement; id: T }[],
  onReorder: (ids: T[]) => void
): void {
  const ids = rows.map((row) => row.id)
  const wire = createReorderGroup(() => ids, onReorder)
  for (const { el, id } of rows) wire(el, id)
}

export function safeAsync<A extends unknown[]>(fn: (...args: A) => Promise<void>): (...args: A) => void {
  return (...args: A) => {
    void (async () => {
      try {
        await fn(...args)
      } catch (err: unknown) {
        console.error('[PM]', err)
        showNotice(t('common.somethingWentWrong'))
      }
    })()
  }
}

/**
 * Opens a menu under a button rather than at the pointer, so keyboard activation places it
 * too. `align: 'right'` lines the menu's right edge up with the button's, for a button at the
 * end of a row.
 */
export function showMenuBelow(menu: PlatformMenu, anchor: HTMLElement, align: 'left' | 'right' = 'left'): void {
  const rect = anchor.getBoundingClientRect()
  if (align === 'right') menu.showAtPosition({ x: rect.right, y: rect.bottom + 4, left: true })
  else menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 })
}
