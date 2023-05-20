//
// Copyright 2022 DXOS.org
//

import expect from 'expect';

import { createDefaultModelFactory } from '@dxos/client';
import { CredentialGenerator, verifyCredential } from '@dxos/credentials';
import {
  MetadataStore,
  MOCK_AUTH_PROVIDER,
  MOCK_AUTH_VERIFIER,
  SnapshotManager,
  SnapshotStore,
  Space,
  SpaceProtocol,
  valueEncoding,
} from '@dxos/echo-pipeline';
import { FeedFactory, FeedStore } from '@dxos/feed-store';
import { Keyring } from '@dxos/keyring';
import { PublicKey } from '@dxos/keys';
import { MemorySignalManager, MemorySignalManagerContext } from '@dxos/messaging';
import { MemoryTransportFactory, NetworkManager } from '@dxos/network-manager';
import { FeedMessage } from '@dxos/protocols/proto/dxos/echo/feed';
import { AdmittedFeed } from '@dxos/protocols/proto/dxos/halo/credentials';
import { createStorage, StorageType } from '@dxos/random-access-storage';
import { afterTest, describe, test } from '@dxos/test';

import { Identity } from './identity';

describe('identity/identity', () => {
  test('create', async () => {
    const keyring = new Keyring();
    const identityKey = await keyring.createKey();
    const deviceKey = await keyring.createKey();
    const spaceKey = await keyring.createKey();

    const feedStore = new FeedStore<FeedMessage>({
      factory: new FeedFactory<FeedMessage>({
        root: createStorage({ type: StorageType.RAM }).createDirectory(),
        signer: keyring,
        hypercore: {
          valueEncoding,
        },
      }),
    });

    const createFeed = async () => {
      const feedKey = await keyring.createKey();
      return feedStore.openFeed(feedKey, { writable: true });
    };

    const controlFeed = await createFeed();
    const dataFeed = await createFeed();

    const protocol = new SpaceProtocol({
      topic: spaceKey,
      swarmIdentity: {
        peerKey: deviceKey,
        credentialProvider: MOCK_AUTH_PROVIDER,
        credentialAuthenticator: MOCK_AUTH_VERIFIER,
      },
      networkManager: new NetworkManager({
        signalManager: new MemorySignalManager(new MemorySignalManagerContext()),
        transportFactory: MemoryTransportFactory,
      }),
    });

    const space: Space = new Space({
      spaceKey,
      protocol,
      genesisFeed: controlFeed,
      feedProvider: (feedKey) => feedStore.openFeed(feedKey),
      memberKey: identityKey,
      modelFactory: createDefaultModelFactory(),
      metadataStore: new MetadataStore(createStorage({ type: StorageType.RAM }).createDirectory()),
      snapshotManager: new SnapshotManager(
        new SnapshotStore(createStorage({ type: StorageType.RAM }).createDirectory()),
      ),
      snapshotId: undefined,
    })
      .setControlFeed(controlFeed)
      .setDataFeed(dataFeed);

    const identity = new Identity({
      signer: keyring,
      identityKey,
      deviceKey,
      space,
    });

    await identity.open();
    afterTest(() => identity.close());

    //
    // Identity genesis
    //
    {
      const generator = new CredentialGenerator(keyring, identityKey, deviceKey);
      const credentials = [
        ...(await generator.createSpaceGenesis(spaceKey, controlFeed.key)),
        await generator.createDeviceAuthorization(deviceKey),
        await generator.createFeedAdmission(spaceKey, dataFeed.key, AdmittedFeed.Designation.DATA),
      ];

      for (const credential of credentials) {
        await identity.controlPipeline.writer.write({
          credential: { credential },
        });
      }
    }

    // Wait for identity to be ready.
    await identity.ready();
    const identitySigner = identity.getIdentityCredentialSigner();
    const credential = await identitySigner.createCredential({
      subject: identityKey,
      assertion: {
        '@type': 'dxos.halo.credentials.IdentityProfile',
        profile: {
          displayName: 'Alice',
        },
      },
    });

    expect(credential.issuer).toEqual(identityKey);
    expect(await verifyCredential(credential)).toEqual({ kind: 'pass' });
  });

  test('two devices', async () => {
    const signalContext = new MemorySignalManagerContext();

    let spaceKey: PublicKey;
    let identityKey: PublicKey;
    let genesisFeedKey: PublicKey;
    let identity1: Identity;
    let identity2: Identity;

    //
    // First device
    //
    {
      const keyring = new Keyring();
      identityKey = await keyring.createKey();
      const deviceKey = await keyring.createKey();
      spaceKey = await keyring.createKey();

      const feedStore = new FeedStore<FeedMessage>({
        factory: new FeedFactory<FeedMessage>({
          root: createStorage({ type: StorageType.RAM }).createDirectory(),
          signer: keyring,
          hypercore: {
            valueEncoding,
          },
        }),
      });

      const createFeed = async () => {
        const feedKey = await keyring.createKey();
        return feedStore.openFeed(feedKey, { writable: true });
      };

      const controlFeed = await createFeed();
      genesisFeedKey = controlFeed.key;

      const dataFeed = await createFeed();

      const protocol = new SpaceProtocol({
        topic: spaceKey,
        swarmIdentity: {
          peerKey: deviceKey,
          credentialProvider: MOCK_AUTH_PROVIDER, // createHaloAuthProvider(createCredentialSignerWithKey(keyring, device_key)),
          credentialAuthenticator: MOCK_AUTH_VERIFIER, // createHaloAuthVerifier(() => identity.authorizedDeviceKeys),
        },
        networkManager: new NetworkManager({
          signalManager: new MemorySignalManager(signalContext),
          transportFactory: MemoryTransportFactory,
        }),
      });

      const space = new Space({
        spaceKey,
        protocol,
        genesisFeed: controlFeed,
        feedProvider: (feedKey) => feedStore.openFeed(feedKey),
        memberKey: identityKey,
        modelFactory: createDefaultModelFactory(),
        metadataStore: new MetadataStore(createStorage({ type: StorageType.RAM }).createDirectory()),
        snapshotManager: new SnapshotManager(
          new SnapshotStore(createStorage({ type: StorageType.RAM }).createDirectory()),
        ),
      })
        .setControlFeed(controlFeed)
        .setDataFeed(dataFeed);

      const identity = (identity1 = new Identity({
        signer: keyring,
        identityKey,
        deviceKey,
        space,
      }));

      await identity.open();
      afterTest(() => identity.close());

      //
      // Identity genesis
      //
      {
        const generator = new CredentialGenerator(keyring, identityKey, deviceKey);
        const credentials = [
          ...(await generator.createSpaceGenesis(spaceKey, controlFeed.key)),
          await generator.createDeviceAuthorization(deviceKey),
          await generator.createFeedAdmission(spaceKey, dataFeed.key, AdmittedFeed.Designation.DATA),
        ];

        for (const credential of credentials) {
          await identity.controlPipeline.writer.write({
            credential: { credential },
          });
        }
      }

      // Wait for identity to be ready.
      await identity.ready();
    }

    //
    // Second device
    //
    {
      const keyring = new Keyring();
      const deviceKey = await keyring.createKey();

      const feedStore = new FeedStore<FeedMessage>({
        factory: new FeedFactory<FeedMessage>({
          root: createStorage({ type: StorageType.RAM }).createDirectory(),
          signer: keyring,
          hypercore: {
            valueEncoding,
          },
        }),
      });

      const createFeed = async () => {
        const feedKey = await keyring.createKey();
        return feedStore.openFeed(feedKey, { writable: true });
      };

      const controlFeed = await createFeed();
      const dataFeed = await createFeed();

      const protocol = new SpaceProtocol({
        topic: spaceKey,
        swarmIdentity: {
          peerKey: deviceKey,
          credentialProvider: MOCK_AUTH_PROVIDER, // createHaloAuthProvider(createCredentialSignerWithKey(keyring, device_key)),
          credentialAuthenticator: MOCK_AUTH_VERIFIER, // createHaloAuthVerifier(() => identity.authorizedDeviceKeys),
        },
        networkManager: new NetworkManager({
          signalManager: new MemorySignalManager(signalContext),
          transportFactory: MemoryTransportFactory,
        }),
      });

      const space = new Space({
        spaceKey,
        protocol,
        genesisFeed: await feedStore.openFeed(genesisFeedKey),
        feedProvider: (feedKey) => feedStore.openFeed(feedKey),
        memberKey: identityKey,
        modelFactory: createDefaultModelFactory(),
        metadataStore: new MetadataStore(createStorage({ type: StorageType.RAM }).createDirectory()),
        snapshotManager: new SnapshotManager(
          new SnapshotStore(createStorage({ type: StorageType.RAM }).createDirectory()),
        ),
      })
        .setControlFeed(controlFeed)
        .setDataFeed(dataFeed);

      const identity = (identity2 = new Identity({
        signer: keyring,
        identityKey: identity1.identityKey,
        deviceKey,
        space,
      }));

      await identity.open();
      afterTest(() => identity.close());
    }

    //
    // Second device admission
    //
    {
      const signer = identity1.getIdentityCredentialSigner();
      void identity1.controlPipeline.writer.write({
        credential: {
          credential: await signer.createCredential({
            subject: identity2.deviceKey,
            assertion: {
              '@type': 'dxos.halo.credentials.AuthorizedDevice',
              identityKey: identity1.identityKey,
              deviceKey: identity2.deviceKey,
            },
          }),
        },
      });

      await identity2.ready();
    }

    expect(Array.from(identity1.authorizedDeviceKeys.values())).toEqual([identity1.deviceKey, identity2.deviceKey]);
    expect(Array.from(identity2.authorizedDeviceKeys.values())).toEqual([identity1.deviceKey, identity2.deviceKey]);
  });
});
