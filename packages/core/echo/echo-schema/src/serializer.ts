//
// Copyright 2023 DXOS.org
//

import { DocumentModel } from '@dxos/document-model';
import { TYPE_PROPERTIES } from '@dxos/echo-db';
import { TextModel } from '@dxos/text-model';
import { stripUndefinedValues } from '@dxos/util';

import { EchoDatabase } from './database';
import { base } from './defs';
import { Text } from './text-object';
import { TypedObject } from './typed-object';

export type SerializedObject = {
  '@id': string;
  '@type'?: string;
  '@model'?: string;
  /**
   * Text content of Text object.
   */
  text?: string;
} & Record<string, any>;

export type SerializedSpace = {
  objects: SerializedObject[];
};

// TODO(burdon): Schema not present when reloaded from persistent store.
// TODO(burdon): Option to decode JSON/protobuf.
// TODO(burdon): Sort JSON keys (npm canonical serialize util).
export class Serializer {
  async export(database: EchoDatabase): Promise<SerializedSpace> {
    const { objects } = database.query();
    const data = {
      objects: objects.map((object) => {
        return stripUndefinedValues({
          ...object[base].toJSON(), // TODO(burdon): Not working unless schema.
        });
      }),
    };

    return data;
  }

  async import(database: EchoDatabase, data: SerializedSpace) {
    const {
      objects: [properties],
    } = database.query({ '@type': TYPE_PROPERTIES });
    const { objects } = data;
    for (const object of objects) {
      const { '@id': id, '@type': type, '@model': model, ...data } = object;

      // Handle Space Properties
      // TODO(mykola): move to @dxos/client
      if (properties && type === TYPE_PROPERTIES) {
        Object.entries(data).forEach(([name, value]) => {
          if (!name.startsWith('@')) {
            properties[name] = value;
          }
        });
        continue;
      }

      switch (model) {
        case DocumentModel.meta.type: {
          const Prototype = (type ? database.router.schema?.getPrototype(type) : undefined) ?? TypedObject;
          const echoSchema = type ? database.router.schema?.getType(type) : undefined;

          const obj = new Prototype(
            {
              ...data,
            },
            echoSchema,
          );
          obj[base]._id = id;
          database.add(obj);
          await database.flush();
          break;
        }
        case TextModel.meta.type: {
          const obj = new Text(data.text);
          obj[base]._id = id;
          database.add(obj);
          await database.flush();
          break;
        }
      }
    }
  }
}
