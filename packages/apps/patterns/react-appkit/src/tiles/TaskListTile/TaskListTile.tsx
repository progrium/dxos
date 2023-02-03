//
// Copyright 2023 DXOS.org
//

import React from 'react';

import { id } from '@dxos/echo-schema';

import { TaskList } from '../../proto';
import { TileProps } from '../TileProps';
import { Root } from '../TileSlots';

export type TaskListTileProps = TileProps<TaskList>;

export const TaskListTile = ({ tile, slots = {} }: TaskListTileProps) => {
  return (
    <Root {...slots.root} label={<h2 {...slots.label}>{tile.title}</h2>}>
      <ul>
        {tile.tasks.map((task) => (
          <li key={task[id]}>{task.title}</li>
        ))}
      </ul>
    </Root>
  );
};

export const isTaskListTile = (props: any): props is TaskListTileProps => {
  return 'tile' in props && props.tile instanceof TaskList;
};

export const renderIfTaskListTile = (props: any) => {
  if (isTaskListTile(props)) {
    return <TaskListTile {...props} />;
  } else {
    return null;
  }
};
