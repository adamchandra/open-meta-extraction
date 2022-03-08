import Async from 'async';


export async function asyncEachOfSeries<A>(
    inputs: A[],
    fn: (a: A) => Promise<unknown>
): Promise<void> {
    return Async.eachOfSeries(inputs, Async.asyncify(fn));
}
