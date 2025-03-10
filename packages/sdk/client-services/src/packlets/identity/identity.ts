//
// Copyright 2022 DXOS.org
//

import { Event } from '@dxos/async';
import { AUTH_TIMEOUT, LOAD_CONTROL_FEEDS_TIMEOUT } from '@dxos/client-protocol';
import { Context } from '@dxos/context';
import {
  DeviceStateMachine,
  CredentialSigner,
  createCredentialSignerWithKey,
  createCredentialSignerWithChain,
  ProfileStateMachine,
} from '@dxos/credentials';
import { Signer } from '@dxos/crypto';
import { failUndefined } from '@dxos/debug';
import { Space } from '@dxos/echo-pipeline';
import { writeMessages } from '@dxos/feed-store';
import { invariant } from '@dxos/invariant';
import { PublicKey } from '@dxos/keys';
import { log } from '@dxos/log';
import { FeedMessage } from '@dxos/protocols/proto/dxos/echo/feed';
import { AdmittedFeed, ProfileDocument } from '@dxos/protocols/proto/dxos/halo/credentials';
import { DeviceAdmissionRequest } from '@dxos/protocols/proto/dxos/halo/invitations';
import { trace } from '@dxos/tracing';
import { ComplexSet } from '@dxos/util';

import { TrustedKeySetAuthVerifier } from './authenticator';

export type IdentityParams = {
  identityKey: PublicKey;
  deviceKey: PublicKey;
  signer: Signer;
  space: Space;
};

/**
 * Agent identity manager, which includes the agent's Halo space.
 */
@trace.resource()
export class Identity {
  public readonly space: Space;
  private readonly _signer: Signer;
  private readonly _deviceStateMachine: DeviceStateMachine;
  private readonly _profileStateMachine: ProfileStateMachine;
  public readonly authVerifier: TrustedKeySetAuthVerifier;

  public readonly identityKey: PublicKey;
  public readonly deviceKey: PublicKey;

  public readonly stateUpdate = new Event();

  constructor({ space, signer, identityKey, deviceKey }: IdentityParams) {
    this.space = space;
    this._signer = signer;

    this.identityKey = identityKey;
    this.deviceKey = deviceKey;

    this._deviceStateMachine = new DeviceStateMachine({
      identityKey: this.identityKey,
      deviceKey: this.deviceKey,
      onUpdate: () => this.stateUpdate.emit(),
    });
    this._profileStateMachine = new ProfileStateMachine({
      identityKey: this.identityKey,
      onUpdate: () => this.stateUpdate.emit(),
    });

    this.authVerifier = new TrustedKeySetAuthVerifier({
      trustedKeysProvider: () => this.authorizedDeviceKeys,
      update: this.stateUpdate,
      authTimeout: AUTH_TIMEOUT,
    });
  }

  // TODO(burdon): Expose state object?
  get authorizedDeviceKeys(): ComplexSet<PublicKey> {
    return this._deviceStateMachine.authorizedDeviceKeys;
  }

  @trace.span()
  async open(ctx: Context) {
    await this.space.spaceState.addCredentialProcessor(this._deviceStateMachine);
    await this.space.spaceState.addCredentialProcessor(this._profileStateMachine);
    await this.space.open(ctx);
  }

  @trace.span()
  async close(ctx: Context) {
    await this.authVerifier.close();
    await this.space.spaceState.removeCredentialProcessor(this._profileStateMachine);
    await this.space.spaceState.removeCredentialProcessor(this._deviceStateMachine);
    await this.space.close();
  }

  async ready() {
    await this._deviceStateMachine.deviceChainReady.wait();

    await this.controlPipeline.state.waitUntilReachedTargetTimeframe({ timeout: LOAD_CONTROL_FEEDS_TIMEOUT });
  }

  get profileDocument(): ProfileDocument | undefined {
    return this._profileStateMachine.profile;
  }

  /**
   * @test-only
   */
  get controlPipeline() {
    return this.space.controlPipeline;
  }

  get haloSpaceKey() {
    return this.space.key;
  }

  get haloGenesisFeedKey() {
    return this.space.genesisFeedKey;
  }

  get deviceCredentialChain() {
    return this._deviceStateMachine.deviceCredentialChain;
  }

  getAdmissionCredentials(): DeviceAdmissionRequest {
    return {
      deviceKey: this.deviceKey,
      controlFeedKey: this.space.controlFeedKey ?? failUndefined(),
      dataFeedKey: this.space.dataFeedKey ?? failUndefined(),
    };
  }

  /**
   * Issues credentials as identity.
   * Requires identity to be ready.
   */
  getIdentityCredentialSigner(): CredentialSigner {
    invariant(this._deviceStateMachine.deviceCredentialChain, 'Device credential chain is not ready.');
    return createCredentialSignerWithChain(
      this._signer,
      this._deviceStateMachine.deviceCredentialChain,
      this.deviceKey,
    );
  }

  /**
   * Issues credentials as device.
   */
  getDeviceCredentialSigner(): CredentialSigner {
    return createCredentialSignerWithKey(this._signer, this.deviceKey);
  }

  async admitDevice({ deviceKey, controlFeedKey, dataFeedKey }: DeviceAdmissionRequest) {
    log('Admitting device:', {
      identityKey: this.identityKey,
      hostDevice: this.deviceKey,
      deviceKey,
      controlFeedKey,
      dataFeedKey,
    });
    const signer = this.getIdentityCredentialSigner();
    await writeMessages(
      this.controlPipeline.writer,
      [
        await signer.createCredential({
          subject: deviceKey,
          assertion: {
            '@type': 'dxos.halo.credentials.AuthorizedDevice',
            identityKey: this.identityKey,
            deviceKey,
          },
        }),
        await signer.createCredential({
          subject: controlFeedKey,
          assertion: {
            '@type': 'dxos.halo.credentials.AdmittedFeed',
            spaceKey: this.haloSpaceKey,
            deviceKey,
            identityKey: this.identityKey,
            designation: AdmittedFeed.Designation.CONTROL,
          },
        }),
        await signer.createCredential({
          subject: dataFeedKey,
          assertion: {
            '@type': 'dxos.halo.credentials.AdmittedFeed',
            spaceKey: this.haloSpaceKey,
            deviceKey,
            identityKey: this.identityKey,
            designation: AdmittedFeed.Designation.DATA,
          },
        }),
      ].map((credential): FeedMessage.Payload => ({ credential: { credential } })),
    );
  }
}
