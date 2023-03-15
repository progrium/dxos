//
// Copyright 2022 DXOS.org
//

import React from 'react';

export const CalendarFrame = React.lazy(() => import('./Calendar'));
export const ChessFrame = React.lazy(() => import('./Chess'));
export const ContactFrame = React.lazy(() => import('./Contact'));
export const ExplorerFrame = React.lazy(() => import('./Explorer'));
export const KanbanFrame = React.lazy(() => import('./Kanban'));
export const MapFrame = React.lazy(() => import('./Map'));
export const MessageFrame = React.lazy(() => import('./Message'));
export const PresenterFrame = React.lazy(() => import('./Presenter'));
export const SandboxFrame = React.lazy(() => import('./Sandbox'));
export const SearchFrame = React.lazy(() => import('./Search'));
export const SketchFrame = React.lazy(() => import('./Sketch'));
export const TableFrame = React.lazy(() => import('./Table'));
export const TaskFrame = React.lazy(() => import('./Task'));

export const Document = {
  Frame: React.lazy(() => import('./Document/DocumentFrame')),
  List: React.lazy(() => import('./Document/DocumentList')) // TODO(burdon): Remove.
};

export const Stack = {
  Frame: React.lazy(() => import('./Stack/StackFrame')),
  List: React.lazy(() => import('./Stack/StackList')) // TODO(burdon): Remove.
};

export const Note = {
  Frame: React.lazy(() => import('./Note/NoteFrame')),
  List: React.lazy(() => import('./Note/NoteList')) // TODO(burdon): Remove.
};

export const File = {
  Frame: React.lazy(() => import('./File/FileFrame')),
  List: React.lazy(() => import('./File/FileList'))
};
