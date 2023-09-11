//
// Copyright 2023 DXOS.org
//

import { Intersect, Planet } from '@phosphor-icons/react';
import { effect } from '@preact/signals-react';
import { getIndices } from '@tldraw/indices';
import { RevertDeepSignal, deepSignal } from 'deepsignal/react';
import React from 'react';

import { CLIENT_PLUGIN, ClientPluginProvides } from '@braneframe/plugin-client';
import { Graph, GraphPluginProvides, isGraphNode } from '@braneframe/plugin-graph';
import { IntentPluginProvides } from '@braneframe/plugin-intent';
import { SplitViewProvides } from '@braneframe/plugin-splitview';
import {
  TREE_VIEW_PLUGIN,
  TreeViewAction,
  TreeViewPluginProvides,
  setAppStateIndex,
} from '@braneframe/plugin-treeview';
import { AppState } from '@braneframe/types';
import { EventSubscriptions } from '@dxos/async';
import { subscribe } from '@dxos/echo-schema';
import { IFrameClientServicesHost, IFrameClientServicesProxy, PublicKey, ShellLayout } from '@dxos/react-client';
import { Space, SpaceProxy } from '@dxos/react-client/echo';
import { PluginDefinition, findPlugin } from '@dxos/react-surface';

import { backupSpace } from './backup';
import {
  PopoverRenameSpace,
  DialogRestoreSpace,
  EmptySpace,
  EmptyTree,
  SpaceMain,
  SpaceMainEmpty,
  SpacePresence,
  PopoverRenameObject,
} from './components';
import translations from './translations';
import { SPACE_PLUGIN, SPACE_PLUGIN_SHORT_ID, SpaceAction, SpacePluginProvides, SpaceState } from './types';
import { getSpaceId, isSpace, spaceToGraphNode } from './util';

// TODO(wittjosiah): This ensures that typed objects are not proxied by deepsignal. Remove.
// https://github.com/luisherranz/deepsignal/issues/36
(globalThis as any)[SpaceProxy.name] = SpaceProxy;
(globalThis as any)[PublicKey.name] = PublicKey;

export const SpacePlugin = (): PluginDefinition<SpacePluginProvides> => {
  const state = deepSignal<SpaceState>({ active: undefined, viewers: [] });
  const graphSubscriptions = new EventSubscriptions();
  const spaceSubscriptions = new EventSubscriptions();
  const subscriptions = new EventSubscriptions();

  return {
    meta: {
      id: SPACE_PLUGIN,
      shortId: SPACE_PLUGIN_SHORT_ID,
    },
    ready: async (plugins) => {
      const intentPlugin = findPlugin<IntentPluginProvides>(plugins, 'dxos.org/plugin/intent');
      const graphPlugin = findPlugin<GraphPluginProvides>(plugins, 'dxos.org/plugin/graph');
      const clientPlugin = findPlugin<ClientPluginProvides>(plugins, CLIENT_PLUGIN);
      const treeViewPlugin = findPlugin<TreeViewPluginProvides>(plugins, TREE_VIEW_PLUGIN);
      if (!clientPlugin || !treeViewPlugin) {
        return;
      }

      const client = clientPlugin.provides.client;
      const treeView = treeViewPlugin.provides.treeView;

      if (client.services instanceof IFrameClientServicesProxy || client.services instanceof IFrameClientServicesHost) {
        client.services.joinedSpace.on((spaceKey) => {
          void intentPlugin?.provides.intent.sendIntent({
            plugin: TREE_VIEW_PLUGIN,
            action: TreeViewAction.ACTIVATE,
            data: {
              id: getSpaceId(spaceKey),
            },
          });
        });
      }

      subscriptions.add(
        effect(async () => {
          if (!treeView.activeNode) {
            return;
          }

          const space = await new Promise<Space | undefined>((resolve) => {
            graphPlugin?.provides.graph.traverse({
              from: treeView.activeNode,
              direction: 'up',
              onVisitNode: (node) => {
                if (isSpace(node.data)) {
                  resolve(node.data);
                }
              },
            });
            resolve(undefined);
          });

          if (
            space instanceof SpaceProxy &&
            (client.services instanceof IFrameClientServicesProxy ||
              client.services instanceof IFrameClientServicesHost)
          ) {
            client.services.setSpaceProvider(() => {
              if (space.key.equals(client.spaces.default.key)) {
                return undefined;
              } else {
                return space.key;
              }
            });
          }

          state.active = space;
        }),
      );

      subscriptions.add(
        effect(() => {
          const send = () => {
            const identity = client.halo.identity.get();
            const space = state.active;
            if (identity && space && treeView.active) {
              void space.postMessage('viewing', {
                identityKey: identity.identityKey.toHex(),
                spaceKey: space.key.toHex(),
                added: [treeView.active],
                removed: [treeView.previous],
              });
            }
          };

          setInterval(() => send(), 5_000);
          send();
        }),
      );

      subscriptions.add(
        client.spaces.subscribe((spaces) => {
          spaceSubscriptions.clear();
          spaces.forEach((space) => {
            spaceSubscriptions.add(
              space.listen('viewing', (message) => {
                const { added, removed } = message.payload;
                const identityKey = PublicKey.safeFrom(message.payload.identityKey);
                const spaceKey = PublicKey.safeFrom(message.payload.spaceKey);
                if (identityKey && spaceKey && Array.isArray(added) && Array.isArray(removed)) {
                  state.viewers = [
                    ...state.viewers.filter(
                      (viewer) =>
                        viewer.identityKey.equals(identityKey) &&
                        viewer.spaceKey.equals(spaceKey) &&
                        !removed.some((objectId) => objectId === viewer.objectId) &&
                        !added.some((objectId) => objectId === viewer.objectId),
                    ),
                    ...added.map((objectId) => ({
                      identityKey,
                      spaceKey,
                      objectId,
                      lastSeen: Date.now(),
                    })),
                  ];
                }
              }),
            );
          });
        }).unsubscribe,
      );
    },
    unload: async () => {
      graphSubscriptions.clear();
      spaceSubscriptions.clear();
      subscriptions.clear();
    },
    provides: {
      space: state as RevertDeepSignal<SpaceState>,
      translations,
      component: (data, role) => {
        switch (role) {
          case 'main':
            switch (true) {
              case isSpace(data):
                return SpaceMainEmpty;
              default:
                return null;
            }
          // (burdon): Why double-hyphen?
          // (thure): This is BEM syntax, which we use for a few other features.
          case 'tree--empty':
            switch (true) {
              case data === SPACE_PLUGIN:
                return EmptyTree;
              case isGraphNode(data) && isSpace(data?.data):
                return EmptySpace;
              default:
                return null;
            }
          case 'dialog':
            if (Array.isArray(data)) {
              switch (data[0]) {
                case 'dxos.org/plugin/space/RestoreSpaceDialog':
                  return DialogRestoreSpace;
                default:
                  return null;
              }
            } else {
              return null;
            }
          case 'popover':
            if (Array.isArray(data)) {
              switch (data[0]) {
                case 'dxos.org/plugin/space/RenameSpacePopover':
                  return PopoverRenameSpace;
                case 'dxos.org/plugin/space/RenameObjectPopover':
                  return PopoverRenameObject;
                default:
                  return null;
              }
            } else {
              return null;
            }
          case 'presence':
            return SpacePresence;
          default:
            return null;
        }
      },
      components: {
        Main: SpaceMain,
      },
      graph: {
        withPlugins: (plugins) => (parent) => {
          if (parent.id !== 'root') {
            return;
          }

          const clientPlugin = findPlugin<ClientPluginProvides>(plugins, 'dxos.org/plugin/client');
          const treeViewPlugin = findPlugin<TreeViewPluginProvides>(plugins, 'dxos.org/plugin/treeview');
          if (!clientPlugin) {
            return;
          }

          const client = clientPlugin.provides.client;
          // Ensure default space is always first.
          spaceToGraphNode(client.spaces.default, parent);

          const [groupNode] = parent.add({
            id: getSpaceId('all-spaces'),
            label: ['shared spaces label', { ns: SPACE_PLUGIN }],
            properties: {
              palette: 'pink', // TODO(burdon): Change palette.
              acceptPersistenceClass: new Set(['appState']),
              childrenPersistenceClass: 'appState',
              onRearrangeChild: (child: Graph.Node<Space>, nextIndex: string) => {
                child.properties.index = setAppStateIndex(
                  child.id,
                  nextIndex,
                  treeViewPlugin?.provides.treeView?.appState as AppState | undefined,
                );
              },
            },
          });

          const { unsubscribe } = client.spaces.subscribe((spaces) => {
            graphSubscriptions.clear();
            const indices = getIndices(spaces.length);
            spaces.forEach((space, index) => {
              const update = () => {
                const isDefaultSpace = client.spaces.default.key.equals(space.key);
                isDefaultSpace
                  ? spaceToGraphNode(space, parent, treeViewPlugin?.provides.treeView?.appState)
                  : spaceToGraphNode(space, groupNode, treeViewPlugin?.provides.treeView?.appState, indices[index]);
              };

              const unsubscribe = space.properties[subscribe](() => update());
              graphSubscriptions.add(unsubscribe);
              update();
            });
          });

          groupNode.addAction(
            {
              id: 'create-space',
              label: ['create space label', { ns: 'os' }],
              icon: (props) => <Planet {...props} />,
              properties: {
                disposition: 'toolbar',
                testId: 'spacePlugin.spaces.create',
              },
              intent: {
                plugin: SPACE_PLUGIN,
                action: SpaceAction.CREATE,
              },
            },
            {
              id: 'join-space',
              label: ['join space label', { ns: 'os' }],
              icon: (props) => <Intersect {...props} />,
              properties: {
                disposition: 'toolbar',
                testId: 'spacePlugin.joinSpace',
              },
              intent: {
                plugin: SPACE_PLUGIN,
                action: SpaceAction.JOIN,
              },
            },
          );

          return () => {
            unsubscribe();
            graphSubscriptions.clear();
          };
        },
      },
      intent: {
        resolver: async (intent, plugins) => {
          const clientPlugin = findPlugin<ClientPluginProvides>(plugins, 'dxos.org/plugin/client');
          switch (intent.action) {
            case SpaceAction.CREATE: {
              return clientPlugin?.provides.client.spaces.create(intent.data);
            }

            case SpaceAction.JOIN: {
              if (clientPlugin) {
                clientPlugin.provides.setLayout(ShellLayout.JOIN_SPACE);
                return true;
              }
              return;
            }
          }

          // TODO(thure): Why is `PublicKey.safeFrom` returning `undefined` sometimes?
          const spaceKey = intent.data?.spaceKey && PublicKey.from(intent.data.spaceKey);
          if (!spaceKey) {
            return;
          }

          const space = clientPlugin?.provides.client.spaces.get(spaceKey);
          switch (intent.action) {
            case SpaceAction.SHARE: {
              if (clientPlugin) {
                clientPlugin.provides.setLayout(ShellLayout.SPACE_INVITATIONS, { spaceKey });
                return true;
              }
              break;
            }

            case SpaceAction.RENAME: {
              const splitViewPlugin = findPlugin<SplitViewProvides>(plugins, 'dxos.org/plugin/splitview');
              if (space && splitViewPlugin?.provides.splitView) {
                splitViewPlugin.provides.splitView.popoverOpen = true;
                splitViewPlugin.provides.splitView.popoverContent = ['dxos.org/plugin/space/RenameSpacePopover', space];
                splitViewPlugin.provides.splitView.popoverAnchorId = `dxos.org/plugin/treeview/NavTreeItem/${getSpaceId(
                  spaceKey,
                )}`;
                return true;
              }
              break;
            }

            case SpaceAction.CLOSE: {
              void space?.internal.close();
              break;
            }

            case SpaceAction.BACKUP: {
              if (space) {
                // TODO(wittjosiah): Expose translations helper from theme plugin provides.
                const backupBlob = await backupSpace(space, 'untitled document');
                const spaceName = space.properties.name || 'untitled space';
                const url = URL.createObjectURL(backupBlob);
                const element = document.createElement('a');
                element.setAttribute('href', url);
                element.setAttribute('download', `${spaceName} backup.zip`);
                element.setAttribute('target', 'download');
                element.click();
                return true;
              }
              break;
            }

            case SpaceAction.RESTORE: {
              const splitViewPlugin = findPlugin<SplitViewProvides>(plugins, 'dxos.org/plugin/splitview');
              if (space && splitViewPlugin?.provides.splitView) {
                splitViewPlugin.provides.splitView.dialogOpen = true;
                splitViewPlugin.provides.splitView.dialogContent = ['dxos.org/plugin/space/RestoreSpaceDialog', space];
                return true;
              }
              break;
            }

            case SpaceAction.ADD_OBJECT: {
              if (space && intent.data.object) {
                return space.db.add(intent.data.object);
              }
              break;
            }

            case SpaceAction.REMOVE_OBJECT: {
              const object =
                typeof intent.data.objectId === 'string' ? space?.db.getObjectById(intent.data.objectId) : null;
              if (space && object) {
                space.db.remove(object);
                return true;
              }
              break;
            }

            case SpaceAction.RENAME_OBJECT: {
              const splitViewPlugin = findPlugin<SplitViewProvides>(plugins, 'dxos.org/plugin/splitview');
              const object =
                typeof intent.data.objectId === 'string' ? space?.db.getObjectById(intent.data.objectId) : null;
              // console.log('[space rename object]', object, splitViewPlugin?.provides.splitView);
              if (object && splitViewPlugin?.provides.splitView) {
                splitViewPlugin.provides.splitView.popoverOpen = true;
                splitViewPlugin.provides.splitView.popoverContent = [
                  'dxos.org/plugin/space/RenameObjectPopover',
                  object,
                ];
                splitViewPlugin.provides.splitView.popoverAnchorId = `dxos.org/plugin/treeview/NavTreeItem/${intent.data.objectId}`;
                return true;
              }
              break;
            }
          }
        },
      },
    },
  };
};
