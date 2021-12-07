import ts from 'rollup-plugin-ts';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs'

import pkg from './package.json';
export default [
  {
    input: 'src/cli/index.ts',
    plugins: [
      resolve({
        rootDir: process.cwd()
      }),
      commonjs(),
      ts({
        tsconfig: './tsconfig.json',
      }),
    ],
    output: [{ dir: './dist', format: 'cjs', sourcemap: true }],

    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
      'path', 'util', 'stream', 'os', 'tty', 'events', 'buffer'
    ],
  },
];
