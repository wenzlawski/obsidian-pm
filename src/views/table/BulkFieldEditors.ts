import { Notice } from 'obsidian'
import {
  type CustomFieldChange,
  type CustomFieldDef,
  collectAllAssignees,
  customOptionLabel,
  displayName,
  t,
  today
} from '@dotpm/core'
import { openOptionPicker, safeAsync, type SelectItem } from '@dotpm/ui'
import { promptText } from '#ui/ModalFactory'
import { peopleSource } from '#ui/PersonPicker'
import type { TableContext } from './TableRenderer'

export interface BulkFieldEditorArgs {
  ctx: TableContext
  field: CustomFieldDef
  /** What the editor opens under. */
  anchor: HTMLElement
  /** Hands the change back, to be applied to every selected task. */
  apply: (change: CustomFieldChange) => void
}

/**
 * Collects one change to a field from the user. What a change means for a field decides which
 * editor it gets: values to pick from open a picker, a typed value a prompt.
 */
type BulkFieldEditor = (args: BulkFieldEditorArgs) => void

/**
 * Every field type has an editor here, so a type added to `CustomFieldDef` does not compile
 * until it has been given one, or has been left out on purpose by an editor that does nothing.
 */
const EDITORS: Record<CustomFieldDef['type'], BulkFieldEditor> = {
  select: (args) => {
    const { field } = args
    choose(args, optionItems(field), {
      onPick: ([value]) => args.apply({ mode: 'set', value })
    })
  },
  // Like tags, values are added to what each task has; clearing is the way to take them off.
  multiselect: (args) => {
    choose(args, optionItems(args.field), {
      multiple: true,
      onPick: (values) => args.apply({ mode: 'add', values })
    })
  },
  person: (args) => {
    const { ctx } = args
    const source = peopleSource(ctx.plugin, ctx.scope.primary?.filePath ?? '', () => [
      ...ctx.scope.teamMembers(),
      ...collectAllAssignees(ctx.scope.tasks())
    ])
    choose(
      args,
      source.known().map((member) => ({ id: member, label: displayName(member) })),
      { onPick: ([value]) => args.apply({ mode: 'set', value }) }
    )
  },
  // Unchecked is a value of its own, so there is nothing to clear to.
  checkbox: (args) => {
    choose(
      args,
      [
        { id: 'true', label: t('bulk.checked'), icon: 'check-square' },
        { id: 'false', label: t('bulk.unchecked'), icon: 'square' }
      ],
      { clearable: false, onPick: ([value]) => args.apply({ mode: 'set', value: value === 'true' }) }
    )
  },
  date: (args) => {
    const now = today()
    const ahead = (days: number): string => now.add({ days }).toString()
    choose(
      args,
      [
        { id: ahead(0), label: t('bulk.today', { date: ahead(0) }) },
        { id: ahead(1), label: t('bulk.tomorrow', { date: ahead(1) }) },
        { id: ahead(7), label: t('bulk.inOneWeek', { date: ahead(7) }) },
        { id: ahead(14), label: t('bulk.inTwoWeeks', { date: ahead(14) }) },
        { id: '', label: t('bulk.pickDate') }
      ],
      {
        onPick: ([value]) => {
          if (value) args.apply({ mode: 'set', value })
          else pickDate((picked) => args.apply({ mode: 'set', value: picked }))
        }
      }
    )
  },
  number: (args) => typed(args, (text) => parseNumber(text)),
  text: (args) => typed(args, (text) => text),
  url: (args) => typed(args, (text) => text)
}

/** The fields a bulk change can be offered for: those a selected task's project defines. */
export function bulkEditableFields(ctx: TableContext): CustomFieldDef[] {
  const owners = ctx.scope.groupByProject([...ctx.state.selectedTaskIds]).map((group) => group.project)
  const defined = new Set(
    owners.flatMap((project) => ctx.plugin.store.configFor(project).customFields.map((f) => f.id))
  )
  return ctx.scope.customFields().filter((field) => defined.has(field.id))
}

/** First choose the field, then change it the way its type calls for. */
export function openBulkPropertyPicker(
  ctx: TableContext,
  anchor: HTMLElement,
  apply: (field: CustomFieldDef, change: CustomFieldChange) => void
): void {
  const fields = bulkEditableFields(ctx)
  openOptionPicker({
    anchor,
    options: fields.map((field) => ({ id: field.id, label: field.name, icon: field.icon })),
    selected: [],
    onCommit: ([id]) => {
      const field = fields.find((f) => f.id === id)
      if (!field) return
      EDITORS[field.type]({ ctx, field, anchor, apply: (change) => apply(field, change) })
    }
  })
}

function optionItems(field: CustomFieldDef): SelectItem[] {
  return (field.options ?? []).map((option) => ({
    id: option,
    label: customOptionLabel(field, option, displayName(option))
  }))
}

interface ChooseOpts {
  multiple?: boolean
  /** Offer a row clearing the field; on unless a value already stands for "nothing". */
  clearable?: boolean
  onPick: (ids: string[]) => void
}

function choose(args: BulkFieldEditorArgs, items: SelectItem[], opts: ChooseOpts): void {
  openOptionPicker({
    anchor: args.anchor,
    options: items,
    selected: [],
    multiple: opts.multiple,
    clear:
      opts.clearable === false ? undefined : { label: t('bulk.clearValue'), run: () => args.apply({ mode: 'clear' }) },
    onCommit: opts.onPick
  })
}

/** A value that is typed rather than picked. `read` turns the text into the value, or null to refuse it. */
function typed(args: BulkFieldEditorArgs, read: (text: string) => string | number | null): void {
  choose(args, [{ id: 'enter', label: t('bulk.setValue'), icon: 'pencil' }], {
    onPick: safeAsync(async () => {
      const text = await promptText(args.ctx.plugin.app, t('bulk.enterValue', { name: args.field.name }))
      if (text === null) return
      const value = read(text)
      if (value === null) new Notice(t('bulk.notANumber', { value: text }))
      else args.apply({ mode: 'set', value })
    })
  })
}

function parseNumber(text: string): number | null {
  const value = parseFloat(text)
  return Number.isNaN(value) ? null : value
}

/** The browser's own date picker, opened without anything on screen to anchor it. */
export function pickDate(onPick: (date: string) => void): void {
  const input = activeDocument.createEl('input')
  input.type = 'date'
  input.addClass('pm-offscreen')
  activeDocument.body.appendChild(input)
  input.addEventListener('change', () => {
    if (input.value) onPick(input.value)
    input.remove()
  })
  input.addEventListener('blur', () => window.setTimeout(() => input.remove(), 200))
  input.showPicker()
}
