//
// Copyright 2021 DXOS.org
//

import { expect } from 'earljs';
import { it as test } from 'mocha';

import { sleep } from '@dxos/async';
import { Stream } from '@dxos/codec-protobuf';

import { SerializedRpcError } from './errors';
import { RpcPeer } from './rpc';
import { createLinkedPorts } from './testutil';

describe('RpcPeer', () => {
  test('can open', async () => {
    const [alicePort, bobPort] = createLinkedPorts();

    const alice = new RpcPeer({
      messageHandler: async msg => new Uint8Array(),
      port: alicePort
    });
    const bob = new RpcPeer({
      messageHandler: async msg => new Uint8Array(),
      port: bobPort
    });

    await Promise.all([
      alice.open(),
      bob.open()
    ]);
  });

  describe('one-off requests', () => {
    test('can send a request', async () => {
      const [alicePort, bobPort] = createLinkedPorts();

      const alice = new RpcPeer({
        messageHandler: async (method, msg) => {
          expect(method).toEqual('method');
          expect(msg).toEqual(Buffer.from('request'));
          return Buffer.from('response');
        },
        port: alicePort
      });
      const bob = new RpcPeer({
        messageHandler: async (method, msg) => new Uint8Array(),
        port: bobPort
      });

      await Promise.all([
        alice.open(),
        bob.open()
      ]);

      const response = await bob.call('method', Buffer.from('request'));
      expect(response).toEqual(Buffer.from('response'));
    });

    test('can send multiple requests', async () => {
      const [alicePort, bobPort] = createLinkedPorts();

      const alice: RpcPeer = new RpcPeer({
        messageHandler: async (method, msg) => {
          expect(method).toEqual('method');
          await sleep(5);

          const text = Buffer.from(msg).toString();

          if (text === 'error') {
            throw new Error('test error');
          }

          return msg;
        },
        port: alicePort
      });
      const bob = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        port: bobPort
      });

      await Promise.all([
        alice.open(),
        bob.open()
      ]);

      expect(await bob.call('method', Buffer.from('request'))).toEqual(Buffer.from('request'));

      const parallel1 = bob.call('method', Buffer.from('p1'));
      const parallel2 = bob.call('method', Buffer.from('p2'));
      const error = bob.call('method', Buffer.from('error'));

      await expect(await parallel1).toEqual(Buffer.from('p1'));
      await expect(await parallel2).toEqual(Buffer.from('p2'));
      await expect(error).toBeRejected();
    });

    test('errors get serialized', async () => {
      const [alicePort, bobPort] = createLinkedPorts();

      const alice: RpcPeer = new RpcPeer({
        messageHandler: async (method, msg) => {
          expect(method).toEqual('RpcMethodName');
          async function handlerFn (): Promise<never> {
            throw new Error('My error');
          }

          return await handlerFn();
        },
        port: alicePort
      });
      const bob = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        port: bobPort
      });

      await Promise.all([
        alice.open(),
        bob.open()
      ]);

      let error!: Error;
      try {
        await bob.call('RpcMethodName', Buffer.from('request'));
      } catch (err: any) {
        error = err;
      }

      expect(error).toBeA(SerializedRpcError);
      expect(error.message).toEqual('My error');
      expect(error.stack?.includes('handlerFn')).toEqual(true);
      expect(error.stack?.includes('RpcMethodName')).toEqual(true);
    });

    test('closing local endpoint stops pending requests', async () => {
      const [alicePort, bobPort] = createLinkedPorts();

      const alice: RpcPeer = new RpcPeer({
        messageHandler: async (method, msg) => {
          expect(method).toEqual('method');
          await sleep(5);
          return msg;
        },
        port: alicePort
      });
      const bob = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        port: bobPort
      });

      await Promise.all([
        alice.open(),
        bob.open()
      ]);

      const req = bob.call('method', Buffer.from('request'));
      bob.close();

      await expect(req).toBeRejected();
    });

    test('closing remote endpoint stops pending requests on timeout', async () => {
      const [alicePort, bobPort] = createLinkedPorts();

      const alice: RpcPeer = new RpcPeer({
        messageHandler: async (method, msg) => {
          expect(method).toEqual('method');
          await sleep(5);
          return msg;
        },
        port: alicePort
      });
      const bob = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        port: bobPort,
        timeout: 50
      });

      await Promise.all([
        alice.open(),
        bob.open()
      ]);

      alice.close();
      const req = bob.call('method', Buffer.from('request'));

      await expect(req).toBeRejected();
    });

    test('open waits for the other peer to call open', async () => {
      const [alicePort, bobPort] = createLinkedPorts();
      const alice: RpcPeer = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        port: alicePort
      });
      const bob = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        port: bobPort
      });

      let aliceOpen = false;
      const promise = alice.open().then(() => {
        aliceOpen = true;
      });

      await sleep(5);

      expect(aliceOpen).toEqual(false);

      await bob.open();

      expect(aliceOpen).toEqual(true);
      await promise;
    });

    test('one peer can open before the other is created', async () => {
      const [alicePort, bobPort] = createLinkedPorts();

      // eslint-disable-next-line prefer-const
      const alice: RpcPeer = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        port: alicePort
      });
      const aliceOpen = alice.open();

      await sleep(5);

      const bob = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        port: bobPort
      });

      await Promise.all([
        aliceOpen,
        bob.open()
      ]);
    });
  });

  describe('streaming responses', () => {
    test('can transport multiple messages', async () => {
      const [alicePort, bobPort] = createLinkedPorts();

      const alice = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        streamHandler: (method, msg) => {
          expect(method).toEqual('method');
          expect(msg).toEqual(Buffer.from('request'));
          return new Stream<Uint8Array>(({ next, close }) => {
            next(Buffer.from('res1'));
            next(Buffer.from('res2'));
            close();
          });
        },
        port: alicePort
      });
      const bob = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        port: bobPort
      });

      await Promise.all([
        alice.open(),
        bob.open()
      ]);

      const stream = await bob.callStream('method', Buffer.from('request'));
      expect(stream).toBeA(Stream);

      expect(await Stream.consume(stream)).toEqual([
        { data: Buffer.from('res1') },
        { data: Buffer.from('res2') },
        { closed: true }
      ]);
    });

    test('server closes with an error', async () => {
      const [alicePort, bobPort] = createLinkedPorts();

      const alice = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        streamHandler: (method, msg) => {
          expect(method).toEqual('method');
          expect(msg).toEqual(Buffer.from('request'));
          return new Stream<Uint8Array>(({ next, close }) => {
            close(new Error('Test error'));
          });
        },
        port: alicePort
      });
      const bob = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        port: bobPort
      });

      await Promise.all([
        alice.open(),
        bob.open()
      ]);

      const stream = await bob.callStream('method', Buffer.from('request'));
      expect(stream).toBeA(Stream);

      const msgs = await Stream.consume(stream);
      expect(msgs).toEqual([
        { closed: true, error: expect.a(Error) }
      ]);

      expect((msgs[0] as any).error.message).toEqual('Test error');
    });

    test('client closes the stream', async () => {
      const [alicePort, bobPort] = createLinkedPorts();

      let closeCalled = false;
      const alice = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        streamHandler: (method, msg) => {
          return new Stream<Uint8Array>(({ next, close }) => {
            return () => {
              closeCalled = true;
            };
          });
        },
        port: alicePort
      });

      const bob = new RpcPeer({
        messageHandler: async msg => new Uint8Array(),
        port: bobPort
      });

      await Promise.all([
        alice.open(),
        bob.open()
      ]);

      const stream = bob.callStream('method', Buffer.from('request'));
      stream.close();

      await sleep(1);

      expect(closeCalled).toEqual(true);
    });
  });

  test('one peer can open before the other is created', async () => {
    const [alicePort, bobPort] = createLinkedPorts();

    // eslint-disable-next-line prefer-const
    const alice: RpcPeer = new RpcPeer({
      messageHandler: async msg => new Uint8Array(),
      port: alicePort
    });
    const aliceOpen = alice.open();

    await sleep(5);

    const bob = new RpcPeer({
      messageHandler: async msg => new Uint8Array(),
      port: bobPort
    });

    await Promise.all([
      aliceOpen,
      bob.open()
    ]);
  });
});
