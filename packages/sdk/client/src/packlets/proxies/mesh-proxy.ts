//
// Copyright 2021 DXOS.org
//

import assert from 'node:assert';

import { Event, MulticastObservable } from '@dxos/async';
import { Context } from '@dxos/context';
import { log } from '@dxos/log';
import { NetworkStatus, ConnectionState } from '@dxos/protocols/proto/dxos/client/services';

import { ClientServicesProvider } from '../client';

/**
 * Public API for MESH services.
 */
export class MeshProxy {
  private readonly _networkStatusUpdated = new Event<NetworkStatus>();
  private readonly _networkStatus = MulticastObservable.from(this._networkStatusUpdated, {
    state: ConnectionState.OFFLINE
  });

  private _ctx?: Context;

  // prettier-ignore
  constructor(
    private readonly _serviceProvider: ClientServicesProvider
  ) {}

  toJSON() {
    return {
      networkStatus: this._networkStatus.get()
    };
  }

  get networkStatus() {
    return this._networkStatus;
  }

  async setConnectionState(state: ConnectionState) {
    assert(this._serviceProvider.services.NetworkService, 'NetworkService is not available.');
    return this._serviceProvider.services.NetworkService.setNetworkOptions({ state });
  }

  /**
   * @internal
   */
  async _open() {
    this._ctx = new Context({ onError: (err) => log.catch(err) });

    assert(this._serviceProvider.services.NetworkService, 'NetworkService is not available.');
    const networkStatusStream = this._serviceProvider.services.NetworkService.subscribeToNetworkStatus();
    networkStatusStream.subscribe((networkStatus: NetworkStatus) => {
      this._networkStatusUpdated.emit(networkStatus);
    });

    this._ctx.onDispose(() => {
      networkStatusStream.close();
    });
  }

  /**
   * @internal
   */
  async _close() {
    await this._ctx?.dispose();
  }
}
