//
// Copyright 2020 DXOS.org
//

import { Planet } from '@phosphor-icons/react';
import * as localForage from 'localforage';
import React, { FC, ReactNode } from 'react';

import { PublicKey } from '@dxos/keys';
import { Select } from '@dxos/react-appkit';
import { useAsyncEffect } from '@dxos/react-async';
import { useSpaces } from '@dxos/react-client';
import { humanize } from '@dxos/util';

import { useDevtoolsDispatch, useDevtoolsState, useSpacesInfo } from '../hooks';

export const SpaceSelector = () => {
  const spaces = useSpaces({ all: true });
  const spacesInfo = useSpacesInfo();
  const { space } = useDevtoolsState();
  const setState = useDevtoolsDispatch();

  const handleSelect = (spaceKey?: PublicKey) => {
    setState((state) => ({
      ...state,
      space: spaceKey ? spaces.find((space) => space.key.equals(spaceKey)) : undefined,
      spaceInfo: spaceKey ? spacesInfo.find((spaceInfo) => spaceInfo.key.equals(spaceKey)) : undefined,
      feedKey: undefined,
    }));

    if (spaceKey) {
      localForage.setItem('dxos.devtools.spaceKey', spaceKey.toHex());
    }
  };

  useAsyncEffect(async () => {
    const spaceKeyHex: string | null = await localForage.getItem('dxos.devtools.spaceKey');
    if (spaceKeyHex) {
      console.log({ spaceKeyHex, spaces });
      handleSelect(PublicKey.fromHex(spaceKeyHex));
    }
  }, []);

  return (
    <Select
      defaultValue={space?.key?.toHex()}
      placeholder='Select space'
      value={space?.key.toHex()}
      onValueChange={(id) => handleSelect(PublicKey.fromHex(id))}
    >
      {spaces.map((space) => (
        <Select.Item value={space.key.toHex()} key={space.key.toHex()}>
          <div className='flex items-center gap-2'>
            <div className='pr-1'>
              <Planet />
            </div>
            {space.properties.name ?? humanize(space.key)}
            <span className='text-neutral-250'>{space.key.truncate(4)}</span>
          </div>
        </Select.Item>
      ))}
    </Select>
  );
};

export const SpaceToolbar: FC<{ children?: ReactNode }> = ({ children }) => {
  return (
    <div className='flex w-full border-b'>
      <div className='flex-shrink w-[400px] p-2'>
        <SpaceSelector />
      </div>
      <div className='flex-1 p-2 mr-2'>{children}</div>
    </div>
  );
};
