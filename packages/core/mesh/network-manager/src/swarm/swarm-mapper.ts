//
// Copyright 2020 DXOS.org
//

import { Event, EventSubscriptions } from '@dxos/async';
import { PublicKey } from '@dxos/keys';
import { log } from '@dxos/log';
import { ComplexMap } from '@dxos/util';

import { ConnectionState } from './connection';
import { Swarm } from './swarm';

/**
 * State of the connection to the remote peer with additional info derived from network mapping.
 */
export type PeerState = ConnectionState | 'INDIRECTLY_CONNECTED' | 'ME';

/**
 * Information about remote peer, directly or indirectly connected.
 */
export interface PeerInfo {
  id: PublicKey;
  state: PeerState;
  connections: PublicKey[];
}

type Unsubscribe = () => void;

export class SwarmMapper {
  private readonly _subscriptions = new EventSubscriptions();
  private readonly _connectionSubscriptions = new ComplexMap<PublicKey, Unsubscribe>(PublicKey.hash);
  private readonly _peers = new ComplexMap<PublicKey, PeerInfo>(PublicKey.hash);

  readonly mapUpdated = new Event<PeerInfo[]>();

  get peers(): PeerInfo[] {
    return Array.from(this._peers.values());
  }

  constructor(private readonly _swarm: Swarm) {
    this._subscriptions.add(
      _swarm.connectionAdded.on((connection) => {
        this._update();
        this._connectionSubscriptions.set(
          connection.remoteId,
          connection.stateChanged.on(() => {
            this._update();
          }),
        );
      }),
    );

    this._subscriptions.add(
      _swarm.disconnected.on((peerId) => {
        this._connectionSubscriptions.get(peerId)?.();
        this._connectionSubscriptions.delete(peerId);
        this._update();
      }),
    );

    // if (_presence) {
    //   this._subscriptions.add(_presence.graphUpdated.on(() => {
    //     this._update();
    //   }));
    // }

    // TODO(burdon): Do not call from constructor.
    this._update();
  }

  private _update() {
    log('updating swarm');

    this._peers.clear();
    this._peers.set(this._swarm.ownPeerId, {
      id: this._swarm.ownPeerId,
      state: 'ME', // TODO(burdon): Enum (rename "local").
      connections: [],
    });

    for (const connection of this._swarm.connections) {
      this._peers.set(connection.remoteId, {
        id: connection.remoteId,
        state: connection.state,
        connections: [this._swarm.ownPeerId],
      });
    }

    // if (this._presence) {
    //   this._presence.graph.forEachNode((node: any) => {
    //     const id = PublicKey.fromHex(node.id);
    //     if (this._peers.has(id)) {
    //       return;
    //     }

    //     this._peers.set(id, {
    //       id,
    //       state: 'INDIRECTLY_CONNECTED',
    //       connections: []
    //     });
    //   });

    //   this._presence.graph.forEachLink((link: any) => {
    //     const from = PublicKey.from(link.fromId);
    //     const to = PublicKey.from(link.toId);
    //     // Ignore connections to self, they are already handled.
    //     if (!from.equals(this._swarm.ownPeerId) && !to.equals(this._swarm.ownPeerId)) {
    //       this._peers.get(from)!.connections.push(to);
    //     }
    //   });
    // }

    log('graph changed', {
      directConnections: this._swarm.connections.length,
      totalPeersInSwarm: this._peers.size,
    });

    this.mapUpdated.emit(Array.from(this._peers.values()));
  }

  // TODO(burdon): Async open/close.
  destroy() {
    Array.from(this._connectionSubscriptions.values()).forEach((cb) => cb());
    this._subscriptions.clear();
  }
}
