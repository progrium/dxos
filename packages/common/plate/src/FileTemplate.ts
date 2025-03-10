//
// Copyright 2023 DXOS.org
//
import path from 'node:path';

import { Path } from './util/file';
import { isTemplateFile } from './util/filenames';
import { LoadModuleOptions, loadModule } from './util/loadModule';
import { promise } from './util/promise';
import { Slots, Template, FileResults, Options } from './util/template';

export type LoadTemplateOptions = LoadModuleOptions;

export type ExecuteFileTemplateOptions<TInput, TSlots extends Slots<TInput> = Slots<TInput>> = LoadTemplateOptions &
  Options<TInput, TSlots> & {
    src: Path;
  };

export const loadTemplate = async <I = any>(p: string, options?: LoadTemplateOptions): Promise<Template<I> | null> => {
  if (!isTemplateFile(p)) {
    throw new Error(`Failed to load template. Only *.t.ts or *.t.js template files are supported. Attempted: ${p}`);
  }
  const module = await loadModule(p, options);
  const fn = module?.default ?? module;
  return typeof fn === 'function' ? fn : typeof fn === 'string' ? () => fn : null;
};

export const executeFileTemplate = async <TInput, TSlots extends Slots<TInput> = Slots<TInput>>(
  options: ExecuteFileTemplateOptions<TInput, TSlots>,
): Promise<FileResults> => {
  const { src, relativeTo } = {
    ...options,
  };
  const absoluteTemplateRelativeTo = path.resolve(relativeTo ?? '');
  const templateFullPath = path.join(absoluteTemplateRelativeTo, src);
  const templateFunction = await loadTemplate(templateFullPath, options);
  if (!templateFunction) {
    throw new Error(`failed to load template function from ${templateFullPath}`);
  }
  try {
    return promise(templateFunction(options));
  } catch (err) {
    console.error(`problem in template ${templateFullPath}`);
    throw err;
  }
};
