//
// Copyright 2023 DXOS.org
//

import React, { ForwardedRef, forwardRef } from 'react';

import { Avatar, useId, useJdenticonHref } from '@dxos/aurora';
import { mx } from '@dxos/aurora-theme';
import type { Space } from '@dxos/react-client/echo';
import { humanize } from '@dxos/util';

export const SpaceListItem = forwardRef(
  ({ space, onClick }: { space: Space; onClick?: () => void }, ref: ForwardedRef<HTMLLIElement>) => {
    const fallbackValue = space.key.toHex();
    const labelId = useId('identityListItem__label');
    const jdenticon = useJdenticonHref(fallbackValue ?? '', 12);
    const displayName = space.properties.name ?? humanize(space.key.toHex());

    return (
      <li
        className={mx('flex gap-2 items-center mbe-2', onClick && 'cursor-pointer')}
        onClick={() => onClick?.()}
        ref={ref}
        data-testid='space-list-item'
      >
        <Avatar.Root labelId={labelId}>
          <Avatar.Frame>
            <Avatar.Fallback href={jdenticon} />
          </Avatar.Frame>
          <Avatar.Label classNames='text-sm truncate'>{displayName}</Avatar.Label>
        </Avatar.Root>
      </li>
    );
  },
);
