import { Popover } from '#primitives/Popover'
import { enableOptionNavigation, renderOptionRow, type SelectItem } from './optionList'

export interface OptionPickerOpts {
  anchor: HTMLElement
  options: SelectItem[]
  selected: string[]
  /**
   * Several values can be held: rows toggle and the popover stays open. A row in `mixed` is
   * held by only some of the things being edited; picking it makes it held by all, and
   * picking it again takes it off.
   */
  multiple?: boolean
  mixed?: string[]
  /** A single choice gets a first row clearing it, under this label. */
  noneLabel?: string
  /**
   * A last row that runs at once and drops whatever was picked. Unlike `noneLabel` it does not
   * compare against `selected`, for a choice made over several things that have no one value.
   */
  clear?: { label: string; run: () => void }
  /**
   * What is typed and matches no option becomes a row that makes it one. `normalize` tidies
   * the typed text first and may return an empty string to refuse it.
   */
  create?: { label: (name: string) => string; normalize?: (name: string) => string }
  /** Lists longer than this get a search field; a picker that can create always has one. */
  searchAbove?: number
  searchPlaceholder?: string
  width?: number
  /**
   * The values held and the ones left mixed once the picker closes, and only when either
   * differs from what it opened with.
   */
  onCommit: (selected: string[], mixed: string[]) => void
}

const SEARCH_ABOVE = 7

const sameList = (a: string[], b: string[]): boolean => a.length === b.length && a.every((id, i) => id === b[i])

/**
 * A popover to choose values from a list, for the places that show a value without room for
 * a control of its own, such as a table cell or a bar of bulk actions. Nothing is committed
 * while a multiple choice is being made: the caller redraws once, when the picker closes,
 * instead of under the open popover.
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
  const partial = new Set(opts.mixed ?? [])
  // A value the list no longer offers stays pickable, so it can still be taken off.
  const options: SelectItem[] = [...opts.options]
  for (const id of [...opts.selected, ...partial]) {
    if (!options.some((o) => o.id === id)) options.push({ id, label: id })
  }

  const changed = (): boolean =>
    !sameList(current, opts.selected) || !sameList([...partial].sort(), [...(opts.mixed ?? [])].sort())

  const pop = new Popover({
    anchor: opts.anchor,
    width: opts.width ?? 230,
    onClose: () => {
      if (changed()) opts.onCommit(current, [...partial])
    }
  })
  const search =
    opts.create || options.length > (opts.searchAbove ?? SEARCH_ABOVE)
      ? pop.contentEl.createEl('input', {
          cls: 'pm-pop-field',
          attr: { placeholder: opts.searchPlaceholder ?? 'Search…', spellcheck: 'false' }
        })
      : null
  const list = pop.contentEl.createDiv('pm-pop-list')

  const toggle = (id: string): void => {
    if (!opts.multiple) {
      current = id ? [id] : []
      pop.close()
      return
    }
    if (partial.delete(id)) current = [...current, id]
    else current = current.includes(id) ? current.filter((v) => v !== id) : [...current, id]
    renderList()
  }

  const renderList = (): void => {
    list.empty()
    const typed = search?.value.trim() ?? ''
    const q = typed.toLowerCase()
    if (!opts.multiple && opts.noneLabel && !q) {
      renderOptionRow(list, { label: opts.noneLabel, selected: current.length === 0, onPick: () => toggle('') })
    }
    const shown = options.filter((it) => !q || it.label.toLowerCase().includes(q))
    for (const o of shown) {
      renderOptionRow(list, {
        label: o.label,
        color: o.color,
        icon: o.icon,
        note: o.note,
        selected: current.includes(o.id),
        mixed: partial.has(o.id),
        onPick: () => toggle(o.id)
      })
    }
    const create = opts.create
    const name = create ? (create.normalize ? create.normalize(typed) : typed) : ''
    const exists = options.some((o) => [o.id, o.label].some((text) => text.toLowerCase() === name.toLowerCase()))
    if (create && name && !exists) {
      renderOptionRow(list, {
        label: create.label(name),
        icon: 'plus',
        accent: true,
        onPick: () => {
          options.push({ id: name, label: name })
          if (search) search.value = ''
          toggle(name)
          search?.focus()
        }
      })
    }

    const clear = opts.clear
    if (clear && !q) {
      renderOptionRow(list, {
        label: clear.label,
        icon: 'x',
        onPick: () => {
          current = [...opts.selected]
          partial.clear()
          for (const id of opts.mixed ?? []) partial.add(id)
          pop.close()
          clear.run()
        }
      })
    }
  }

  search?.addEventListener('input', renderList)
  renderList()
  pop.open()
  enableOptionNavigation(pop.contentEl, list, search)
  search?.focus()
  return pop
}
