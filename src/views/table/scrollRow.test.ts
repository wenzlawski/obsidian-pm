// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { scrollRowIntoView, stickyHeaderHeight } from './scrollRow'

function setup(headerHeight: number) {
  const wrapper = activeDocument.body.createDiv('pm-table-wrapper')
  const table = wrapper.createEl('table')
  const thead = table.createEl('thead')
  Object.defineProperty(thead, 'offsetHeight', { value: headerHeight, configurable: true })
  const row = table.createEl('tbody').createEl('tr')

  const paddingWhenScrolled: string[] = []
  row.scrollIntoView = vi.fn<() => void>(() => {
    paddingWhenScrolled.push(wrapper.style.getPropertyValue('--pm-table-header-height'))
  })
  return { wrapper, thead, row, paddingWhenScrolled }
}

describe('scrollRowIntoView', () => {
  it('hands the header height to the stylesheet when it scrolls, so the row stops below it', () => {
    const { wrapper, row, paddingWhenScrolled } = setup(34)
    scrollRowIntoView(wrapper, row)
    expect(row.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' })
    expect(paddingWhenScrolled).toEqual(['34px'])
  })

  it('follows the header when its height changes', () => {
    const { wrapper, thead, row, paddingWhenScrolled } = setup(34)
    scrollRowIntoView(wrapper, row)
    Object.defineProperty(thead, 'offsetHeight', { value: 52, configurable: true })
    scrollRowIntoView(wrapper, row)
    expect(paddingWhenScrolled).toEqual(['34px', '52px'])
  })

  it('still scrolls a row that has no wrapper to pad', () => {
    const { row } = setup(34)
    scrollRowIntoView(null, row)
    expect(row.scrollIntoView).toHaveBeenCalledOnce()
  })
})

describe('stickyHeaderHeight', () => {
  it('is zero for a table without a header', () => {
    expect(stickyHeaderHeight(activeDocument.body.createDiv())).toBe(0)
  })
})
