//
// Copyright 2022 DXOS.org
//

import { DndContext } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { EchoSchemaType, useConfig, useQuery, withReactor } from '@dxos/react-client';
import { DragEndEvent, Input, mx } from '@dxos/react-components';

import { createPath, useAppRouter } from '../../hooks';
import { Contact, Document as DocumentType, DocumentStack, Table, TaskList } from '../../proto';
import { StackContent } from './StackContent';
import { SortableStackRow, StackRow } from './StackRow';

// TODO(burdon): Configurable menu options and section renderers (like frames).
// TODO(burdon): Factor out new section data factories.
// TODO(burdon): Factor out components: from other frames, editable task list, etc. Pure vs containers.

export const StackFrame = withReactor(() => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { space, frame, objectId } = useAppRouter();
  const config = useConfig();

  // TODO(burdon): Arrow of documents (part of stack).
  const stacks = useQuery(space, DocumentStack.filter());
  const documents = useQuery(space, DocumentType.filter());

  const stack = objectId ? (space!.db.getObjectById(objectId) as DocumentStack) : undefined;
  useEffect(() => {
    if (space && frame && !stack) {
      setTimeout(async () => {
        let stack = stacks[0];
        if (!stacks.length) {
          stack = await space.db.add(new DocumentStack());
          // TODO(burdon): Cannot add documents directly (recursion bug).
          documents.forEach((document) => stack.sections.push({ objectId: document.id }));
        }

        navigate(createPath({ spaceKey: space.key, frame: frame.module.id, objectId: stack.id }));
      });
    }
  }, [space, frame, stacks, stack]);

  // TODO(burdon): Drag (mosaic).
  const handleInsertSection = async (type: EchoSchemaType, objectId: string | undefined, index: number) => {
    if (stack) {
      if (!objectId) {
        switch (type) {
          case DocumentType.type: {
            const object = await space!.db.add(new DocumentType());
            objectId = object.id;
            break;
          }

          case Table.type: {
            const object = await space!.db.add(new Table({ type: Contact.type.name }));
            objectId = object.id;
            break;
          }

          case TaskList.type: {
            const object = await space!.db.add(new TaskList());
            objectId = object.id;
            break;
          }
        }
      }

      if (objectId) {
        stack.sections.splice(index === -1 ? stack.documents.length : index, 0, { objectId });
      }
    }
  };

  const handleDeleteSection = (index: number) => {
    if (stack) {
      stack.sections.splice(index, 1);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (stack && active && over && active.id !== over.id) {
      const activeIndex = stack.sections.findIndex((section) => section.objectId === active.id);
      const activeSection = stack.sections[activeIndex];
      stack.sections.splice(activeIndex, 1);

      const overIndex = stack.sections.findIndex((section) => section.objectId === over.id);
      const delta = activeIndex <= overIndex ? 1 : 0;
      stack.sections.splice(overIndex + delta, 0, activeSection);
    }
  };

  // TODO(burdon): Spellcheck false in dev mode.
  const spellCheck = false;

  if (!stack) {
    return null;
  }

  return (
    <div ref={scrollRef} className='flex flex-1 justify-center overflow-y-auto'>
      <div className='flex flex-col w-full md:max-w-[800px] md:pt-4 mb-6'>
        <div className='py-12 bg-paper-bg shadow-1'>
          <StackRow>
            <Input
              variant='subdued'
              label='Title'
              labelVisuallyHidden
              placeholder='Title'
              slots={{
                input: {
                  className: 'border-0 text-2xl text-black',
                  spellCheck
                }
              }}
              value={stack.title ?? ''}
              onChange={(event) => {
                stack.title = event.target.value;
              }}
            />
          </StackRow>

          {/* TODO(burdon): Hide while typing. */}
          <DndContext modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
            <SortableContext
              strategy={verticalListSortingStrategy}
              items={stack.sections.map((section) => section.objectId!)}
            >
              {stack.sections.map((section, i) => {
                const object = space!.db.getObjectById(section.objectId!)!;

                return (
                  <SortableStackRow
                    key={object.id}
                    id={object.id}
                    className={mx('py-6', i < stack.sections.length - 1 && 'border-b')}
                    showMenu
                    onCreate={(type, objectId) => handleInsertSection(type, objectId, i)}
                    onDelete={() => handleDeleteSection(i)}
                  >
                    <StackContent config={config} space={space!} object={object!} spellCheck={spellCheck} />
                  </SortableStackRow>
                );
              })}
            </SortableContext>
          </DndContext>

          <StackRow showMenu className='py-6' onCreate={() => handleInsertSection(DocumentType.type, undefined, -1)} />
        </div>
        <div className='pb-4' />
      </div>
    </div>
  );
});

export default StackFrame;
