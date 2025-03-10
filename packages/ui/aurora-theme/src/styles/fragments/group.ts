//
// Copyright 2023 DXOS.org
//

import { ComponentFragment, Elevation } from '@dxos/aurora-types';

import { surfaceElevation } from './elevation';

export const group: ComponentFragment<{ elevation?: Elevation }> = (props) => [
  props.elevation === 'base'
    ? 'bg-transparent border border-neutral-200 dark:border-neutral-700'
    : 'bg-white dark:bg-neutral-800',
  surfaceElevation(props),
];
