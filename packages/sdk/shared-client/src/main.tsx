//
// Copyright 2022 DXOS.org
//

import { createIFramePort, PortMuxer } from '@dxos/rpc-tunnel';
import { WebRTCTransportService } from '@dxos/network-manager';
import { createProtoRpcPeer } from '@dxos/rpc';
import { schema } from '@dxos/protocols';
import { BridgeService } from '@dxos/protocols/proto/dxos/mesh/bridge';

if (typeof SharedWorker !== 'undefined') {
  void (async () => {
    const worker = new SharedWorker(new URL('./shared-worker', import.meta.url), { type: 'module' });
    const muxer = new PortMuxer(worker.port);

    const clientPort = muxer.createWorkerPort({ channel: 'dxos' });
    const appPort = createIFramePort({ channel: 'dxos' });

    clientPort.subscribe(msg => appPort.send(msg));
    appPort.subscribe(msg => clientPort.send(msg));


    const wrtcPort = muxer.createWorkerPort({ channel: 'dxos:wrtc' });
    const transportService = new WebRTCTransportService();
    const peer = createProtoRpcPeer({
      exposed: {
        BridgeService: schema.getService('dxos.mesh.bridge.BridgeService')
      },
      requested: {},
      handlers: {
        BridgeService: transportService as BridgeService
      },
      port: wrtcPort
    })

    await peer.open();
  })();
} else {
  throw new Error('Requires a browser with support for shared workers.');
}