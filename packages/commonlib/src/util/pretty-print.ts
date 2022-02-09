import * as util from 'util';
import _ from 'lodash';

function getCallerContext() {
  function getErrorObject(): Error {
    try { throw new Error(''); } catch (error: any) { return error; }
  }

  // Get caller context
  const err = getErrorObject();
  const { stack } = err;
  let lines = stack ? stack.split('\n') : [];
  lines = _.dropWhile(lines, (l) => !l.includes('at prettyPrint'));
  lines = _.drop(lines, 1);
  lines = _.takeWhile(lines, l => !l.includes('node_modules'));
  lines = _.take(lines, 3);
  let lpad = '  ';
  const callerContext = _.join(
    _.map(_.reverse(lines), l => {
      let line = _.trim(l);
      const index = line.indexOf('at ');
      line = line.slice(index + 3, line.length);
      const parts = _.split(line, '(');
      const callingContext = _.trim(parts[0]);
      const [path, lineNum, col] = _.split(parts[1], ':');

      _.dropRight(col, 1);

      const pathParts = _.split(path, '/');
      const endPath = _.join(_.slice(pathParts, pathParts.length - 2, pathParts.length), '/');
      const result = `>${lpad}${callingContext}: ${endPath}: ${lineNum}`;
      lpad += lpad;

      return result;
    }), '\n');

  return callerContext;
}

export type InspectOptions = util.InspectOptions & {
  // show calling context in ouput
  showContext: boolean;
};

// export interface InspectOptions {
//   // If true, object's non-enumerable symbols and properties are included
//   showHidden: boolean;

//   // Specifies the number of times to recurse while formatting object. Default: 2.
//   depth: number;

//   // If false, [util.inspect.custom](depth, opts) functions are not invoked. Default: true.
//   customInspect: boolean;

//   // If true, Proxy inspection includes the target and handler objects. Default: false.
//   showProxy: boolean;

//   // If true = ANSI color codes.
//   colors: boolean;

//   // Specifies the maximum number of Array, TypedArray, WeakMap and
//   // WeakSet elements to include. null or Infinity show all elements. 0
//   // negative shows no elements. Default: 100.
//   maxArrayLength: number;

//   //  The length at which input values are split across multiple
//   // lines. Set to Infinity to format the input as a single line (in
//   // combination with compact set to true or any number >= 1). Default: 80.
//   breakLength: number;

//   // false causes each object key to be displayed on a
//   // new line. It will also add new lines to text that is longer than
//   // breakLength. If set to a number, the most n inner elements are united on
//   // a single line as long as all properties fit into breakLength. Short array
//   // elements are also grouped together. No text will be reduced below 16
//   // characters, no matter the breakLength size. For more information, see the
//   // example below. Default: 3.
//   compact: number;

//   // If set to true or a function, all properties of an
//   // object, and Set and Map entries are sorted in the resulting string. If
//   // set to true the default sort is used. If set to a function, it is used as
//   // a compare function.
//   sorted: boolean | ((a: any, b: any) => number);

//   // If set to true, getters are inspected. If set to
//   // 'get', only getters without a corresponding setter are inspected. If set
//   // to 'set', only getters with a corresponding setter are inspected. This
//   // might cause side effects depending on the getter function. Default:
//   // false.
//   getters: boolean | string;

//   // show calling context in ouput
//   showContext: boolean;
// }

const inspectOptionDefaults = {
  showHidden: false,
  depth: 8,
  customInspect: true,
  showProxy: true,
  colors: true,
  maxArrayLength: 100,
  breakLength: 80,
  compact: 10,
  sorted: false,
  getters: false,
  showContext: false,
};


/**
 * Prints out one or more expressions directly to process.stdout, with a few
 *   improvements over console.log to make debug printing easier.
 * Usage:
 *   let x=1, y=2, z=3;
 *   prettyPrint({x, y, z}); <== note use of braces
 *
 * prints:
 *      --- at:
 *      >  caller1: path/file.js: 68
 *      >    caller2: path/file.js: 216
 *
 *      x: 1
 *      y: 2
 *      z: 3
 *      ===
 */
const [fst, lst, mid, sole] = '╭╰│═'.split(''); /*  "┏┗┃═" */

export function prettyPrint(vsobj: any, options: Partial<InspectOptions> = {}): void {
  let callerContext = '';
  // const opts = { ...inspectOptionDefaults, ...options };
  const opts: InspectOptions = _.merge({}, inspectOptionDefaults, options);

  if (opts.showContext) {
    callerContext = getCallerContext();
    callerContext = `--- at:  ${callerContext}\n`;
  }

  const props = Object.getOwnPropertyNames(vsobj);
  const lens = _.map(props, p => p.length);
  const maxlen = _.max(lens) || 0;

  const fmt = _.join(_.map(props, (p, pi) => {
    const isSolo = props.length === 1;
    const isFirst = pi === 0;
    const isLast = pi === props.length - 1;
    const prefixChar = isSolo ? sole
      : (isFirst ? fst
        : isLast ? lst
          : mid);
    const o = vsobj;
    const v = o[p];
    const ins = util.inspect(v, opts);
    const insLines = ins.split('\n');
    const ins0 = insLines[0];

    const indented = _.map(insLines.slice(1), (l) => {
      const indentPad = ''.padEnd(maxlen);
      return `    ${indentPad}${l}`;
    }).join('\n');
    const continuation = indented.length > 0 ? `\n${indented}` : '';
    return `  ${prefixChar} ${p.padEnd(maxlen)}: ${ins0}${continuation}`;
  }), '\n');

  const output = callerContext + fmt;
  putStrLn(output);
}

export function prettyFormat(v: any, options: Partial<InspectOptions> = {}) {
  if (_.isString(v)) {
    return v;
  }
  const opts: InspectOptions = _.merge({}, inspectOptionDefaults, options);
  return util.inspect(v, opts);
}

export function putStrLn(...vs: any[]) {
  const fmts = _.map(vs, v => prettyFormat(v));
  const fmt = fmts.join(' ');
  process.stdout.write(fmt);
  process.stdout.write('\n');
}

