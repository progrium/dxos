//
// Copyright 2023 DXOS.org
//

import React, { useEffect, useMemo, useState } from 'react';

import { Contact, DocumentStack, Message } from '@dxos/kai-types';
import { Button } from '@dxos/react-components';

import { AddressSection, CardProps } from '../../cards';
import { formatShortDate, sortMessage } from '../Message';
import { Stack, StackRow } from '../Stack';

export const ContactStack = ({ space, object }: CardProps<Contact>) => {
  const name = object.name ?? object.email;
  const [stack, setStack] = useState<DocumentStack>();
  useEffect(() => {
    const { objects: stacks } = space.db.query(DocumentStack.filter());
    const stack = stacks.find((stack) => stack.subjectId === object.id);
    setStack(stack);
  }, [object]);

  const messages = useMemo(() => {
    const { objects: messages } = space.db.query(Message.filter());
    return messages.filter((message) => message.from.email === object.email).sort(sortMessage); // TODO(burdon): Check to also.
  }, [object]);
  const handleCreateStack = async () => {
    const stack = await space.db.add(new DocumentStack({ title: object.name, subjectId: object.id }));
    setStack(stack);
  };

  const now = new Date();

  return (
    <div className='flex flex-col w-full'>
      <StackRow className='py-4 border-b'>
        <div className='text-2xl'>{name}</div>
      </StackRow>

      {(object.email !== name || object.username !== undefined) && (
        <StackRow className='py-4 border-b'>
          <div className='flex flex-col text-sm'>
            {object.email && object.email !== name && <div className='text-sky-700'>{object.email}</div>}
            {object.username && <div className='text-sky-700'>{object.username}</div>}
            {object.phone && <div>{object.phone}</div>}
          </div>
        </StackRow>
      )}

      {object.address && (
        <StackRow className='py-4 border-b'>
          <AddressSection address={object.address} />
        </StackRow>
      )}

      {/* TODO(burdon): Icon and Link. */}
      {object.employer && <StackRow className='py-4 border-b'>{object.employer.name}</StackRow>}

      {messages.length > 0 && (
        <StackRow className='py-4'>
          {messages.map((message) => (
            <div key={message.id} className='flex flex-col overflow-hidden items'>
              <div className='flex overflow-hidden items-center'>
                <div className='flex shrink-0 w-[80px] text-sm text-sky-700'>
                  {formatShortDate(now, new Date(message.date))}
                </div>
                <div className='truncate'>{message.subject}</div>
              </div>
            </div>
          ))}
        </StackRow>
      )}

      {stack && (
        <div className='py-4'>
          <Stack space={space} stack={stack} showTitle={false} />
        </div>
      )}

      {!stack && (
        <StackRow className='py-4'>
          <div>
            <Button variant='outline' onClick={() => handleCreateStack()}>
              Create Stack
            </Button>
          </div>
        </StackRow>
      )}
    </div>
  );
};
