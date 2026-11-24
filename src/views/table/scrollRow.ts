/** How tall the table's sticky header is, which rows scrolled to the top would sit beneath. */
export function stickyHeaderHeight(wrapper: HTMLElement): number {
  const thead = wrapper.querySelector('thead')
  return thead instanceof HTMLElement ? thead.offsetHeight : 0
}

/**
 * Scrolls a row into view by the least that shows it whole. The header is sticky, so a row
 * scrolled flush to the top would be hidden behind it; the stylesheet pads the scroll area by
 * the height given here, so the row stops below the header instead.
 */
export function scrollRowIntoView(wrapper: HTMLElement | null, row: HTMLElement): void {
  wrapper?.setCssProps({ '--pm-table-header-height': `${stickyHeaderHeight(wrapper)}px` })
  row.scrollIntoView({ block: 'nearest' })
}
