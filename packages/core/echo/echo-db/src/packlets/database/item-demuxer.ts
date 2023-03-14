//
// Copyright 2020 DXOS.org
//

import assert from 'node:assert';

import { Event } from '@dxos/async';
import { log } from '@dxos/log';
import { ModelFactory } from '@dxos/model-factory';
import { IEchoStream, ItemID } from '@dxos/protocols';
import { EchoObject } from '@dxos/protocols/proto/dxos/echo/object';
import { EchoSnapshot } from '@dxos/protocols/proto/dxos/echo/snapshot';

import { setMetadataOnObject } from './builder';
import { ItemManager } from './item-manager';

export type EchoProcessor = (message: IEchoStream) => void;

/**
 * Creates a stream that consumes `IEchoStream` messages and routes them to the associated items.
 * @param itemManager
 */
export class ItemDemuxer {
  readonly mutation = new Event<IEchoStream>();

  constructor(private readonly _itemManager: ItemManager, private readonly _modelFactory: ModelFactory) {}

  open(): EchoProcessor {
    this._modelFactory.registered.on(async (model) => {
      for (const item of this._itemManager.getUninitializedEntities()) {
        if (item.modelType === model.meta.type) {
          await this._itemManager.initializeModel(item.id);
        }
      }
    });

    // TODO(burdon): Factor out.
    // TODO(burdon): Should this implement some "back-pressure" (hints) to the SpaceProcessor?
    return async (message: IEchoStream) => {
      const { batch, meta } = message;

      for (const object of batch.objects ?? []) {
        const { objectId, genesis, mutations } = object;
        assert(objectId);

        //
        // New item.
        //
        if (genesis) {
          const { modelType } = genesis;
          assert(modelType);

          const entity = this._itemManager.constructItem({
            itemId: objectId,
            modelType
          });

          setMetadataOnObject(object, meta);
          entity.resetToSnapshot(object);

          assert(entity.id === objectId);
        } else {
          if (mutations && mutations.length > 0) {
            for (const mutation of mutations) {
              // Forward mutations to the item's stream.
              this._itemManager.processMutation(objectId, {
                ...mutation,
                meta
              });
            }
          }
        }

        this.mutation.emit(message);
      }
    };
  }

  createSnapshot(): EchoSnapshot {
    return {
      items: this._itemManager.items.map((item) => item.createSnapshot())
    };
  }

  restoreFromSnapshot(snapshot: EchoSnapshot) {
    const { items = [] } = snapshot;

    log(`Restoring ${items.length} items from snapshot.`);
    for (const item of sortItemsTopologically(items)) {
      assert(item.objectId);
      assert(item.genesis?.modelType);
      assert(item.snapshot);

      const obj = this._itemManager.constructItem({
        itemId: item.objectId,
        modelType: item.genesis.modelType
      });
      obj.resetToSnapshot(item);
    }
  }
}

/**
 * Sort based on parents.
 * @param items
 */
export const sortItemsTopologically = (items: EchoObject[]): EchoObject[] => {
  const snapshots: EchoObject[] = [];
  const seenIds = new Set<ItemID>();

  while (snapshots.length !== items.length) {
    const prevLength = snapshots.length;
    for (const item of items) {
      assert(item.objectId);
      if (!seenIds.has(item.objectId) && (!item.snapshot?.parentId || seenIds.has(item.snapshot.parentId))) {
        snapshots.push(item);
        seenIds.add(item.objectId);
      }
    }
    if (prevLength === snapshots.length && snapshots.length !== items.length) {
      throw new Error('Cannot topologically sorts items in snapshot: some parents are missing.');
    }
  }

  return snapshots;
};
