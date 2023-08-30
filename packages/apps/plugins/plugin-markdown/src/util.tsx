//
// Copyright 2023 DXOS.org
//

import { Article, ArticleMedium, PencilSimpleLine, Trash } from '@phosphor-icons/react';
import get from 'lodash.get';
import React from 'react';

import { Graph } from '@braneframe/plugin-graph';
import { SpaceAction } from '@braneframe/plugin-space';
import { Document } from '@braneframe/types';
import { ComposerModel, TextKind, YText } from '@dxos/aurora-composer';
import { EchoObject, Space } from '@dxos/react-client/echo'; // TODO(burdon): Should not expose.
import { Plugin } from '@dxos/react-surface';

import { MARKDOWN_PLUGIN, MarkdownProperties, MarkdownProvides } from './types';

// TODO(burdon): These tests clash with Diagram.content.
//  Uncaught Error: Type with the name content has already been defined with a different constructor.
// TODO(burdon): This is being passed the text content (not the object)?
export const __isMarkdown = (object: { [key: string]: any }): object is ComposerModel => {
  try {
    return (
      'id' in object &&
      typeof object.id === 'string' &&
      (typeof object.content === 'string' || object.content instanceof YText)
    );
  } catch (err) {
    console.error('isMarkdown error', err, object);
    return false;
  }
};

export const isMarkdown = (data: unknown): data is ComposerModel =>
  data && typeof data === 'object'
    ? 'id' in data &&
      typeof data.id === 'string' &&
      (typeof (data as { [key: string]: any }).content === 'string' ||
        (data as { [key: string]: any }).content instanceof YText)
    : false;

export const isMarkdownContent = (data: unknown): data is { content: ComposerModel } =>
  !!data &&
  typeof data === 'object' &&
  (data as { [key: string]: any }).content &&
  isMarkdown((data as { [key: string]: any }).content);

export const isMarkdownPlaceholder = (data: unknown): data is ComposerModel =>
  data && typeof data === 'object'
    ? 'id' in data && typeof data.id === 'string' && 'content' in data && typeof data.content === 'function'
    : false;

export const isMarkdownProperties = (data: unknown): data is MarkdownProperties =>
  data instanceof EchoObject
    ? true
    : data && typeof data === 'object'
    ? 'title' in data && typeof data.title === 'string'
    : false;

type MarkdownPlugin = Plugin<MarkdownProvides>;

export const markdownPlugins = (plugins: Plugin[]): MarkdownPlugin[] => {
  return (plugins as MarkdownPlugin[]).filter((p) => Boolean(p.provides?.markdown));
};

const nonTitleChars = /[^\w ]/g;

const getFallbackTitle = (document: Document) => {
  return document.content?.content?.toString().substring(0, 63).split('\n')[0].replaceAll(nonTitleChars, '').trim();
};

export const documentToGraphNode = (parent: Graph.Node<Space>, document: Document, index: string): Graph.Node => {
  const fallbackProps = document.title
    ? {}
    : (() => {
        const fallbackTitle = getFallbackTitle(document);
        return fallbackTitle?.length && fallbackTitle?.length > 0
          ? {
              fallbackTitle,
              preferFallbackTitle: true,
            }
          : {};
      })();

  const [child] = parent.add({
    id: document.id,
    label: document.title ?? ['document title placeholder', { ns: MARKDOWN_PLUGIN }],
    icon: (props) =>
      document.content?.kind === TextKind.PLAIN ? <ArticleMedium {...props} /> : <Article {...props} />,
    data: document,
    properties: {
      index: get(document, 'meta.index', index),
      ...fallbackProps,
    },
  });

  child.addAction({
    id: 'delete',
    label: ['delete document label', { ns: MARKDOWN_PLUGIN }],
    icon: (props) => <Trash {...props} />,
    intent: {
      action: SpaceAction.REMOVE_OBJECT,
      data: { spaceKey: parent.data?.key.toHex(), objectId: document.id },
    },
  });

  child.addAction({
    id: 'rename',
    label: ['rename document label', { ns: MARKDOWN_PLUGIN }],
    icon: (props) => <PencilSimpleLine {...props} />,
    intent: {
      action: SpaceAction.RENAME_OBJECT,
      data: { spaceKey: parent.data?.key.toHex(), objectId: document.id },
    },
  });

  return child;
};
