import { t, type CustomFieldDef } from '@dotpm/core'
import { setIcon } from '#platform'
import { AvatarStack, type AvatarPerson } from '#primitives/AvatarStack'
import { makeActivatable } from '#dom'
import { openOptionPicker } from '../properties/OptionPicker'
import type { SelectItem } from '../properties/optionList'

/**
 * Showing a value and changing it are one concept here: a kind that can be edited in the
 * cell carries an `onChange`, and the cell becomes interactive exactly when one is given.
 * A kind is made editable by adding its own `onChange` and the control that backs it.
 */
export type CustomFieldValue =
  | { kind: 'text'; text: string }
  | { kind: 'checkbox'; checked: boolean }
  | { kind: 'url'; url: string }
  /** A person field: the same avatars assignees get, opening the person's note. */
  | { kind: 'people'; people: AvatarPerson[] }
  /** Any other value naming a note, shown as the note's name. */
  | { kind: 'links'; links: AvatarPerson[] }
  /** One or more values picked from a list: a select or multi-select field. */
  | {
      kind: 'choice'
      values: string[]
      options: SelectItem[]
      multiple: boolean
      /** Receives every value held after an edit; at most one for a single choice. */
      onChange?: (values: string[]) => void
    }

/**
 * The cell value for a select or multi-select field, null for any other type. `save` gets
 * the value as the field stores it: a string for a select, a list for a multi-select. Without
 * it the cell only shows the value.
 */
export function choiceFieldValue(
  cf: CustomFieldDef,
  values: string[],
  save?: (stored: string | string[]) => void
): CustomFieldValue | null {
  if (cf.type !== 'select' && cf.type !== 'multiselect') return null
  const multiple = cf.type === 'multiselect'
  return {
    kind: 'choice',
    values,
    multiple,
    options: (cf.options ?? []).map((option) => ({ id: option, label: option })),
    onChange: save && ((next) => save(multiple ? next : (next[0] ?? '')))
  }
}

export class CustomFieldCell {
  el: HTMLTableCellElement

  constructor(parentRow: HTMLElement, value: CustomFieldValue) {
    this.el = parentRow.createEl('td', { cls: 'pm-table-cell' })
    switch (value.kind) {
      case 'text':
        this.empty(value.text)
        return
      case 'choice':
        this.renderChoice(value)
        return
      case 'checkbox':
        if (value.checked) setIcon(this.el.createSpan({ cls: 'pm-glyph-icon' }), 'check')
        else this.empty('')
        return
      case 'url': {
        if (!value.url) {
          this.empty('')
          return
        }
        const link = this.el.createEl('a', { cls: 'external-link', text: value.url, href: value.url })
        link.setAttr('target', '_blank')
        link.setAttr('rel', 'noopener')
        return
      }
      case 'people':
        if (value.people.length === 0) this.empty('')
        else new AvatarStack(this.el).setPeople(value.people).setMax(3)
        return
      case 'links':
        this.renderLinks(value.links)
    }
  }

  private empty(text: string): HTMLElement {
    return this.el.createSpan({ text: text || '—', cls: 'pm-cf-value' })
  }

  private renderChoice(value: Extract<CustomFieldValue, { kind: 'choice' }>): void {
    const el = this.empty(value.values.join(', '))
    const onChange = value.onChange
    if (!onChange) return
    el.addClass('pm-cf-value--editable')
    el.setAttr('aria-haspopup', 'true')
    makeActivatable(
      el,
      () => {
        openOptionPicker({
          anchor: el,
          options: value.options,
          selected: value.values,
          multiple: value.multiple,
          noneLabel: t('common.none'),
          onCommit: onChange
        })
      },
      'button'
    )
  }

  private renderLinks(links: AvatarPerson[]): void {
    const value = this.el.createSpan({ cls: 'pm-cf-value' })
    links.forEach((link, i) => {
      if (i > 0) value.createSpan({ text: ', ' })
      const el = value.createSpan({ text: link.name })
      if (!link.onClick && !link.unresolved) return
      el.addClass('pm-cf-link')
      if (link.unresolved) el.addClass('pm-cf-link--unresolved')
      const open = link.onClick
      if (!open) return
      makeActivatable(el, open)
    })
  }
}
