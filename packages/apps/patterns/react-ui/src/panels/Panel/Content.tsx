//
// Copyright 2023 DXOS.org
//

import React, { PropsWithChildren } from 'react';

import { mx } from '@dxos/react-components';

export type ContentProps = PropsWithChildren & {
  className?: string;
};

export const Content = (props: ContentProps) => {
  return (
    <div role='group' className={mx('grow flex flex-col justify-between gap-y-4', props.className)}>
      {props.children}
    </div>
  );
};
