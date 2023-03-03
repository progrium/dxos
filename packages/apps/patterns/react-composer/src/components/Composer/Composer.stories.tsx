//
// Copyright 2022 DXOS.org
//

import '@dxosTheme';
import React, { useEffect } from 'react';

import { PublicKey, Text } from '@dxos/client';
import { useQuery, useSpace } from '@dxos/react-client';
import { ClientSpaceDecorator } from '@dxos/react-client/testing';
import { mx } from '@dxos/react-components';

import { ComposerDocument, schema } from '../../testing';
import { Composer, ComposerProps } from './Composer';

export default {
  component: Composer,
  argTypes: {}
};

const Story = ({ spaceKey, id, ...args }: Omit<ComposerProps, 'item'> & { spaceKey?: PublicKey; id?: number }) => {
  const space = useSpace(spaceKey);
  // TODO(burdon): Update on mutation?
  const [document] = useQuery(space, ComposerDocument.filter());
  useEffect(() => {
    if (space && id === 0) {
      setTimeout(async () => {
        // TODO(burdon): Auto-create document.
        const document = new ComposerDocument({ content: new Text() });
        await space?.db.add(document);
      });
    }
  }, [space]);

  if (!document?.content) {
    return null;
  }

  // TODO(burdon): Show documents for each client?
  return (
    <main className='grow p-4'>
      {document && space && (
        <Composer
          {...args}
          document={document.content}
          slots={{
            editor: {
              className: mx(
                'z-0 rounded bg-white text-neutral-900 w-full p-4 dark:bg-neutral-850 dark:text-white min-bs-[12em]',
                args.slots?.editor?.className
              )
            }
          }}
        />
      )}
    </main>
  );
};

// TODO(wittjosiah): Increasing count to 2, the second peer does not sync the document content.
export const Default = {
  render: Story,
  decorators: [ClientSpaceDecorator({ schema, count: 1 })]
};
