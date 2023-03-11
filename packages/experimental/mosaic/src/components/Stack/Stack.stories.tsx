//
// Copyright 2023 DXOS.org
//

import faker from 'faker';
import React, { useState } from 'react';

import { range } from '@dxos/util';

import { Item } from '../../layout';
import { createItem, TestData, TestTileContent } from '../../testing';
import { Stack } from './Stack';

faker.seed(100);

const num = 4;

const Test = () => {
  const [items] = useState<Item<TestData>[]>(() => {
    return range(num).map(() => {
      return createItem();
    });
  });

  return <Stack<TestData> items={items} Content={TestTileContent} />;
};

export default {
  component: Stack,
  decorators: [
    (Story: any) => (
      <div className='flex flex-col items-center h-screen w-full bg-white'>
        <div className='w-[500px]'>
          <Story />
        </div>
      </div>
    )
  ],
  parameters: {
    layout: 'fullscreen'
  }
};

export const Default = {
  render: () => <Test />
};
