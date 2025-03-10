//
// Copyright 2022 DXOS.org
//

import { PublicKey } from '@dxos/keys';
import { Answer, Offer, Signal, SignalBatch } from '@dxos/protocols/proto/dxos/mesh/swarm';

export interface OfferMessage {
  author: PublicKey;
  recipient: PublicKey;
  topic: PublicKey;
  sessionId: PublicKey;
  data: { offer: Offer };
}

export interface SignalMessage {
  author: PublicKey;
  recipient: PublicKey;
  topic: PublicKey;
  sessionId: PublicKey;
  data: { signal?: Signal; signalBatch?: SignalBatch };
}

/**
 * Signal peer messaging interface.
 */
export interface SignalMessenger {
  /**
   * Offer/answer RPC.
   */
  offer(msg: OfferMessage): Promise<Answer>;

  /**
   * Reliably send a signal to a peer.
   */
  signal(msg: SignalMessage): Promise<void>;
}
