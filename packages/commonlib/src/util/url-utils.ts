import * as E from 'fp-ts/Either';

export function toUrl(instr: unknown, baseUrl: string|URL|undefined = undefined): URL | string {
  if (typeof instr !== 'string') {
    return 'toURL error: input must be string';
  }
  const str = instr.trim();
  if (instr.includes(' ')) {
    return 'toURL error: input string has spaces';
  }

  try {
    return new URL(str, baseUrl); // eslint-disable-line no-new
  } catch (error) {
    return `toURL error: new URL() threw ${error}`;
  }
}

export function isUrl(instr: unknown): boolean {
  return typeof toUrl(instr) !== 'string';
}

export function validateUrl(instr: unknown): E.Either<string, URL> {
  const maybeUrl = toUrl(instr);
  const isUrl =  typeof maybeUrl !== 'string';
  if (isUrl) {
    return E.right(maybeUrl);
  }

  return E.left(maybeUrl);
}
