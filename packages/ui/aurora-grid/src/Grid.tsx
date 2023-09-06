//
// Copyright 2023 DXOS.org
//

import {
  ColumnDef,
  Row,
  RowData,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
  VisibilityState,
  ColumnSizingInfoState,
  getGroupedRowModel,
  HeaderGroup,
  TableState,
} from '@tanstack/react-table';
import React, { Fragment, useEffect, useRef, useState } from 'react';

import { inputSurface, mx } from '@dxos/aurora-theme';

import { defaultGridSlots, GridSlots } from './theme';

// Meta definition.
declare module '@tanstack/react-table' {
  // Access via table.options.meta.
  interface TableMeta<TData extends RowData> {
    keyAccessor?: KeyValue<TData>;
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    expand?: boolean;
    resizable?: boolean;
    slots?: {
      header?: {
        className?: string;
      };
      footer?: {
        className?: string;
      };
      cell?: {
        className?: string;
      };
    };
  }
}

export type GridColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<TData, TValue>;

// TODO(burdon): Sort/filter.
// TODO(burdon): Drag-and-drop.
// TODO(burdon): Virtual (e.g., log panel).

export type GridSelection<TData extends RowData> = {
  // Controlled if undefined (by default).
  select?: 'single' | 'single-toggle' | 'multiple' | 'multiple-toggle' | undefined;
  selected?: TData[];
  onSelectedChange?: (selected: TData[] | undefined) => void;
};

/**
 * Util to update the selection based on the mode.
 */
export const updateSelection = (
  selectionState: RowSelectionState,
  id: string,
  selection: GridSelection<any>['select'],
): RowSelectionState => {
  switch (selection) {
    case 'single': {
      return {
        [id]: true,
      };
    }
    case 'single-toggle': {
      return selectionState[id]
        ? {}
        : {
            [id]: true,
          };
    }
    case 'multiple': {
      return {
        [id]: true,
        ...selectionState,
      };
    }
    case 'multiple-toggle': {
      if (selectionState[id]) {
        const newSelectionState = { ...selectionState };
        delete newSelectionState[id];
        return newSelectionState;
      } else {
        return {
          [id]: true,
          ...selectionState,
        };
      }
    }
  }

  return selectionState;
};

const defaultColumn: Partial<ColumnDef<RowData>> = {
  size: 200, // NOTE: Required in order remove default width.
  maxSize: 800,
};

export type KeyValue<TData extends RowData> = (row: Row<TData>) => string | number;

// TODO(burdon): Key selector.
export type GridProps<TData extends RowData> = {
  keyAccessor?: KeyValue<TData>;
  columns?: GridColumnDef<TData>[];
  columnVisibility?: VisibilityState;
  grouping?: string[];
  data?: TData[];
  slots?: GridSlots;
  header?: boolean;
  footer?: boolean;
  onColumnResize?: (state: Record<string, number>) => void;
  border?: boolean;
  fullWidth?: boolean;
  pinToBottom?: boolean;
  debug?: boolean;
} & GridSelection<TData>;

/**
 * Simple table.
 */
export const Grid = <TData extends RowData>(props: GridProps<TData>) => {
  const {
    keyAccessor = (row) => row.id,
    columns = [],
    data = [],
    columnVisibility,
    grouping = [],
    slots = defaultGridSlots,
    footer = false,
    select,
    selected,
    onColumnResize,
    onSelectedChange,
    fullWidth,
    pinToBottom,
    debug,
  } = props;

  const [focus, setFocus] = useState<string>();

  // Update controlled selection.
  // https://tanstack.com/table/v8/docs/api/features/row-selection
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  useEffect(() => {
    setRowSelection(
      selected?.reduce((selectionState: RowSelectionState, selected) => {
        const row = table.getRowModel().rows.find((row) => row.original === selected);
        if (row) {
          selectionState[row.id] = true;
        }
        return selectionState;
      }, {}) ?? {},
    );
  }, [select, selected]);

  // Resizing.
  const [columnSizingInfo, setColumnSizingInfo] = useState<ColumnSizingInfoState>({} as ColumnSizingInfoState);
  useEffect(() => {
    if (columnSizingInfo.columnSizingStart?.length === 0) {
      onColumnResize?.(table.getState().columnSizing);
    }
  }, [columnSizingInfo]);

  // Update table model.
  // https://tanstack.com/table/v8/docs/api/core/table
  const table = useReactTable({
    data,
    columns,
    defaultColumn: defaultColumn as Partial<ColumnDef<TData>>,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      keyAccessor,
    },

    // TODO(burdon): Pagination.
    // TODO(burdon): Sorting.
    // TODO(burdon): Filtering.
    state: {
      columnVisibility,
      columnSizingInfo,
      rowSelection,
      grouping,
    },

    // Grouping.
    getGroupedRowModel: getGroupedRowModel(),

    // Selection.
    enableRowSelection: select === 'single' || select === 'single-toggle',
    enableMultiRowSelection: select === 'multiple' || select === 'multiple-toggle',
    onRowSelectionChange: (rows) => {
      setRowSelection(rows);
    },

    // Resize columns.
    // TODO(burdon): Drag to re-order columns.
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    onColumnSizingInfoChange: setColumnSizingInfo,

    debugTable: debug,
  });

  // TODO(burdon): Add flex if not resizable.
  // Create additional expansion column if all columns have fixed width.
  const expand = false; // columns.map((column) => column.size).filter(Boolean).length === columns?.length;

  // Pin scrollbar to bottom.
  const containerRef = usePinToBottom(data, pinToBottom);

  const handleSelect = (row: Row<TData>) => {
    if (select) {
      // Uncontrolled.
      setRowSelection((selectionState: RowSelectionState) => {
        const newSelectionState = updateSelection(selectionState, row.id, select);
        if (onSelectedChange) {
          const rows: TData[] = Object.keys(newSelectionState).map((id) => table.getRowModel().rowsById[id].original);
          onSelectedChange(rows);
        }

        return newSelectionState;
      });
    } else {
      // Controlled.
      onSelectedChange?.([row.original]);
    }
  };

  // TODO(burdon): Use radix ScrollArea.
  // https://www.radix-ui.com/primitives/docs/components/scroll-area
  return (
    <div ref={containerRef} className={mx('grow overflow-auto', inputSurface, slots?.root?.className)}>
      <table
        // Styles:
        // table-fixed: Prevents fixed sized columns from shrinking.
        className={mx(!fullWidth && 'table-fixed ', 'border-collapse', slots?.table?.className)}
        style={{
          width: fullWidth ? '100%' : table.getTotalSize(),
        }}
      >
        <THead {...props} state={table.getState()} headers={table.getHeaderGroups()} />

        {(table.getState().grouping?.length === 0 && (
          <TBody
            {...props}
            keyAccessor={keyAccessor}
            rowSelection={rowSelection}
            expand={expand}
            focus={focus}
            onFocus={setFocus}
            onSelect={handleSelect}
            rows={table.getRowModel().rows}
          />
        )) || (
          <>
            {table.getGroupedRowModel().rows.map((row, i) => {
              return (
                <Fragment key={i}>
                  {/* TODO(burdon): Customize group header renderer. */}
                  <thead>
                    <tr>
                      {slots?.margin && <th className={mx(slots?.margin?.className)} />}
                      {debug && <th />}
                      <th
                        // TODO(burdon): Calculate row span.
                        colSpan={table.getHeaderGroups()[0].headers.length}
                        className={mx('text-left', slots?.group?.className)}
                      >
                        {JSON.stringify(row.getGroupingValue(table.getState().grouping[0]))}
                      </th>
                    </tr>
                  </thead>

                  <TBody
                    {...props}
                    keyAccessor={keyAccessor}
                    rowSelection={rowSelection}
                    expand={expand}
                    focus={focus}
                    onFocus={setFocus}
                    onSelect={handleSelect}
                    rows={row.subRows}
                  />
                </Fragment>
              );
            })}
          </>
        )}

        {footer && <TFoot {...props} footers={table.getFooterGroups()} />}
      </table>

      {debug && (
        <pre className='font-mono text-xs text-neutral-500 my-4 p-2 ring'>
          <code>{JSON.stringify(table.getState(), undefined, 2)}</code>
        </pre>
      )}
    </div>
  );
};

/**
 * Glue to bottom as rows are added.
 */
// TODO(burdon): Causes scrollbar to be constantly visible.
//  https://css-tricks.com/books/greatest-css-tricks/pin-scrolling-to-bottom
const usePinToBottom = <TData extends RowData>(data: TData[], pinToBottom?: boolean) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stickyScrolling, setStickyScrolling] = useState(true);
  useEffect(() => {
    const container = containerRef.current;
    if (!pinToBottom || !container) {
      return;
    }

    // TODO(burdon): Set when scrolled to bottom and unset when manually scrolled away.
    const handler = () => {
      const bottom = container.scrollHeight - container.scrollTop - container.clientHeight === 0;
      setStickyScrolling(bottom);
    };

    container.addEventListener('scroll', handler);
    return () => container.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    if (!pinToBottom || !containerRef.current || !stickyScrolling) {
      return;
    }

    containerRef.current?.scroll({ top: containerRef.current.scrollHeight });
  }, [data]);

  return containerRef;
};

//
// Head.
//

type THeadProps<TData extends RowData> = Partial<GridProps<TData>> & {
  state: TableState;
  headers: HeaderGroup<TData>[];
  expand?: boolean;
};

const THead = <TData extends RowData>({
  state,
  headers,
  expand,
  header,
  debug,
  fullWidth,
  border,
  slots,
}: THeadProps<TData>) => {
  return (
    <thead className={mx(header ? ['sticky top-0 z-10'] : 'collapse')}>
      {headers.map((headerGroup) => {
        return (
          // Group element to hover resize handles.
          <tr key={headerGroup.id} className='font-light group'>
            {slots?.margin && <th className={mx(slots?.margin?.className)} />}

            {/* TODO(burdon): Calc. width. */}
            {debug && (
              <th className='text-left' style={{ width: 32 }}>
                #
              </th>
            )}

            {headerGroup.headers.map((header) => {
              return (
                <th
                  key={header.id}
                  style={{
                    // Don't set width if fullWidth and no explicit size.
                    width: fullWidth && header.column.columnDef.meta?.expand ? undefined : header.getSize(),
                  }}
                  // Relative for resize handle.
                  className={mx(
                    'relative text-left',
                    border && 'border',
                    slots?.header?.className,
                    header.column.columnDef.meta?.slots?.header?.className,
                  )}
                >
                  {!header || header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}

                  {/*
                   * Resize handle.
                   * https://codesandbox.io/p/sandbox/github/tanstack/table/tree/main/examples/react/column-sizing
                   */}
                  {header.column.columnDef.meta?.resizable && (
                    <div
                      className={mx(
                        'absolute top-0 pl-1 h-full z-[10] w-[7px] -right-[5px] _bg-neutral-500',
                        'cursor-col-resize select-none touch-none opacity-20 hover:opacity-100',
                        header.column.getIsResizing() && 'hidden',
                      )}
                      style={{
                        transform: header.column.getIsResizing()
                          ? `translateX(${state.columnSizingInfo.deltaOffset}px)`
                          : undefined,
                      }}
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                    >
                      <div className='flex group-hover:bg-neutral-700 -ml-[2px] w-[1px] h-full' />
                    </div>
                  )}
                </th>
              );
            })}
            {expand && <th />}
            {slots?.margin && <th className={mx(slots?.margin?.className)} />}
          </tr>
        );
      })}
    </thead>
  );
};

//
// Body.
//

type TBodyProps<TData extends RowData> = Partial<GridProps<TData>> & {
  rows: Row<TData>[];
  rowSelection: RowSelectionState;
  expand?: boolean;
  focus?: string;
  onFocus: (id?: string) => void;
  onSelect: (row: Row<TData>) => void;
};

const TBody = <TData extends RowData>({
  rows,
  rowSelection,
  focus,
  onFocus,
  onSelect,
  keyAccessor,
  debug,
  border,
  expand,
  slots,
}: TBodyProps<TData>) => {
  return (
    <tbody>
      {rows.map((row) => {
        return (
          <tr
            key={keyAccessor?.(row)}
            onClick={() => onSelect(row)}
            role='button'
            className={mx(
              'group',
              rowSelection[row.id] && slots?.selected?.className,
              focus === row.id && slots?.focus?.className,
              slots?.row?.className,
            )}
          >
            {/* TODO(burdon): Dummy button for focus (don't alter geometry). */}
            {slots?.margin && (
              <td className={mx(slots?.margin?.className)}>
                <button
                  role='button'
                  style={{ width: 1, height: 1 }}
                  className='focus:outline-none'
                  onFocus={() => onFocus(row.id)} // TODO(burdon): Use keyAccessor?
                  onBlur={() => onFocus(undefined)}
                  onKeyDown={(event) => {
                    // TODO(burdon): Move focus.
                    switch (event.key) {
                      case 'ArrowUp': {
                        break;
                      }
                      case 'ArrowDown': {
                        break;
                      }
                    }
                  }}
                />
              </td>
            )}

            {debug && <td>{row.id}</td>}

            {row.getVisibleCells().map((cell) => {
              // TODO(burdon): Allow class override from column.
              return (
                <td
                  key={cell.id}
                  className={mx(
                    border && 'border',
                    slots?.cell?.className,
                    cell.column.columnDef.meta?.slots?.cell?.className,
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              );
            })}

            {expand && <td />}
            {slots?.margin && <td className={mx(slots?.margin?.className)} />}
          </tr>
        );
      })}
    </tbody>
  );
};

//
// Footer
//

type TFootProps<TData extends RowData> = Partial<GridProps<TData>> & {
  footers: HeaderGroup<TData>[];
  expand?: boolean;
};

const TFoot = <TData extends RowData>({ footers, expand, slots, debug, border }: TFootProps<TData>) => {
  return (
    <tfoot className={mx('sticky bottom-0 z-[10]', slots?.footer?.className)}>
      {footers.map((footerGroup) => (
        <tr key={footerGroup.id} className='font-thin'>
          {slots?.margin && <th className={mx(slots?.margin?.className)} />}
          {debug && <th />}

          {footerGroup.headers.map((footer) => {
            return (
              <th
                key={footer.id}
                className={mx(
                  border && 'border',
                  'text-left',
                  slots?.footer?.className,
                  footer.column.columnDef.meta?.slots?.footer?.className,
                )}
              >
                {footer.isPlaceholder ? null : flexRender(footer.column.columnDef.footer, footer.getContext())}
              </th>
            );
          })}

          {expand && <th />}
          {slots?.margin && <th className={mx(slots?.margin?.className)} />}
        </tr>
      ))}
    </tfoot>
  );
};
