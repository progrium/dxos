//
// Copyright 2021 DXOS.org
//

import assert from 'assert';
import protobuf from 'protobufjs';

import { raise } from '@dxos/debug';
import { ComplexMap, isNotNullOrUndefined } from '@dxos/util';

import {
  RecordExtension,
  decodeExtensionPayload, decodeProtobuf, encodeExtensionPayload,
  encodeProtobuf, sanitizeExtensionData
} from '../encoding';
import { Record as RawRecord } from '../proto';
import { AccountKey } from './account-key';
import { CID } from './cid';
import { DomainKey } from './domain-key';
import { DXN } from './dxn';
import { Filtering, Query } from './queries';
import { Domain, RegistryClientBackend, Resource } from './registry';

export type RegistryRecord<T = any> = Omit<RawRecord, 'payload' | 'type'> & {
  cid: CID,
  payload: RecordExtension<T>
}

export type RegistryType = Omit<RawRecord, 'payload' | 'type'> & {
  cid: CID,
  type: {
    /**
     * FQN of the root message in the protobuf definitions.
     * NOTE: Should not be used to name this type.
     */
    messageName: string
    protobufDefs: protobuf.Root
    /**
     * Source of the type definition.
     */
    protobufIpfsCid?: CID
  }
}

/**
 * Record metadata provided by the user.
 */
export interface RecordMetadata {
  displayName?: string
  description?: string
  tags?: string[]
}

export interface TypeRecordMetadata extends RecordMetadata {
  protobufIpfsCid?: string
}

/**
 * Main API for DXNS registry.
 */
export class RegistryClient {
  private readonly _recordCache = new ComplexMap<CID, Promise<RegistryRecord | undefined>>(cid => cid.toB58String())
  private readonly _typeCache = new ComplexMap<CID, Promise<RegistryType | undefined>>(cid => cid.toB58String())

  constructor (
    private readonly _backend: RegistryClientBackend
  ) {}

  //
  // Domains
  //

  /**
   * Resolves a domain key from the domain name.
   * @param domainName Name of the domain.
   */
  async getDomainKey (domainName: string): Promise<DomainKey> {
    return this._backend.getDomainKey(domainName);
  }

  /**
   * Returns a list of domains created in DXOS system.
   */
  async getDomains (): Promise<Domain[]> {
    return this._backend.getDomains();
  }

  /**
   * Creates a new domain in the system under a generated name.
   * @param account DXNS account that will own the domain.
   */
  async registerDomainKey (account: AccountKey): Promise<DomainKey> {
    return this._backend.registerDomainKey(account);
  }

  //
  // Resources
  //

  /**
   * Gets resource by its registered name.
   * @param name DXN of the resource used for registration.
   */
  async getResource (name: DXN): Promise<Resource | undefined> {
    return this._backend.getResource(name);
  }

  /**
   * Queries resources registered in the system.
   * @param query Query that each returned record must meet.
   */
  async getResources (query?: Query): Promise<Resource[]> {
    const resources = await this._backend.getResources();

    return resources.filter(resource => Filtering.matchResource(resource, query));
  }

  /**
   * Registers or updates a resource in the system.
   * Undefined CID means that the resource will be deleted.
   * @param name Identifies the domain and name of the resource.
   * @param tag Tag for the resource.
   * @param cid CID of the record to be referenced with the given name.
   * @param owner DXNS account that will own the resource.
   */
  async registerResource (
    name: DXN,
    tag,
    cid: CID | undefined,
    owner: AccountKey
  ): Promise<void> {
    return this._backend.registerResource(name, cid, owner, tag);
  }

  //
  // Records
  //

  /**
   * Gets record details by CID.
   * @param cid CID of the record.
   */
  async getRecord<T> (cid: CID): Promise<RegistryRecord<T> | undefined> {
    if (this._recordCache.has(cid)) {
      return this._recordCache.get(cid);
    }

    const recordPromise = this._fetchRecord(cid);
    this._recordCache.set(cid, recordPromise);

    return recordPromise;
  }

  /**
   * Gets resource by its registered name.
   * @param name DXN of the resource used for registration.
   */
  async getRecordByName<T> (name: DXN): Promise<RegistryRecord<T> | undefined> {
    const resource = await this.getResource(name);
    if (!resource) {
      return undefined;
    }

    const tag = name.tag ?? 'latest';
    const cid = resource.tags[tag];
    if (!cid) {
      return undefined;
    }

    const record = await this.getRecord<T>(cid);
    return record;
  }

  /**
   * Queries all records in the system.
   * @param query Query that each returned record must meet.
   */
  async getRecords (query?: Query): Promise<RegistryRecord[]> {
    const rawRecords = await this._backend.getRecords();
    const records = await Promise.all(rawRecords.map(({ cid, ...record }) =>
      this._decodeRecord(cid, record)
    ));

    return records
      .filter(isNotNullOrUndefined)
      .filter(record => Filtering.matchRecord(record, query));
  }

  /**
   * Creates a new data record in the system.
   * @param data Payload data of the record.
   * @param typeId CID of the type record that holds the schema of the data.
   * @param meta Record metadata information.
   */
  async registerRecord (data: unknown, typeId: CID, meta: RecordMetadata = {}): Promise<CID> {
    const type = await this.getTypeRecord(typeId);
    assert(type);

    const record = {
      ...meta,
      created: new Date(),
      payload: await encodeExtensionPayload(sanitizeExtensionData(data, CID.from(typeId)),
        async cid => (await this.getTypeRecord(cid)) ?? raise(new Error(`Type not found: ${cid}`)))
    };

    return this._backend.registerRecord(record);
  }

  /**
   * Gets type records details by CID.
   * @param cid CID of the record.
   */
  async getTypeRecord (cid: CID): Promise<RegistryType | undefined> {
    if (this._typeCache.has(cid)) {
      return this._typeCache.get(cid);
    }

    const typePromise = this._fetchType(cid);
    this._typeCache.set(cid, typePromise);

    return typePromise;
  }

  /**
   * Queries type records.
   * @param query Query that each returned record must meet.
   */
  async getTypeRecords (query?: Query): Promise<RegistryType[]> {
    const records = await this._backend.getRecords();

    const types = records
      .filter(record => !!record.type)
      .map(({ cid, ...record }) => this._decodeType(cid, record));

    return types;
  }

  /**
   * Creates a new type record in the system.
   * @param schema Protobuf schema of the type.
   * @param messageFqn Fully qualified name of the message. It must reside in the schema definition.
   * @param meta Record metadata information.
   */
  async registerTypeRecord (messageName: string, schema: protobuf.Root, meta: TypeRecordMetadata = {}) {
    // Make sure message type exists.
    schema.lookupType(messageName);

    const record = {
      ...meta,
      created: new Date(),
      type: {
        messageName,
        protobufDefs: encodeProtobuf(schema),
        protobufIpfsCid: meta.protobufIpfsCid
      }
    };

    return this._backend.registerRecord(record);
  }

  private async _fetchRecord (cid: CID): Promise<RegistryRecord | undefined> {
    const rawRecord = await this._backend.getRecord(cid);
    const record = rawRecord && await this._decodeRecord(cid, rawRecord);
    return record;
  }

  private async _decodeRecord (cid: CID, rawRecord: RawRecord): Promise<RegistryRecord | undefined> {
    if (!rawRecord.payload) {
      return undefined;
    }

    const payload = await decodeExtensionPayload(rawRecord.payload, async (cid: CID) =>
      await this.getTypeRecord(cid) ?? raise(new Error(`Type not found: ${cid}`))
    );

    return {
      ...rawRecord,
      cid,
      payload
    };
  }

  private async _fetchType (cid: CID): Promise<RegistryType | undefined> {
    const record = await this._backend.getRecord(cid);
    if (!record) {
      return undefined;
    }

    return this._decodeType(cid, record);
  }

  private _decodeType (cid: CID, rawRecord: RawRecord): RegistryType {
    if (!rawRecord.type) {
      throw new Error('Invalid type');
    }

    const { messageName, protobufDefs, protobufIpfsCid } = rawRecord.type;
    assert(messageName);
    assert(protobufDefs);

    return {
      ...rawRecord,
      cid,
      type: {
        messageName,
        protobufDefs: decodeProtobuf(protobufDefs),
        protobufIpfsCid: protobufIpfsCid ? CID.from(protobufIpfsCid) : undefined
      }
    };
  }
}
