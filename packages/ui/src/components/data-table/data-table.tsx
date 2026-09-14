import { useMemo, useState, type ReactNode } from "react";
import { cx } from "../../internal/cx.js";
import { Button } from "../button/button.js";
import { EmptyState } from "../empty-state/empty-state.js";
import { Icon } from "../../internal/icons.js";
import { Table, type TableDensity } from "../table/table.js";
import { TextField } from "../text-field/text-field.js";

export type DataTableAlign = "start" | "center" | "end";
export type SortDirection = "asc" | "desc";

export interface DataTableColumn<Row> {
  /** Stable key. Also the sort key, unless `sortValue` says otherwise. */
  id: string;
  header: ReactNode;
  /** What to draw in the cell. Return a node; return a string for the simple case. */
  cell: (row: Row) => ReactNode;
  /** What to sort and search on. Defaults to the cell's value when it is a string or number. */
  value?: (row: Row) => string | number | null | undefined;
  align?: DataTableAlign;
  /** Off by default: a column is only sortable when it says it is, so the affordance means something. */
  sortable?: boolean;
  /** A fixed width, e.g. `8rem`. Without one the column takes what it needs. */
  width?: string;
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  /** Stable identity per row. Without it the index is used, which breaks selection across a sort. */
  rowKey?: (row: Row, index: number) => string;
  /** Show the search field, which filters across every column that can produce a value. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Rows per page. Omit for no paging. */
  pageSize?: number;
  density?: TableDensity;
  /** Required: a table needs a name for anyone not looking at it. */
  label: string;
  /** What to show when there are no rows at all, before any filtering. */
  empty?: ReactNode;
  onRowClick?: (row: Row) => void;
  className?: string;
}

/**
 * A table that sorts, searches and pages.
 *
 * `Table` is the styled element and stays that: markup, density, alignment. Everything above it, the sort
 * state, the filter, the page window and the two different empty states, is what every operator screen
 * rewrites by hand, so it lives here once. The column decides what it shows and what it sorts on, which
 * keeps a formatted cell (a date, a currency, a badge) sortable by its underlying value.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  searchable = false,
  searchPlaceholder = "Search",
  pageSize,
  density = "md",
  label,
  empty,
  onRowClick,
  className,
}: DataTableProps<Row>) {
  const [sort, setSort] = useState<{ id: string; direction: SortDirection } | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const valueOf = (column: DataTableColumn<Row>, row: Row): string | number | null | undefined => {
    if (column.value) return column.value(row);
    const drawn = column.cell(row);
    return typeof drawn === "string" || typeof drawn === "number" ? drawn : undefined;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => columns.some((c) => String(valueOf(c, row) ?? "").toLowerCase().includes(q)));
    // valueOf is derived from columns, which is in the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => c.id === sort.id);
    if (!column) return filtered;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const x = valueOf(column, a);
      const y = valueOf(column, b);
      // Missing values sort last whichever way the column is pointing, because "no value" is not a value.
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * direction;
      return String(x).localeCompare(String(y), undefined, { numeric: true }) * direction;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, columns, sort]);

  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = pageSize ? sorted.slice(current * pageSize, current * pageSize + pageSize) : sorted;

  const toggleSort = (id: string) => {
    setPage(0);
    setSort((s) => (s?.id !== id ? { id, direction: "asc" } : s.direction === "asc" ? { id, direction: "desc" } : null));
  };

  return (
    <div className={cx("z-datatable", className)} data-density={density}>
      {searchable && (
        <div className="z-datatable__tools">
          <TextField
            className="z-datatable__search"
            size="sm"
            label="Search"
            aria-label={`Search ${label}`}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            leadingIcon={<Icon.Search />}
          />
          <p className="z-datatable__count" role="status">
            {sorted.length} {sorted.length === 1 ? "row" : "rows"}
            {query.trim() ? ` matching “${query.trim()}”` : ""}
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        (empty ?? <EmptyState size="sm" title="Nothing here yet" />)
      ) : sorted.length === 0 ? (
        <EmptyState size="sm" icon={<Icon.Search />} title={`Nothing matches “${query.trim()}”`} description="Try a shorter term." />
      ) : (
        <Table density={density} aria-label={label}>
          <Table.Head>
            <Table.Row>
              {columns.map((c) => (
                <Table.HeadCell
                  key={c.id}
                  align={c.align}
                  style={c.width ? { width: c.width } : undefined}
                  aria-sort={sort?.id === c.id ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                >
                  {c.sortable ? (
                    <Button
                      className="z-datatable__sort"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort(c.id)}
                      trailingIcon={sort?.id === c.id ? (sort.direction === "asc" ? <Icon.ArrowUp /> : <Icon.ArrowDown />) : undefined}
                    >
                      {c.header}
                    </Button>
                  ) : (
                    c.header
                  )}
                </Table.HeadCell>
              ))}
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {visible.map((row, i) => (
              <Table.Row
                key={rowKey ? rowKey(row, i) : String(i)}
                {...(onRowClick ? { onClick: () => onRowClick(row), interactive: true } : {})}
              >
                {columns.map((c) => (
                  <Table.Cell key={c.id} align={c.align}>
                    {c.cell(row)}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {pageSize && pages > 1 && (
        <nav className="z-datatable__pager" aria-label={`${label} pages`}>
          <Button variant="soft" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)} leadingIcon={<Icon.ArrowLeft />}>
            Previous
          </Button>
          <span className="z-datatable__page">
            Page {current + 1} of {pages}
          </span>
          <Button variant="soft" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} trailingIcon={<Icon.ArrowRight />}>
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
