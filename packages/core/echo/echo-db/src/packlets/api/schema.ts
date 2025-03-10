//
// Copyright 2022 DXOS.org
//

import { DocumentModel } from '@dxos/document-model';

export const TYPE_PROPERTIES = 'dxos.org/type/space-properties';
export const TYPE_SCHEMA = 'dxos.org/type/schema'; // TODO(burdon): Experimental.

export type FieldType = 'string' | 'number' | 'boolean' | 'ref';

// TODO(burdon): Protobuf definitions.

export type SchemaRef = {
  schema: string;
  field: string;
};

export type SchemaField = {
  key: string;
  type?: FieldType;
  required: boolean;
  ref?: SchemaRef;
};

export type SchemaDef = {
  schema: string;
  fields: SchemaField[];
};

/**
 * Wrapper for ECHO Item that represents an `DocumentModel` schema.
 */
export class Schema {
  constructor(private readonly _schema: DocumentModel) {}

  get name(): string {
    return this._schema.get('schema');
  }

  get fields(): SchemaField[] {
    return Object.values(this._schema.get('fields') ?? {});
  }

  getField(key: string): SchemaField | undefined {
    return this.fields.find((field) => field.key === key);
  }

  // TODO(kaplanski): What happens if an item has extra properties?
  validate(model: DocumentModel) {
    return this.fields.every((field) => {
      const value = model.get(field.key);
      if (!value) {
        return !field.required;
      }

      if (field.type) {
        // eslint-disable-next-line valid-typeof
        if (typeof value !== field.type) {
          return false;
        }
      }

      if (field.ref) {
        // TODO(kaplanski): Should this class have access to all items in the space to validate?
        // Or maybe possible values should be provided?
      }
      return true;
    });
  }

  // TODO(kaplanski): Should the field be added to each item using the schema in the space? (Empty value?)
  // TODO(kaplanski): Should the type be infered from the first value added?
  async addField(newField: SchemaField) {
    const newFields = [...this.fields, newField];
    // TODO(kaplanski): Create a SET mutation to just modify the field (not all fields).
    await this._schema.set('fields', newFields);
  }

  // TODO(kaplanski): Should editing a field modify all existing items using this schema?
  async editField(currentKey: string, editedField: SchemaField) {
    const newFields = this.fields.map((field) => {
      if (field.key === currentKey) {
        return editedField;
      }
      return field;
    });
    await this._schema.set('fields', newFields);
  }

  async deleteField(key: string) {
    const newFields = this.fields.filter((field) => field.key !== key);
    await this._schema.set('fields', newFields);
  }
}
