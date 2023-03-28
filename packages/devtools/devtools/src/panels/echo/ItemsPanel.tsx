//
// Copyright 2020 DXOS.org
//

import React, { useState } from 'react';

import { TypedObject } from '@dxos/client';
import { truncateKey } from '@dxos/debug';
import { useQuery } from '@dxos/react-client';
import { TreeView, TreeViewItem, Searchbar } from '@dxos/react-components';

import { DetailsTable, JsonView } from '../../components';
import { SpaceToolbar } from '../../containers';
import { useDevtoolsState } from '../../hooks';

// TODO(burdon): Factor out.

const textFilter = (text?: string) => {
  if (!text) {
    return () => true;
  }

  const matcher = new RegExp(text, 'i');
  return (item: TreeViewItem) => {
    const match = item.title?.match(matcher);
    return match !== null;
  };
};

// TODO(burdon): Rationalize with new API.
const getItemType = (doc: TypedObject) => doc.__typename;
const getItemDetails = (item: TypedObject) => ({
  id: truncateKey(item.id),
  type: item.__typename,
  deleted: String(Boolean(item.__deleted)),
  properties: <JsonView data={item.toJSON()} />
});

const getHierarchicalItem = (item: TypedObject): TreeViewItem => ({
  id: item.id,
  title: getItemType(item) || 'Unknown type',
  value: item
});

const ItemsPanel = () => {
  const { space } = useDevtoolsState();
  // TODO(burdon): Sort by type?
  // TODO(burdon): Filter deleted.
  const items = useQuery(space);
  const [selectedItem, setSelectedItem] = useState<TypedObject>();
  const [filter, setFilter] = useState('');

  return (
    <div className='flex flex-1 flex-col overflow-hidden'>
      <SpaceToolbar>
        <div className='w-1/2'>
          <Searchbar onSearch={setFilter} />
        </div>
      </SpaceToolbar>

      <div className='flex h-full overflow-hidden'>
        <div className='flex flex-col w-1/3 overflow-auto border-r'>
          {/* TODO(burdon): Convert to list with new API. */}
          <TreeView
            items={items.map(getHierarchicalItem).filter(textFilter(filter))}
            onSelect={(item: any) => setSelectedItem(item.value)}
            selected={selectedItem?.id}
          />
        </div>

        {selectedItem && (
          <div className='flex flex-1 flex-col w-2/3 overflow-auto'>
            <DetailsTable object={getItemDetails(selectedItem)} expand />
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemsPanel;
