//
// Copyright 2022 DXOS.org
//

import assert from 'node:assert';

import { asyncTimeout, Trigger } from '@dxos/async';
import { log } from '@dxos/log';
import { schema } from '@dxos/protocols';
import { TestService } from '@dxos/protocols/proto/example/testing/rpc';
import { createProtoRpcPeer, ProtoRpcPeer } from '@dxos/rpc';

import { ExtensionContext, TeleportExtension } from '../teleport';

interface TestExtensionCallbacks {
  onOpen?: () => Promise<void>;
  onClose?: () => Promise<void>;
}

export class TestExtension implements TeleportExtension {
  public readonly open = new Trigger();
  public readonly closed = new Trigger();
  public extensionContext: ExtensionContext | undefined;
  private _rpc!: ProtoRpcPeer<{ TestService: TestService }>;

  constructor(public readonly callbacks: TestExtensionCallbacks = {}) {}

  get remotePeerId() {
    return this.extensionContext?.remotePeerId;
  }

  async onOpen(context: ExtensionContext) {
    log('onOpen', { localPeerId: context.localPeerId, remotePeerId: context.remotePeerId });
    this.extensionContext = context;
    this._rpc = createProtoRpcPeer<{ TestService: TestService }, { TestService: TestService }>({
      port: context.createPort('rpc', {
        contentType: 'application/x-protobuf; messageType="dxos.rpc.Message"',
      }),
      requested: {
        TestService: schema.getService('example.testing.rpc.TestService'),
      },
      exposed: {
        TestService: schema.getService('example.testing.rpc.TestService'),
      },
      handlers: {
        TestService: {
          voidCall: async (request) => {
            // Ok.
          },
          testCall: async (request) => {
            return {
              data: request.data,
            };
          },
        },
      },
      timeout: 1000,
    });

    await this._rpc.open();
    await this.callbacks.onOpen?.();

    this.open.wake();
  }

  async onClose(err?: Error) {
    log('onClose', { err });
    await this.callbacks.onClose?.();
    this.closed.wake();
    await this._rpc?.close();
  }

  async test(message = 'test') {
    await this.open.wait({ timeout: 500 });
    const res = await asyncTimeout(this._rpc.rpc.TestService.testCall({ data: message }), 500);
    assert(res.data === message);
  }

  /**
   * Force-close the connection.
   */
  async closeConnection(err?: Error) {
    this.extensionContext?.close(err);
  }
}
