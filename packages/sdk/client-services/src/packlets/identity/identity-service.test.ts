//
// Copyright 2023 DXOS.org
//

import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { Trigger } from '@dxos/async';
import { Context } from '@dxos/context';
import { PublicKey } from '@dxos/keys';
import { Identity, IdentityService } from '@dxos/protocols/proto/dxos/client/services';
import { afterEach, afterTest, beforeEach, describe, test } from '@dxos/test';

import { IdentityServiceImpl } from './identity-service';
import { ServiceContext } from '../services';
import { createServiceContext } from '../testing';

chai.use(chaiAsPromised);

describe('IdentityService', () => {
  let serviceContext: ServiceContext;
  let identityService: IdentityService;

  beforeEach(async () => {
    serviceContext = createServiceContext();
    await serviceContext.open(new Context());
    identityService = new IdentityServiceImpl(
      (options) => serviceContext.createIdentity(options),
      serviceContext.identityManager,
      serviceContext.keyring,
    );
  });

  afterEach(async () => {
    await serviceContext.close();
  });

  describe('createIdentity', () => {
    test('creates a new identity', async () => {
      const identity = await identityService.createIdentity({});

      expect(identity.identityKey).to.be.instanceof(PublicKey);
      expect(identity.spaceKey).to.be.instanceof(PublicKey);
    });

    test('creates a new identity with a display name', async () => {
      const identity = await identityService.createIdentity({ displayName: 'Example' });

      expect(identity.identityKey).to.be.instanceof(PublicKey);
      expect(identity.spaceKey).to.be.instanceof(PublicKey);
      expect(identity.profile?.displayName).to.equal('Example');
    });

    test('fails to create identity if one already exists', async () => {
      await identityService.createIdentity({});
      await expect(identityService.createIdentity({})).to.be.rejectedWith('Identity already exists');
    });
  });

  describe.skip('recoverIdentity', () => {});

  describe('updateProfile', () => {
    test('updates profile', async () => {
      const identity = await identityService.createIdentity({});
      expect(identity.profile?.displayName).to.be.undefined;

      const updatedIdentity = await identityService.updateProfile({ displayName: 'Example' });
      expect(updatedIdentity.profile?.displayName).to.equal('Example');
    });
  });

  describe('queryIdentity', () => {
    test('returns undefined if no identity is available', async () => {
      const query = identityService.queryIdentity();
      const result = new Trigger<Identity | undefined>();
      query.subscribe(({ identity }) => {
        result.wake(identity);
      });
      afterTest(() => query.close());
      expect(await result.wait()).to.be.undefined;
    });

    test('updates when identity is created', async () => {
      const query = identityService.queryIdentity();
      let result = new Trigger<Identity | undefined>();
      query.subscribe(({ identity }) => {
        result.wake(identity);
      });
      afterTest(() => query.close());
      expect(await result.wait()).to.be.undefined;

      result = new Trigger<Identity | undefined>();
      const identity = await identityService.createIdentity({});
      expect(await result.wait()).to.deep.equal(identity);
    });
  });
});
