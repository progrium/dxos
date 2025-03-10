//
// Copyright 2023 DXOS.org
//

import { X } from '@phosphor-icons/react';
import React from 'react';

import { Button, ButtonProps, useTranslation } from '@dxos/aurora';
import { getSize, mx } from '@dxos/aurora-theme';

export const CloseButton = ({ onDone, ...props }: Omit<ButtonProps, 'onClick'> & { onDone?: () => void }) => {
  const { t } = useTranslation('os');
  return (
    <Button
      variant='ghost'
      classNames={mx('plb-0 pli-2 absolute block-start-0 inline-end-0 z-[1]')}
      onClick={() => onDone?.()}
      {...props}
    >
      <X weight='bold' className={getSize(4)} />
      <span className='sr-only'>{t('exit label')}</span>
    </Button>
  );
};
