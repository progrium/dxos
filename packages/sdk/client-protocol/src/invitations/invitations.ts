//
// Copyright 2022 DXOS.org
//

import { MulticastObservable, Observable, Subscriber } from '@dxos/async';
import { invariant } from '@dxos/log';
import { Invitation } from '@dxos/protocols/proto/dxos/client/services';

export const AUTHENTICATION_CODE_LENGTH = 6;

export const INVITATION_TIMEOUT = 3 * 60_000; // 3 mins.

export interface Invitations {
  created: MulticastObservable<CancellableInvitationObservable[]>;
  accepted: MulticastObservable<AuthenticatingInvitationObservable[]>;
  createInvitation(options?: Partial<Invitation>): CancellableInvitationObservable;
  acceptInvitation(invitation: Invitation): AuthenticatingInvitationObservable;
}

/**
 * Base class for all invitation observables and providers.
 */
export class CancellableInvitationObservable extends MulticastObservable<Invitation> {
  private readonly _onCancel: () => Promise<void>;

  constructor({
    subscriber,
    initialInvitation,
    onCancel,
  }: {
    subscriber: Observable<Invitation> | Subscriber<Invitation>;
    initialInvitation: Invitation;
    onCancel: () => Promise<void>;
  }) {
    super(subscriber, initialInvitation);
    this._onCancel = onCancel;
  }

  cancel(): Promise<void> {
    return this._onCancel();
  }
}

/**
 * Cancelable observer that relays authentication requests.
 */
export class AuthenticatingInvitationObservable extends CancellableInvitationObservable {
  private readonly _onAuthenticate: (authCode: string) => Promise<void>;

  constructor({
    subscriber,
    initialInvitation,
    onCancel,
    onAuthenticate,
  }: {
    subscriber: Observable<Invitation> | Subscriber<Invitation>;
    initialInvitation: Invitation;
    onCancel: () => Promise<void>;
    onAuthenticate: (authCode: string) => Promise<void>;
  }) {
    super({ subscriber, initialInvitation, onCancel });
    this._onAuthenticate = onAuthenticate;
  }

  async authenticate(authCode: string): Promise<void> {
    return this._onAuthenticate(authCode);
  }
}

/**
 * Testing util to wrap non-authenticating observable with promise.
 * Don't use this in production code.
 * @deprecated
 */
// TODO(wittjosiah): Move to testing.
export const wrapObservable = async (observable: CancellableInvitationObservable): Promise<Invitation> => {
  return new Promise((resolve, reject) => {
    const subscription = observable.subscribe(
      (invitation: Invitation | undefined) => {
        // TODO(burdon): Throw error if auth requested.
        invariant(invitation?.state === Invitation.State.SUCCESS);
        subscription.unsubscribe();
        resolve(invitation);
      },
      (err: Error) => {
        subscription.unsubscribe();
        reject(err);
      },
    );
  });
};
