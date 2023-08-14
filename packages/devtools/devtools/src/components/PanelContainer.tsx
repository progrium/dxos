//
// Copyright 2023 DXOS.org
//

import React, { FC, ReactNode } from 'react';

import { mx } from '@dxos/aurora-theme';

export const PanelContainer: FC<{ toolbar?: ReactNode; children: ReactNode; className?: string }> = ({
  toolbar,
  children,
  className,
}) => {
  return (
    <div className='flex flex-col grow overflow-hidden'>
      {toolbar}
      <div className={mx('flex flex-col grow overflow-auto', className)}>{children}</div>
    </div>
  );
};
