import { Popover } from '#primitives/Popover'
import { renderOptionRow, type SelectItem } from './optionList'

export interface OptionPickerOpts {
  anchor: HTMLElement
  options: SelectItem[]
  selected: string[]
  /** Several values can be held: rows toggle and the popover stays open. */
  multiple?: boolean
  /** A single choice gets a first row clearing it, under this label. */
  noneLabel?: string
  /**
   * A first row that runs at once and drops whatever was picked. Unlike `noneLabel` it does not
   * compare against `selected`, for a choice made over several things that have no one value.
   */
  clear?: { label: string; run: () => void }
  /** Lists longer than this get a search field. */
  searchAbove?: number
  searchPlaceholder?: string
  width?: number
  /** The values held once the picker closes, and only when they differ from `selected`. */
  onCommit: (selected: string[]) => void
}

const SEARCH_ABOVE = 7

/**
 * A popover to choose values from a fixed list, for the places that show a value without
 * room for a control of its own, such as a table cell. Nothing is committed while a
 * multiple choice is being made: the caller redraws once, when the picker closes, instead
 * of under the open popover.
 *
 * A trigger shows one picker at a time. Pressing it while its picker is open closes that
 * picker, as pressing a toggle does, and returns null rather than opening another.
 */
export function openOptionPicker(opts: OptionPickerOpts): Popover | null {
  const open = Popover.openOn(opts.anchor)
  if (open) {
    open.close()
    return null
  }
  let current = [...opts.selected]
  // A value the list no longer offers stays pickable, so it can still be taken off.
  const known = new Set(opts.options.map((o) => o.id))
  const options: SelectItem[] = [
    ...opts.options,
    ...opts.selected.filter((id) => !known.has(id)).map((id) => ({ id, label: id }))
  ]

  const pop = new Popover({
    anchor: opts.anchor,
    width: opts.width ?? 230,
    onClose: () => {
      if (current.length !== opts.selected.length || current.some((id, i) => id !== opts.selected[i])) {
        opts.onCommit(current)
      }
    }
  })
  const search =
    options.length > (opts.searchAbove ?? SEARCH_ABOVE)
      ? pop.contentEl.createEl('input', {
          cls: 'pm-pop-field',
          attr: { placeholder: opts.searchPlaceholder ?? 'Search…', spellcheck: 'false' }
        })
      : null
  const list = pop.contentEl.createDiv('pm-pop-list')

  const toggle = (id: string): void => {
    if (opts.multiple) {
      current = current.includes(id) ? current.filter((v) => v !== id) : [...current, id]
      renderList()
    } else {
      current = id ? [id] : []
      pop.close()
    }
  }

  const renderList = (): void => {
    list.empty()
    const q = search?.value.trim().toLowerCase() ?? ''
    const clear = opts.clear
    if (clear && !q) {
      renderOptionRow(list, {
        label: clear.label,
        icon: 'x',
        onPick: () => {
          current = [...opts.selected]
          pop.close()
          clear.run()
        }
      })
    }
    if (!opts.multiple && opts.noneLabel && !q) {
      renderOptionRow(list, { label: opts.noneLabel, selected: current.length === 0, onPick: () => toggle('') })
    }
    for (const o of options.filter((it) => !q || it.label.toLowerCase().includes(q))) {
      renderOptionRow(list, {
        label: o.label,
        color: o.color,
        icon: o.icon,
        selected: current.includes(o.id),
        onPick: () => toggle(o.id)
      })
    }
  }

  search?.addEventListener('input', renderList)
  renderList()
  pop.open()
  search?.focus()
  return pop
}
