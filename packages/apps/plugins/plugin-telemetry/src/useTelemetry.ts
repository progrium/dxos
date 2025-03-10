//
// Copyright 2022 DXOS.org
//

import { useEffect } from 'react';

import { SplitViewPluginProvides } from '@braneframe/plugin-splitview';
import { useClient } from '@dxos/react-client';
import { usePlugin } from '@dxos/react-surface';

import { BASE_TELEMETRY_PROPERTIES, getTelemetryIdentifier, setupTelemetryListeners, withTelemetry } from './telemetry';

export type UseTelemetryOptions = {
  namespace: string;
};

/**
 * Hooks up navigation and click events to telemetry.
 */
export const useTelemetry = ({ namespace }: UseTelemetryOptions) => {
  const splitViewPlugin = usePlugin<SplitViewPluginProvides>('dxos.org/plugin/splitview');
  const client = useClient();

  useEffect(() => {
    void withTelemetry((Telemetry) => {
      Telemetry.event({
        identityId: getTelemetryIdentifier(client),
        name: `${namespace}.page.load`,
        properties: {
          ...BASE_TELEMETRY_PROPERTIES,
          href: window.location.href,
          loadDuration: window.performance.timing.loadEventEnd - window.performance.timing.loadEventStart,
        },
      });
    });

    return setupTelemetryListeners(namespace, client);
  }, []);

  useEffect(() => {
    void withTelemetry((Telemetry) => {
      Telemetry.page({
        identityId: getTelemetryIdentifier(client),
        properties: BASE_TELEMETRY_PROPERTIES,
      });
    });
  }, [splitViewPlugin?.provides.splitView.active]);
};
