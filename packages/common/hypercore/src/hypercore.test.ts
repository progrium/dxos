//
// Copyright 2019 DXOS.org
//

import { expect } from 'chai';
import { AbstractValueEncoding } from 'hypercore';
import util from 'node:util';

import { Codec } from '@dxos/codec-protobuf';
import { createKeyPair } from '@dxos/crypto';
import { describe, test } from '@dxos/test';

import { createCodecEncoding } from './crypto';
import { HypercoreFactory } from './hypercore-factory';

type TestItem = {
  key: string;
  value: string;
};

const codec: Codec<TestItem> = {
  encode: (obj: TestItem) => Buffer.from(JSON.stringify(obj)),
  decode: (buffer: Uint8Array) => JSON.parse(buffer.toString()),
};

const valueEncoding: AbstractValueEncoding<TestItem> = createCodecEncoding(codec);

describe('Hypercore', () => {
  test('create, append, and close a feed', async () => {
    const factory = new HypercoreFactory<string>();
    const { publicKey, secretKey } = createKeyPair();
    const core = factory.createFeed(publicKey, { secretKey });

    {
      // Append block.
      expect(core.length).to.eq(0);
      const append = util.promisify(core.append.bind(core));
      const seq = await append('test');
      expect(core.length).to.eq(1);
      expect(seq).to.eq(0);
    }

    {
      // Get block.
      const get = util.promisify(core.get.bind(core));
      const block: any = await get(0);
      expect(block.toString()).to.eq('test');
    }
  });

  test('encoding with typed hypercore', async () => {
    const factory = new HypercoreFactory<TestItem>();
    const { publicKey, secretKey } = createKeyPair();
    const core = factory.createFeed(publicKey, { secretKey, valueEncoding });

    {
      const append = util.promisify(core.append.bind(core));

      expect(core.length).to.eq(0);
      const seq = await append({
        key: 'test-1',
        value: 'test',
      });

      expect(core.length).to.eq(1);
      expect(seq).to.eq(0);
    }

    {
      const head = util.promisify(core.head.bind(core));

      const { key, value } = await head();
      expect(key).to.eq('test-1');
      expect(value).to.eq('test');
    }

    {
      const get = util.promisify(core.get.bind(core));

      const { key, value } = await get(0);
      expect(key).to.eq('test-1');
      expect(value).to.eq('test');
    }
  });
});
