//
// Copyright 2022 DXOS.org
//

import alea from 'alea';
import { useMemo } from 'react';

interface PrngFactory {
  new (seed?: string): () => number;
}

const Alea: PrngFactory = alea as unknown as PrngFactory;

const prng = new Alea('@dxos/react-hooks');

// TODO(burdon): Replace with PublicKey.random() but consider removing (dangerous mis-use of ECHO objects).
export const randomString = (n = 4) =>
  prng()
    .toString(16)
    .slice(2, n + 2);

export const useId = (namespace: string, propsId?: string, opts?: Partial<{ n: number }>) =>
  useMemo(() => propsId ?? `${namespace}-${randomString(opts?.n ?? 4)}`, [propsId]);
