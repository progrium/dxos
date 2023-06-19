//
// Copyright 2023 DXOS.org
//

import React, { HTMLAttributes, useRef } from 'react';

import { ComposerModel, MarkdownComposer, MarkdownComposerRef } from '@dxos/aurora-composer';
import { defaultFocus, mx } from '@dxos/aurora-theme';
import { PluginAction } from '@dxos/react-surface';

import { EmbeddedLayout } from './EmbeddedLayout';
import { StandaloneLayout } from './StandaloneLayout';

export type MarkdownProperties = {
  title: string;
  keys: {
    source?: string;
    id?: string;
  }[];
};

export const MarkdownMainStandalone = ({
  data: [model, properties],
  actions = [],
}: {
  data: [ComposerModel, MarkdownProperties];
  actions?: PluginAction[];
}) => {
  return <MarkdownMain model={model} properties={properties} actions={actions} layout='standalone' />;
};

export const MarkdownMain = ({
  model,
  properties,
  actions,
  layout,
}: {
  model: ComposerModel;
  properties: MarkdownProperties;
  actions: PluginAction[];
  layout: 'standalone' | 'embedded';
}) => {
  const editorRef = useRef<MarkdownComposerRef>(null);
  const Root = layout === 'embedded' ? EmbeddedLayout : StandaloneLayout;

  return (
    <>
      <Root id={model.id} properties={properties} actions={actions}>
        <MarkdownComposer
          ref={editorRef}
          model={model}
          slots={{
            root: {
              role: 'none',
              className: mx(defaultFocus, 'shrink-0 grow flex flex-col'),
              'data-testid': 'composer.markdownRoot',
            } as HTMLAttributes<HTMLDivElement>,
            editor: {
              markdownTheme: {
                '&, & .cm-scroller': {
                  display: 'flex',
                  flexDirection: 'column',
                  flex: '1 0 auto',
                  inlineSize: '100%',
                },
                '& .cm-content': { flex: '1 0 auto', inlineSize: '100%', paddingBlock: '1rem' },
                '& .cm-line': { paddingInline: '1.5rem' },
              },
            },
          }}
        />
      </Root>
    </>
  );
};
