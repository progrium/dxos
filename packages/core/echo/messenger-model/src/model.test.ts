//
// Copyright 2021 DXOS.org
//

import expect from 'expect';

import { ModelFactory } from '@dxos/model-factory';
import { TestBuilder } from '@dxos/model-factory/testing';
import { describe, test } from '@dxos/test';

import { MessengerModel } from './model';

describe.skip('MessengerModel', () => {
  test('send message', async () => {
    const rig = new TestBuilder(new ModelFactory().registerModel(MessengerModel), MessengerModel);
    const peer1 = rig.createPeer();
    const peer2 = rig.createPeer();

    await peer1.model.sendMessage({ text: 'ping', sender: 'peer1' });
    await rig.waitForReplication();
    expect(peer2.model.messages[0].text).toBe('ping');

    await peer2.model.sendMessage({ text: 'pong', sender: 'peer2' });
    await rig.waitForReplication();
    expect(peer1.model.messages[1].text).toBe('pong');
  });
});
