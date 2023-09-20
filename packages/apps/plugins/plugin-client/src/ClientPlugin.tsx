//
// Copyright 2023 DXOS.org
//

import React, { useEffect, useState } from 'react';

import { EchoSchema } from '@dxos/client/echo';
import { InvitationEncoder } from '@dxos/client/invitations';
import { Config, Defaults, Envs, Local } from '@dxos/config';
import { registerSignalFactory } from '@dxos/echo-signals/react';
import { log } from '@dxos/log';
import { Client, ClientContext, ClientOptions, SystemStatus } from '@dxos/react-client';
import { PluginDefinition } from '@dxos/react-surface';

import { ClientPluginProvides, CLIENT_PLUGIN } from './types';

export type ClientPluginOptions = ClientOptions & { debugIdentity?: boolean; schema?: EchoSchema };

export const ClientPlugin = (
  options: ClientPluginOptions = { config: new Config(Envs(), Local(), Defaults()) },
): PluginDefinition<{}, ClientPluginProvides> => {
  registerSignalFactory();
  const client = new Client(options);

  // Open devtools on keypress.
  // TODO(burdon): Move to DebugPlugin and add key binding to action.
  const onKeypress = async (event: KeyboardEvent) => {
    // Cmd + Shift + X.
    if (event.metaKey && event.shiftKey && event.key === 'x') {
      event.preventDefault();

      const vault = options.config?.values.runtime?.client?.remoteSource ?? 'https://halo.dxos.org';

      // Check if we're serving devtools locally on the usual port.
      let hasLocalDevtools = false;
      try {
        await fetch('http://localhost:5174/');
        hasLocalDevtools = true;
      } catch {}

      const isDev = window.location.href.includes('.dev.') || window.location.href.includes('localhost');
      const devtoolsApp = hasLocalDevtools
        ? 'http://localhost:5174/'
        : `https://devtools${isDev ? '.dev.' : '.'}dxos.org/`;
      const devtoolsUrl = `${devtoolsApp}?target=${vault}`;
      window.open(devtoolsUrl, '_blank');
    }
  };

  return {
    meta: {
      id: CLIENT_PLUGIN,
    },
    initialize: async () => {
      let firstRun = false;
      let error: unknown = null;

      try {
        if (options.schema) {
          client.addSchema(options.schema);
        }

        await client.initialize();

        const searchParams = new URLSearchParams(location.search);
        const deviceInvitationCode = searchParams.get('deviceInvitationCode');
        if (!client.halo.identity.get() && !deviceInvitationCode) {
          firstRun = true;
          await client.halo.createIdentity();
        } else if (client.halo.identity.get() && deviceInvitationCode) {
          // Ignore device invitation if identity already exists.
          // TODO(wittjosiah): Identity merging.
          searchParams.delete('deviceInvitationCode');
          window.history.replaceState({}, '', `${location.pathname}?${searchParams}`);
        } else if (deviceInvitationCode) {
          void client.shell.initializeIdentity({ invitationCode: deviceInvitationCode });
        }
      } catch (err) {
        error = err;
      }

      document.addEventListener('keydown', onKeypress);

      // Debugging (e.g., for monolithic mode).
      if (options.debugIdentity) {
        if (!client.halo.identity.get()) {
          await client.halo.createIdentity();
        }

        // Handle initial connection (assumes no PIN).
        const searchParams = new URLSearchParams(window.location.search);
        const spaceInvitationCode = searchParams.get('spaceInvitationCode');
        if (spaceInvitationCode) {
          setTimeout(() => {
            // TODO(burdon): Unsubscribe.
            const observer = client.spaces.join(InvitationEncoder.decode(spaceInvitationCode));
            observer.subscribe(({ state }) => {
              log.info('invitation', { state });
            });
          }, 2000);
        }
      }

      if (client.halo.identity.get()) {
        await client.spaces.isReady.wait();
      }

      return {
        client,
        firstRun,
        context: ({ children }) => {
          const [status, setStatus] = useState<SystemStatus | null>(null);

          useEffect(() => {
            if (!client) {
              return;
            }

            const subscription = client.status.subscribe((status) => setStatus(status));

            return () => subscription.unsubscribe();
          }, [client, setStatus]);

          return <ClientContext.Provider value={{ client, status }}>{children}</ClientContext.Provider>;
        },
        components: {
          default: () => {
            if (error) {
              throw error;
            }

            return null;
          },
        },
      };
    },
    unload: async () => {
      document.removeEventListener('keydown', onKeypress);

      await client.destroy();
    },
  };
};
