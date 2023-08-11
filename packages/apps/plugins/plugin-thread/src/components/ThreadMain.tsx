//
// Copyright 2023 DXOS.org
//

import differenceInSeconds from 'date-fns/differenceInSeconds';
import React, { FC } from 'react';

import { Thread as ThreadType, Document as DocumentType } from '@braneframe/types';
import { Main } from '@dxos/aurora';
import { baseSurface, fullSurface } from '@dxos/aurora-theme';
import { PublicKey } from '@dxos/react-client';
import { SpaceProxy } from '@dxos/react-client/echo';
import { useIdentity } from '@dxos/react-client/halo';

import { ThreadChannel } from './ThreadChannel';

// TODO(burdon): Goals.
// - Usable within a single column which may be visible in the sidebar of another content block (e.g., document).
// - Create and navigate between threads.
// - Lightweight threads for document comments, inline AI, etc.
//    (Similar reusable components everywhere; same data structure).

export const ThreadMain: FC<{ data: { space: SpaceProxy; object: ThreadType } }> = ({
  data: { space, object: thread },
}) => {
  const identity = useIdentity(); // TODO(burdon): Requires context for storybook?
  const identityKey = identity!.identityKey;
  // const identityKey = PublicKey.random().toHex();

  const handleAddDocument = (text: string): boolean => {
    const document = new DocumentType({
      title: text,
    });
    space.db.add(document);
    return true;
  };

  // TODO(burdon): Change to model.
  const handleAddMessage = (text: string) => {
    const message = {
      timestamp: new Date().toISOString(),
      text,
    };

    // Update current block if same user and time > 3m.
    const period = 3 * 60; // TODO(burdon): Config.
    const block = thread.blocks[thread.blocks.length - 1];
    if (block?.identityKey && PublicKey.equals(block.identityKey, identityKey)) {
      const previous = block.messages[block.messages.length - 1];
      if (
        previous.timestamp &&
        differenceInSeconds(new Date(message.timestamp), new Date(previous.timestamp)) < period
      ) {
        block.messages.push(message);
        return true;
      }
    }

    thread.blocks.push(
      new ThreadType.Block({
        identityKey: identityKey.toHex(),
        messages: [message],
      }),
    );

    // TODO(burdon): Scroll to bottom.
    return true;
  };

  return (
    <Main.Content classNames={[fullSurface, baseSurface]}>
      <ThreadChannel
        identityKey={identityKey}
        thread={thread}
        onAddMessage={handleAddMessage}
        onAddDocument={handleAddDocument}
      />
    </Main.Content>
  );
};
