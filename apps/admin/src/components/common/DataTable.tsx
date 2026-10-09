/**
 * The console's table (admin REQUIREMENTS section 21, DataTable): sortable headings, a row of
 * actions, and a card per row on phones. One set of markup serves both: below the tablet width
 * the rows restyle as cards, and each cell shows its column's name beside it.
 */

// Sort direction icons.
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
// Children type.
import type { ReactNode } from 'react'

/** A column: its heading, its cell, and the sort it offers, if any. */
export interface DataColumn<Row, Field extends string> {
  heading: string
  cell: (row: Row) => ReactNode
  // The field it sorts by, and which way a first press sorts (names A to Z, dates newest first).
  sortField?: Field
  firstSort?: 'ascending' | 'descending'
}

/** A sort: a field, descending when it starts with "-". */
export type SortValue<Field extends string> = Field | `-${Field}`

/** What the table shows. */
interface DataTableProps<Row, Field extends string> {
  // Names the table for screen readers, e.g. "Users: Students".
  label: string
  rows: Row[]
  // Each row's unique key.
  rowKey: (row: Row) => string
  columns: DataColumn<Row, Field>[]
  // The current sort, and how to change it; leave both out for a table that doesn't sort.
  sort?: SortValue<Field>
  onSortChange?: (sort: SortValue<Field>) => void
  // The actions for one row, shown in a last "Actions" column.
  actions?: ((row: Row) => ReactNode) | undefined
}

/** The next sort when a column's heading is pressed: the other direction, or its first sort. */
function nextSort<Field extends string>(
  current: SortValue<Field> | undefined,
  field: Field,
  firstSort: 'ascending' | 'descending' = 'ascending',
): SortValue<Field> {
  // The field's descending form.
  const descending: SortValue<Field> = `-${field}`
  // The same column: flip it.
  if (current === field) return descending
  if (current === descending) return field
  // A new column: its first sort.
  return firstSort === 'descending' ? descending : field
}

/** Whether `field` is the sort, which way, and the icon that says so. */
function sortState(sort: string | undefined, field: string | undefined) {
  // Not this column (or not sortable): the neutral icon.
  if (field === undefined || (sort !== field && sort !== `-${field}`)) {
    return { ariaSort: undefined, Icon: ArrowUpDown }
  }
  // This column, descending.
  if (sort.startsWith('-')) return { ariaSort: 'descending' as const, Icon: ArrowDown }
  // This column, ascending.
  return { ariaSort: 'ascending' as const, Icon: ArrowUp }
}

/** The table. */
export function DataTable<Row, Field extends string = never>({
  label,
  rows,
  rowKey,
  columns,
  sort,
  onSortChange,
  actions,
}: Readonly<DataTableProps<Row, Field>>) {
  return (
    // Explicit table and row roles keep the table's meaning for screen readers when phones
    // restyle it; each cell also carries its column's name as visible text there.
    <table role="table" aria-label={label} className="block w-full text-sm md:table">
      {/* Headings: hidden on phones (each cell names itself), a row on larger screens. */}
      <thead className="sr-only md:not-sr-only md:table-header-group">
        <tr role="row" className="border-b text-left text-muted-foreground">
          {columns.map((column) => {
            // This column's sort state.
            const field = column.sortField
            const { ariaSort, Icon } = sortState(sort, field)
            return (
              <th
                key={column.heading}
                role="columnheader"
                scope="col"
                aria-sort={ariaSort}
                className="px-3 py-2 font-medium"
              >
                {field !== undefined && onSortChange ? (
                  // A sortable heading is a button.
                  <button
                    type="button"
                    onClick={() => {
                      onSortChange(nextSort(sort, field, column.firstSort))
                    }}
                    className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {column.heading}
                    <Icon aria-hidden="true" className="size-3.5" />
                  </button>
                ) : (
                  column.heading
                )}
              </th>
            )
          })}
          {actions && (
            <th role="columnheader" scope="col" className="px-3 py-2 text-right font-medium">
              Actions
            </th>
          )}
        </tr>
      </thead>
      {/* One row per item: a card on phones, a table row on larger screens. */}
      <tbody className="block space-y-3 md:table-row-group md:space-y-0">
        {rows.map((row) => (
          <tr
            key={rowKey(row)}
            role="row"
            className="block rounded-xl border bg-card p-4 md:table-row md:rounded-none md:border-0 md:border-b md:bg-transparent md:p-0"
          >
            {columns.map((column) => (
              <td
                key={column.heading}
                // The column's name, shown beside the value on phones.
                data-label={column.heading}
                className="flex items-center justify-between gap-3 py-1 before:text-muted-foreground before:content-[attr(data-label)] md:table-cell md:px-3 md:py-2.5 md:before:content-none"
              >
                {column.cell(row)}
              </td>
            ))}
            {actions && (
              <td className="flex justify-end pt-2 md:table-cell md:px-3 md:py-2.5 md:text-right">
                {actions(row)}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
