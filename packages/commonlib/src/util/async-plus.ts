import Async from 'async';

export async function asyncEachOfSeries<A>(
    inputs: A[],
    fn: (a: A) => Promise<unknown>
): Promise<void> {
    return Async.eachOfSeries(inputs, Async.asyncify(fn));
}
export async function asyncEachSeries<A>(
    inputs: A[],
    fn: (a: A) => Promise<unknown>
): Promise<void> {
    return Async.eachSeries(inputs, Async.asyncify(fn));
}

export async function asyncDoUntil<A>(
    fn: () => Promise<A>,
    test: (a: A) => Promise<boolean>
): Promise<void> {
    return Async.doUntil(
        Async.asyncify(fn),
        Async.asyncify(test)
    );
}
export async function asyncForever(
    fn: () => Promise<unknown>
): Promise<void> {
    return Async.doUntil(
        Async.asyncify(fn),
        Async.asyncify(async () => false)
    );
}

export async function asyncMapSeries<A, R, E = Error>(
    inputs: A[],
    fn: (a: A) => Promise<R>
): Promise<R[]> {
    return Async.mapSeries<A, R, E>(inputs, Async.asyncify(fn));
}

export async function asyncDoWhilst<A>(
    fn: () => Promise<A>,
    test: (a: A) => Promise<boolean>
): Promise<void> {
    return Async.doWhilst(
        Async.asyncify(fn),
        Async.asyncify(test)
    );
}
