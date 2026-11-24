import {
  customOptionLabel,
  customOptionsText,
  displayName,
  t,
  type CustomFieldDef,
  type InheritedShare
} from '@dotpm/core'
import { setIcon } from '#platform'
import { AvatarStack, type AvatarPerson } from '#primitives/AvatarStack'
import { makeActivatable } from '#dom'
import type { Popover } from '#primitives/Popover'
import { markInherited } from '../inheritedMark'
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
      /** What the cell shows. */
      text: string
      /**
       * What the picker ticks and edits: the values the task holds itself. It differs from
       * `text` when an ancestor contributes, since inherited values are never written to the task.
       */
      values: string[]
      options: SelectItem[]
      multiple: boolean
      /** Receives every value held after an edit; at most one for a single choice. */
      onChange?: (values: string[]) => void
    }

export interface ChoiceEdit {
  /** The values the task holds itself. */
  own: string[]
  /** Gets the value as the field stores it: a string for a select, a list for a multi-select. */
  save: (stored: string | string[]) => void
}

/**
 * The cell value for a select or multi-select field, null for any other type. `shown` is
 * what the cell displays; without `edit` it only displays it.
 */
export function choiceFieldValue(cf: CustomFieldDef, shown: string[], edit?: ChoiceEdit): CustomFieldValue | null {
  if (cf.type !== 'select' && cf.type !== 'multiselect') return null
  const multiple = cf.type === 'multiselect'
  return {
    kind: 'choice',
    text: customOptionsText(cf, shown),
    values: edit?.own ?? shown,
    multiple,
    options: (cf.options ?? []).map((option) => ({
      id: option,
      label: customOptionLabel(cf, option, displayName(option))
    })),
    onChange: edit && ((next) => edit.save(multiple ? next : (next[0] ?? '')))
  }
}

export class CustomFieldCell {
  el: HTMLTableCellElement

  constructor(parentRow: HTMLElement, value: CustomFieldValue, inherited: InheritedShare = 'none') {
    this.el = parentRow.createEl('td', { cls: 'pm-table-cell' })
    this.render(value)
    markInherited(this.el, inherited)
  }

  private render(value: CustomFieldValue): void {
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
    const el = this.empty(value.text)
    const onChange = value.onChange
    if (!onChange) return
    el.addClass('pm-cf-value--editable')
    el.setAttr('aria-haspopup', 'true')
    let picker: Popover | null = null
    makeActivatable(
      el,
      () => {
        if (picker?.isOpen) {
          picker.close()
          return
        }
        picker = openOptionPicker({
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
