//
// Copyright 2023 DXOS.org
//

import React, { ComponentPropsWithoutRef, FC, forwardRef, ForwardRefExoticComponent } from 'react';

import { ThemedClassName } from '../../util';
import {
  List,
  LIST_ITEM_NAME,
  ListItem,
  ListItemCollapsibleContentProps,
  ListItemHeadingProps,
  ListItemOpenTriggerProps,
  ListItemRootProps,
  ListProps,
  ListScopedProps,
  useListItemContext,
} from './List';

type TreeRootProps = ListProps;

type TreeItemProps = ListItemRootProps;

const TreeRoot: ForwardRefExoticComponent<TreeRootProps> = forwardRef<HTMLOListElement, TreeRootProps>(
  (props, forwardedRef) => {
    return <List {...props} ref={forwardedRef} />;
  },
);

type TreeBranchProps = TreeRootProps;

const TreeBranch: ForwardRefExoticComponent<TreeBranchProps> = forwardRef<
  HTMLOListElement,
  ListScopedProps<TreeBranchProps>
>(({ __listScope, ...props }, forwardedRef) => {
  const { headingId } = useListItemContext(LIST_ITEM_NAME, __listScope);
  return <List {...props} aria-labelledby={headingId} ref={forwardedRef} />;
});

const TreeItemRoot: ForwardRefExoticComponent<ListItemRootProps> = forwardRef<HTMLLIElement, ListItemRootProps>(
  (props, forwardedRef) => {
    return <ListItem.Root role='treeitem' {...props} ref={forwardedRef} />;
  },
);

type TreeItemHeadingProps = ListItemHeadingProps;

const TreeItemHeading = ListItem.Heading;

type TreeItemOpenTriggerProps = ListItemOpenTriggerProps;

const TreeItemOpenTrigger = ListItem.OpenTrigger;

const MockTreeItemOpenTrigger = ListItem.MockOpenTrigger;

type TreeItemBodyProps = ListItemCollapsibleContentProps;

const TreeItemBody: ForwardRefExoticComponent<TreeItemBodyProps> = ListItem.CollapsibleContent;

export const Tree = { Root: TreeRoot, Branch: TreeBranch };
export const TreeItem: {
  Root: ForwardRefExoticComponent<TreeItemProps>;
  Heading: ForwardRefExoticComponent<TreeItemHeadingProps>;
  Body: ForwardRefExoticComponent<TreeItemBodyProps>;
  OpenTrigger: ForwardRefExoticComponent<TreeItemOpenTriggerProps>;
  MockOpenTrigger: FC<ThemedClassName<Omit<ComponentPropsWithoutRef<'div'>, 'children'>>>;
} = {
  Root: TreeItemRoot,
  Heading: TreeItemHeading,
  Body: TreeItemBody,
  OpenTrigger: TreeItemOpenTrigger,
  MockOpenTrigger: MockTreeItemOpenTrigger,
};

export type { TreeRootProps, TreeItemProps, TreeItemHeadingProps, TreeItemBodyProps, TreeItemOpenTriggerProps };
