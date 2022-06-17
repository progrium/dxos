//
// Copyright 2021 DXOS.org
//

import assert from 'assert';

import { CID, DXN, RegistryClient } from '@dxos/registry-client';

import { BotPackageSpecifier } from '../proto/gen/dxos/bot';
import { Bot } from '../proto/gen/dxos/type';

export type ContentResolverResult = Omit<BotPackageSpecifier, 'dxn' | 'name'>;

export interface ContentResolver {
  /**
   * Resolves resource identifier to a specifier where the content can be downloaded from.
   * @returns A specifier where the content can be downloaded from.
   */
  resolve: ({ name }: { name: string }) => Promise<ContentResolverResult>;
}

export class DXNSContentResolver implements ContentResolver {
  constructor (
    private readonly _registry: RegistryClient
  ) {}

  async resolve ({ name }: { name: string }): Promise<ContentResolverResult> {
    const botDXN = DXN.parse(name);
    const botRecord = await this._registry.getRecordByName<Bot>(botDXN);
    assert(botRecord, `Bot resource not found: ${name.toString()}`);
    const botIpfsCID = botRecord.payload.bundle;
    const botLocalPath = botRecord.payload.localPath;
    if (!botIpfsCID && !botLocalPath) {
      throw new Error(`Unable to resolve bot content byt the provided dxn: ${name.toString()}`);
    }

    const result: ContentResolverResult = {};
    if (botIpfsCID) {
      result.ipfsCid = CID.from(botIpfsCID).toString();
    }
    result.localPath = botLocalPath;
    return result;
  }
}
