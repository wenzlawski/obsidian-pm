import { type CustomFieldDef, CUSTOM_FIELD_TYPES, makeId, t } from '@dotpm/core'
import { makeReorderable } from './dom'
import { setIcon } from './platform'
import { Checkbox } from './primitives/Checkbox'
import { IconButton } from './primitives/IconButton'
import { renderAddButton } from './composites/addButton'

export function customFieldTypeLabels(): Record<CustomFieldDef['type'], string> {
  return {
    text: t('fieldType.text'),
    number: t('fieldType.number'),
    date: t('fieldType.date'),
    select: t('fieldType.select'),
    multiselect: t('fieldType.multiselect'),
    person: t('fieldType.person'),
    checkbox: t('fieldType.checkbox'),
    url: t('fieldType.url')
  }
}

export interface CustomFieldListEditorOpts {
  /** Mutated in place; `onChanged` is the owner's cue to persist. */
  fields: CustomFieldDef[]
  onChanged: () => void
  /** Replaces this list's own repaint, for an owner that draws something derived from `fields`. */
  redraw?: () => void
  /** Extra per-row content between the type picker and the delete button. */
  renderExtra?: (row: HTMLElement, field: CustomFieldDef) => void
}

export function renderCustomFieldListEditor(container: HTMLElement, opts: CustomFieldListEditorOpts): void {
  const rerender = opts.redraw ?? ((): void => renderCustomFieldListEditor(container, opts))
  container.empty()
  opts.fields.forEach((field, index) => renderRow(container, field, index, opts, rerender))
  renderAddButton(container, t('settings.customFields.add'), () => {
    opts.fields.push({ id: makeId(), name: t('settings.customFields.newLabel'), type: 'text', options: [] })
    opts.onChanged()
    rerender()
  })
}

function renderRow(
  container: HTMLElement,
  field: CustomFieldDef,
  index: number,
  opts: CustomFieldListEditorOpts,
  rerender: () => void
): void {
  const row = container.createDiv('pm-cf-row')
  renderCustomFieldFields(row, field, opts.onChanged, rerender)
  opts.renderExtra?.(row, field)
  new IconButton(row)
    .setIcon('x')
    .setTooltip(t('customField.removeField'))
    .onClick(() => {
      opts.fields.splice(index, 1)
      opts.onChanged()
      rerender()
    })
  renderCustomFieldOptions(row, field, opts.onChanged)
}

export function renderCustomFieldFields(
  parent: HTMLElement,
  field: CustomFieldDef,
  onChanged: () => void,
  redraw: () => void
): void {
  const name = parent.createEl('input', { type: 'text', value: field.name, cls: 'pm-input pm-cf-name' })
  name.placeholder = t('customField.namePlaceholder')
  name.addEventListener('change', () => {
    field.name = name.value
    onChanged()
  })

  const type = parent.createEl('select', { cls: 'pm-input pm-select pm-cf-type' })
  for (const id of CUSTOM_FIELD_TYPES) {
    const el = type.createEl('option', { value: id, text: customFieldTypeLabels()[id] })
    if (id === field.type) el.selected = true
  }
  type.addEventListener('change', () => {
    field.type = type.value as CustomFieldDef['type']
    onChanged()
    redraw()
  })

  const filterable = new IconButton(parent)
  const paint = (): void => {
    const shown = field.filterable !== false
    filterable
      .setIcon(shown ? 'list-filter' : 'filter-x')
      .setTooltip(shown ? t('customField.filterable') : t('customField.notFilterable'))
    filterable.el.setAttribute('aria-pressed', String(shown))
  }
  paint()
  filterable.onClick(() => {
    if (field.filterable === false) delete field.filterable
    else field.filterable = false
    paint()
    onChanged()
  })
}

export function renderCustomFieldOptions(parent: HTMLElement, field: CustomFieldDef, onChanged: () => void): void {
  if (field.type !== 'select' && field.type !== 'multiselect') return
  const options = field.options ?? []
  field.options = options
  const optionsWrap = parent.createDiv('pm-cf-options')

  const numbered = optionsWrap.createEl('label', { cls: 'pm-cf-numbered' })
  new Checkbox(numbered).setChecked(field.numbered === true).onChange((checked) => {
    if (checked) field.numbered = true
    else delete field.numbered
    onChanged()
    drawOptions()
  })
  numbered.createSpan({ text: t('customField.numbered') })

  const list = optionsWrap.createDiv('pm-cf-opt-list')
  // Aligned with `options`. Rows are found by identity, so one can leave the list without a redraw.
  let rowEls: HTMLElement[] = []
  let drawing = false
  let nextKey = 0
  const inputOf = (row: HTMLElement): HTMLInputElement => {
    const input = row.querySelector<HTMLInputElement>('input.pm-cf-opt-input')
    if (!input) throw new Error('option row without an input')
    return input
  }
  const numberRows = (): void => {
    rowEls.forEach((row, i) => {
      const num = row.querySelector('.pm-cf-opt-num')
      if (num) num.textContent = `${i + 1}.`
      inputOf(row).placeholder = t('customField.option', { index: i + 1 })
    })
  }
  const removeRow = (row: HTMLElement): void => {
    const i = rowEls.indexOf(row)
    if (i < 0) return
    options.splice(i, 1)
    rowEls.splice(i, 1)
    row.remove()
    numberRows()
    onChanged()
  }
  /** An option left empty is no option: it goes when focus moves off it. */
  const pruneEmpty = (keep?: HTMLElement): void => {
    for (const row of rowEls.filter((el) => el !== keep && !inputOf(el).value.trim())) removeRow(row)
  }
  optionsWrap.addEventListener('focusout', (e) => {
    const next = e.relatedTarget as HTMLElement | null
    if (drawing || !optionsWrap.ownerDocument.hasFocus()) return
    // A click on one of the editor's buttons would miss if the rows shifted under it first;
    // whatever that button does tidies up, or leaving the editor does.
    if (next && optionsWrap.contains(next) && !next.matches('input.pm-cf-opt-input')) return
    pruneEmpty(next ? rowEls.find((row) => row.contains(next)) : undefined)
  })

  const move = (from: number, to: number): void => {
    if (to < 0 || to >= options.length || from === to) return
    const [moved] = options.splice(from, 1)
    options.splice(to, 0, moved)
    onChanged()
    drawOptions(to)
  }
  const drawOptions = (focus?: number): void => {
    drawing = true
    list.empty()
    drawing = false
    rowEls = []
    options.forEach((option, i) => {
      const optionRow = list.createDiv('pm-cf-opt-row')
      optionRow.dataset.key = String(nextKey++)
      rowEls.push(optionRow)
      setIcon(optionRow.createSpan('pm-cf-opt-grip'), 'grip-vertical')
      if (field.numbered) optionRow.createSpan({ cls: 'pm-cf-opt-num', text: `${i + 1}.` })
      const input = optionRow.createEl('input', { type: 'text', value: option, cls: 'pm-input pm-cf-opt-input' })
      input.placeholder = t('customField.option', { index: i + 1 })
      input.addEventListener('change', () => {
        const at = rowEls.indexOf(optionRow)
        if (at < 0) return
        options[at] = input.value
        onChanged()
      })
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault()
          e.stopPropagation()
          if (!input.value.trim()) return
          pruneEmpty(optionRow)
          const at = rowEls.indexOf(optionRow)
          options[at] = input.value
          options.splice(at + 1, 0, '')
          onChanged()
          drawOptions(at + 1)
          return
        }
        if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
        e.preventDefault()
        e.stopPropagation()
        const at = rowEls.indexOf(optionRow)
        // Keep an edit made before the move; the change event hasn't fired yet.
        options[at] = input.value
        move(at, e.key === 'ArrowUp' ? at - 1 : at + 1)
      })
      if (i === focus) input.focus()
      new IconButton(optionRow)
        .setIcon('x')
        .setTooltip(t('customField.removeOption'))
        .onClick(() => {
          removeRow(optionRow)
          pruneEmpty()
        })
    })
    if (rowEls.length > 1) {
      makeReorderable(
        rowEls.map((el) => ({ el, id: el.dataset.key ?? '' })),
        (keys) => {
          // The ids were taken at draw time; rows removed since are skipped.
          const live = keys.filter((key) => rowEls.some((row) => row.dataset.key === key))
          const reordered = live.map((key) => options[rowEls.findIndex((row) => row.dataset.key === key)])
          options.splice(0, options.length, ...reordered)
          onChanged()
          drawOptions()
        }
      )
    }
  }
  drawOptions()
  renderAddButton(optionsWrap, t('customField.addOption'), () => {
    const blank = rowEls.find((row) => !inputOf(row).value.trim())
    if (blank) {
      inputOf(blank).focus()
      return
    }
    options.push('')
    drawOptions(options.length - 1)
  })
}
