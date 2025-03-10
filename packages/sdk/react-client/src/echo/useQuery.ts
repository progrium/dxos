//
// Copyright 2022 DXOS.org
//

import { useMemo, useSyncExternalStore } from 'react';

import type { QueryOptions, TypedObject, Filter, Query, TypeFilter, Space } from '@dxos/client/echo';

type UseQuery = {
  <T extends TypedObject>(space?: Space, filter?: TypeFilter<T>, options?: QueryOptions, deps?: any[]): T[];
  <T extends TypedObject>(space?: Space, filter?: Filter<T>, options?: QueryOptions, deps?: any[]): TypedObject[];
};

/**
 * Create subscription.
 */
// TODO(burdon): Support typed operator filters (e.g., Note.filter(note => ...)).
export const useQuery: UseQuery = <T extends TypedObject>(
  space?: Space,
  filter?: TypeFilter<T> | Filter<T>,
  options?: QueryOptions,
  deps?: any[],
) => {
  const query = useMemo(
    () => space?.db.query(filter ?? {}, options) as Query<T> | undefined,
    [space?.db, ...(typeof filter === 'function' ? [] : filterToDepsArray(filter)), ...(deps ?? [])],
  );

  // https://beta.reactjs.org/reference/react/useSyncExternalStore
  return (
    useSyncExternalStore<T[] | undefined>(
      (cb) => query?.subscribe?.(cb) ?? cb,
      () => query?.objects,
    ) ?? []
  );
};

const filterToDepsArray = (filter?: Filter<any>) => Object.entries(filter ?? {}).flat();
