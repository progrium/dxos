//
// Copyright 2020 DXOS.org
//

import { checkType } from '@dxos/debug';
import { schema } from '@dxos/protocols';
import type { TestItemMutation, TestItemSnapshot } from '@dxos/protocols/proto/example/testing/data';

import { Model } from '../model';
import { ModelMeta, StateMachine } from '../types';

class TestModelStateMachine implements StateMachine<Map<any, any>, TestItemMutation, TestItemSnapshot> {
  private readonly _state = new Map();

  getState(): Map<any, any> {
    return this._state;
  }

  process(mutation: TestItemMutation): void {
    const { key, value } = mutation;
    this._state.set(key, value);
  }

  snapshot(): TestItemSnapshot {
    return {
      keys: Array.from(this._state.entries()).map(([key, value]) => ({
        key,
        value,
      })),
    };
  }

  reset(snapshot: TestItemSnapshot): void {
    this._state.clear();
    (snapshot.keys ?? []).forEach(({ key, value }) => this._state.set(key, value));
  }
}

export class TestModel extends Model<Map<any, any>, TestItemMutation> {
  static meta: ModelMeta = {
    type: 'dxos.org/model/test',
    stateMachine: () => new TestModelStateMachine(),
    mutationCodec: schema.getCodecForType('example.testing.data.TestItemMutation'),
    snapshotCodec: schema.getCodecForType('example.testing.data.TestItemSnapshot'),
  };

  get keys() {
    return Array.from(this._getState().keys());
  }

  get properties() {
    return Object.fromEntries(this._getState());
  }

  get(key: string) {
    return this._getState().get(key);
  }

  async set(key: string, value: string) {
    const receipt = await this.write(
      checkType<TestItemMutation>({
        key,
        value,
      }),
    );

    await receipt.waitToBeProcessed();
  }
}
