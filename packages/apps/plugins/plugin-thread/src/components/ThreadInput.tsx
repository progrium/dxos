//
// Copyright 2023 DXOS.org
//

import { PaperPlaneRight } from '@phosphor-icons/react';
import React, { FC, KeyboardEvent, useState } from 'react';

import { Styles } from '@braneframe/plugin-theme';
import { Button, Input, useTranslation } from '@dxos/aurora';
import { getSize, mx } from '@dxos/aurora-theme';

import { THREAD_PLUGIN } from '../props';

export const ThreadInput: FC<{ onMessage: (text: string) => boolean | undefined }> = ({ onMessage }) => {
  const { t } = useTranslation(THREAD_PLUGIN);
  const [text, setText] = useState('');

  const handleMessage = () => {
    const value = text.trim();
    if (value.length && onMessage(value) !== false) {
      setText('');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    switch (event.key) {
      case 'Escape': {
        setText('');
        break;
      }
      case 'Enter': {
        // TODO(burdon): Enter is added to text after message is sent.
        handleMessage();
        break;
      }
    }
  };

  return (
    <div className={mx('flex w-full shadow p-2', Styles.level1.bg)}>
      <div className='w-full'>
        <Input.Root>
          <Input.Label srOnly>{t('block input label')}</Input.Label>
          <Input.TextArea
            autoFocus
            autoComplete='off'
            rows={3}
            variant='subdued'
            classNames='flex-1 is-auto pis-2 border-none resize-none outline-double'
            placeholder='Enter message.'
            value={text}
            onChange={({ target: { value } }) => setText(value)}
            onKeyDown={handleKeyDown}
          />
        </Input.Root>
      </div>
      <div className='shrink-0'>
        <Button density='fine' variant='ghost' onClick={handleMessage}>
          <PaperPlaneRight className={getSize(5)} />
        </Button>
      </div>
    </div>
  );
};
