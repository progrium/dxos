//
// Copyright 2020 DXOS.org
//

import { Doc, Text, XmlElement, XmlText, XmlFragment, applyUpdate, encodeStateAsUpdate } from 'yjs';

import { invariant } from '@dxos/log';
import { Model, ModelMeta, MutationWriter, StateMachine } from '@dxos/model-factory';
import { ItemID, schema } from '@dxos/protocols';
import { TextMutation, TextSnapshot, TextKind } from '@dxos/protocols/proto/dxos/echo/model/text';

type TextModelState = {
  doc: Doc;
  kind: TextKind;
  field: string;
};

class TextModelStateMachine implements StateMachine<TextModelState, TextMutation, TextSnapshot> {
  private _text = { doc: new Doc(), kind: TextKind.PLAIN, field: 'content' };

  getState(): TextModelState {
    return this._text;
  }

  process(mutation: TextMutation): void {
    const { update, clientId, kind, field } = mutation;

    if (kind) {
      this._text.kind = kind;
    }

    if (field) {
      this._text.field = field;
    }

    if (update && clientId !== this._text.doc.clientID) {
      // Passing empty buffer make the process hang: https://github.com/yjs/yjs/issues/498
      invariant(update.length > 0, 'update buffer is empty');
      applyUpdate(this._text.doc, update, { docClientId: clientId });
    }
  }

  snapshot() {
    return {
      data: encodeStateAsUpdate(this._text.doc),
      kind: this._text.kind,
      field: this._text.field,
    };
  }

  reset(snapshot: TextSnapshot): void {
    invariant(snapshot.data);
    applyUpdate(this._text.doc, snapshot.data);
    this._text.kind = snapshot.kind;
    this._text.field = snapshot.field;
  }
}

export class TextModel extends Model<TextModelState, TextMutation> {
  static meta: ModelMeta = {
    type: 'dxos:model/text',
    stateMachine: () => new TextModelStateMachine(),
    mutationCodec: schema.getCodecForType('dxos.echo.model.text.TextMutation'),
    snapshotCodec: schema.getCodecForType('dxos.echo.model.text.TextSnapshot'),
  };

  private _unsubscribe: (() => void) | undefined;

  // prettier-ignore
  constructor(
    meta: ModelMeta,
    itemId: ItemID,
    getState: () => TextModelState,
    writeStream?: MutationWriter<TextMutation>
  ) {
    super(meta, itemId, getState, writeStream);
    this.initialize();
  }

  initialize() {
    this._unsubscribe?.();
    this._unsubscribe = this._subscribeToDocUpdates();
  }

  get doc(): Doc {
    return this._getState().doc;
  }

  get kind(): TextKind {
    return this._getState().kind;
  }

  get field(): string {
    return this._getState().field;
  }

  get content() {
    switch (this.kind) {
      case TextKind.RICH:
        return this.doc.getXmlFragment(this.field);

      default:
        return this.doc.getText(this.field);
    }
  }

  // TODO(burdon): How is this different?
  get textContent() {
    return this._textContentInner(this.content);
  }

  private _subscribeToDocUpdates() {
    const cb = this._handleDocUpdated.bind(this);
    const doc = this.doc; // Preserve reference to doc for unsubscribe.
    doc.on('update', cb);
    return () => {
      doc.off('update', cb);
    };
  }

  private async _handleDocUpdated(update: Uint8Array, origin: any) {
    const remote = origin && origin.docClientId && origin.docClientId !== this.doc.clientID;
    if (!remote) {
      await this.write({
        clientId: this.doc.clientID,
        update,
      });
    }
  }

  private _transact(fn: () => void) {
    return this.doc.transact(fn, {
      docClientId: this.doc.clientID,
    });
  }

  private _textContentInner = (node: any): string => {
    if (node instanceof Text) {
      return node.toString();
    }

    if (node.length === 0) {
      return node instanceof XmlFragment ? '' : '\n';
    }

    const textContentNodes = [];
    const nodes = node.toArray();
    for (const childNode of nodes) {
      textContentNodes.push(this._textContentInner(childNode));
    }

    return textContentNodes.join('\n');
  };

  private _insertInner = (node: unknown, index: number, text: string) => {
    if (node instanceof XmlText) {
      if (index <= node.length) {
        node.insert(index, text);
        return true;
      }

      return node.length;
    }

    let innerIndex = index;
    let childLength = 0;

    if (node instanceof XmlFragment && node.length === 0) {
      // Empty doc, create an empty paragraph.
      const paragraph = new XmlElement('paragraph');
      paragraph.insert(0, [new XmlText('')]);
      node.insert(0, [paragraph]);
    }

    // TODO(dmaretskyi): What is the type of `node` here?
    for (const childNode of (node as any).toArray()) {
      const inserted = this._insertInner(childNode as any, innerIndex, text);
      if (inserted === true) {
        return true;
      }

      childLength += inserted;

      // Previous node length = inserted.
      // Jump block = 1.
      innerIndex -= inserted + 1;
    }

    return childLength;
  };

  insert(text: string, index: number) {
    const content = this.content;
    if (content instanceof Text) {
      return this._transact(() => content.insert(index, text));
    } else {
      return this._transact(() => this._insertInner(content, index, text));
    }
  }

  /**
   * Creates a new `&lt;paragraph&gt;` element with the given text content and inserts it at the given index.
   *
   * Throws if the `Text` instance is plain text.
   */
  insertTextNode(text: string, index = 0) {
    invariant(this.kind === TextKind.RICH, 'insertTextNode only supported for rich text');
    const paragraph = new XmlElement('paragraph');
    const yXmlText = new XmlText(text);
    paragraph.insert(0, [yXmlText]);
    const content = this.content;
    if (content instanceof XmlFragment) {
      return this._transact(() => content.insert(index, [paragraph]));
    }
  }
}
