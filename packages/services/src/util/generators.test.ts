import { randomBytes } from 'crypto';
import { prettyPrint, putStrLn } from '@watr/commonlib';
import { generateFromBatch } from './generators';


// This function generates an array of 10 random 3-letter strings
//  AsyncGenerator<YieldT, ReturnT, NextParamT>
export async function* rndStringBatchGen(
  batchCount: number,
  batchSize: number,
  finalBatchSize: number
): AsyncGenerator<string[], void, void> {
  const randomStrings: string[] = [];
  for (let batchNum = 0; batchNum < batchCount; batchNum++) {
    const bs = batchNum < batchCount - 1 ? batchSize : finalBatchSize;
    for (let i = 0; i < bs; i++) {
      const randomString = randomBytes(3).toString('hex').slice(0, 3);
      randomStrings.push(randomString);
    }
    yield randomStrings;
  }
}

// This function generates an array of 10 random 3-letter strings
export async function* increasingNumStrings(
  batchCount: number,
  batchSize: number,
  finalBatchSize: number
): AsyncGenerator<string[], void, void> {
  let currNum = 0;
  for (let batchNum = 0; batchNum < batchCount; batchNum++) {
    const stringBatch: string[] = [];
    const bs = batchNum < batchCount - 1 ? batchSize : finalBatchSize;
    for (let i = 0; i < bs; i++) {
      const s = currNum.toString().padStart(3, '0');
      stringBatch.push(s);
      currNum++;
    }
    putStrLn(`yielding ${stringBatch}`);
    yield stringBatch;
  }
}

describe('Generator Utils', () => {
  it('generate strings', async () => {
    const generator = generateFromBatch(increasingNumStrings(3, 3, 1), 8);
    let s = await generator.next();
    for (; !s.done; s = await generator.next()) {
      prettyPrint({ msg: 'iter', s });
    }
    prettyPrint({ msg: 'done', s });
  });
  it('end if limit is specified', async () => {
    const limit = 10;
    const generator = generateFromBatch(increasingNumStrings(10, 3, 1), limit);

    let next = await generator.next();
    for(; !next.done; next = await generator.next()) {
      expect(typeof next.value).toBe('string');
    }
    expect(next.value).toEqual(limit);
  });

  it.only('end if limit is specified and batch size is bigger than limit', async () => {
    const limit = 10;
    const generator = generateFromBatch(increasingNumStrings(1, 30, 30), limit);

    let next = await generator.next();
    for(; !next.done; next = await generator.next()) {
      expect(typeof next.value).toBe('string');
    }
    expect(next.value).toEqual(limit);
  });
});
