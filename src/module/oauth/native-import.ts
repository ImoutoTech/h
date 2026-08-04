export const nativeImport = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<any>;
