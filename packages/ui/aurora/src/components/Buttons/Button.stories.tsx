//
// Copyright 2022 DXOS.org
//

import '@dxosTheme';

import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import React, { PropsWithChildren } from 'react';

import { chromeSurface, groupSurface, mx, surfaceElevation } from '@dxos/aurora-theme';

import { Button, ButtonGroup, ButtonProps } from './Button';
import { DensityProvider } from '../DensityProvider';
import { ElevationProvider } from '../ElevationProvider';

export default {
  component: Button,
};

const Container = ({ children }: PropsWithChildren<{}>) => (
  <>
    <div role='group' className={mx('flex flex-col gap-4 mbe-4 p-4')}>
      <ElevationProvider elevation='base'>
        <div className='flex gap-4'>{children}</div>
        <DensityProvider density='fine'>
          <div className='flex gap-4'>{children}</div>
        </DensityProvider>
      </ElevationProvider>
    </div>
    <div
      role='group'
      className={mx('flex flex-col gap-4 mbe-4 p-4 rounded-lg', groupSurface, surfaceElevation({ elevation: 'group' }))}
    >
      <ElevationProvider elevation='group'>
        <div className='flex gap-4'>{children}</div>
        <DensityProvider density='fine'>
          <div className='flex gap-4'>{children}</div>
        </DensityProvider>
      </ElevationProvider>
    </div>
    <div
      role='group'
      className={mx(
        'flex flex-col gap-4 mbe-4 p-4 rounded-lg',
        chromeSurface,
        surfaceElevation({ elevation: 'chrome' }),
      )}
    >
      <ElevationProvider elevation='chrome'>
        <div className='flex gap-4'>{children}</div>
        <DensityProvider density='fine'>
          <div className='flex gap-4'>{children}</div>
        </DensityProvider>
      </ElevationProvider>
    </div>
  </>
);

export const Default = {
  render: ({ children, ...args }: Omit<ButtonProps, 'ref'>) => (
    <Container>
      <Button {...args}>{children}</Button>
      <Button {...args} disabled>
        Disabled
      </Button>
      {(args.variant === 'default' || args.variant === 'primary') && (
        <ButtonGroup>
          <Button {...args}>
            <CaretLeft />
          </Button>
          <Button {...args}>
            <CaretRight />
          </Button>
        </ButtonGroup>
      )}
    </Container>
  ),
  args: { children: 'Hello', disabled: false, variant: 'default' },
};

export const Primary = { ...Default, args: { variant: 'primary', children: 'Hello' } };

export const Outline = { ...Default, args: { variant: 'outline', children: 'Hello' } };

export const Ghost = { ...Default, args: { variant: 'ghost', children: 'Hello' } };
