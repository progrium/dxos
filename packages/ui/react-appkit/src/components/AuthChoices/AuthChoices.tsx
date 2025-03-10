//
// Copyright 2022 DXOS.org
//

import { CaretRight, Plus, QrCode, Textbox } from '@phosphor-icons/react';
import React from 'react';

import { useTranslation } from '@dxos/aurora';

import { CompoundButton } from '../CompoundButton';

export interface AuthChoicesProps {
  onCreate?: () => void;
  onJoin?: () => void;
  onRecover?: () => void;
}

export const AuthChoices = ({ onCreate, onJoin, onRecover }: AuthChoicesProps) => {
  const { t } = useTranslation('appkit');

  return (
    <div role='none' className='flex flex-col gap-2 mt-4 px-2'>
      {onCreate && (
        <CompoundButton
          description={t('create identity description')}
          before={<Plus className='w-6 h-6' />}
          after={<CaretRight className='w-4 h-4' weight='bold' />}
          classNames='text-lg w-full'
          onClick={onCreate}
          data-testid='create-identity-button'
        >
          {t('create identity label')}
        </CompoundButton>
      )}
      {onJoin && (
        <CompoundButton
          description={t('join identity description')}
          before={<QrCode className='w-6 h-6' />}
          after={<CaretRight className='w-4 h-4' weight='bold' />}
          classNames='text-lg w-full'
          onClick={onJoin}
          data-testid='join-identity-button'
        >
          {t('join identity label')}
        </CompoundButton>
      )}
      {onRecover && (
        <CompoundButton
          // TODO(mykola): Implement recover.
          disabled={true}
          description={t('recover identity description')}
          before={<Textbox className='w-6 h-6' />}
          after={<CaretRight className='w-4 h-4' weight='bold' />}
          classNames='text-lg w-full'
          onClick={onRecover}
          data-testid='recover-identity-button'
        >
          {t('recover identity label')}
        </CompoundButton>
      )}
    </div>
  );
};
