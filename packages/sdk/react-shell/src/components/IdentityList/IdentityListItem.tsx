//
// Copyright 2023 DXOS.org
//

import React, { forwardRef } from 'react';

import { ListItem, Avatar, useJdenticonHref, useId } from '@dxos/aurora';
import { mx } from '@dxos/aurora-theme';
import { generateName } from '@dxos/display-name';
import { SpaceMember } from '@dxos/react-client/echo';
import { Identity } from '@dxos/react-client/halo';

type IdentityListItemProps = {
  identity: Identity;
  presence?: SpaceMember['presence'];
  onClick?: () => void;
};

export const IdentityListItem = forwardRef<HTMLLIElement, IdentityListItemProps>(
  ({ identity, presence, onClick }: IdentityListItemProps, forwardedRef) => {
    const fallbackValue = identity.identityKey.toHex();
    const labelId = useId('identityListItem__label');
    const jdenticon = useJdenticonHref(fallbackValue ?? '', 12);
    const displayName = identity.profile?.displayName ?? generateName(identity.identityKey.toHex());
    return (
      <ListItem.Root
        classNames={mx('rounded p-2 flex gap-2 items-center', onClick && 'cursor-pointer')}
        onClick={() => onClick?.()}
        data-testid='identity-list-item'
        labelId={labelId}
        ref={forwardedRef}
      >
        <Avatar.Root status={presence === SpaceMember.PresenceState.ONLINE ? 'active' : 'inactive'} labelId={labelId}>
          <Avatar.Frame>
            <Avatar.Fallback href={jdenticon} />
          </Avatar.Frame>
          <Avatar.Label classNames='text-sm truncate pli-2'>{displayName}</Avatar.Label>
        </Avatar.Root>
      </ListItem.Root>
    );
  },
);
