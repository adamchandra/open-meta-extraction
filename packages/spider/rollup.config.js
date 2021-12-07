import ts from 'rollup-plugin-ts';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs'

import pkg from './package.json';
// import rootPkg from '../../package.json';
export default [
  {
    input: 'src/index.ts',
    plugins: [
      resolve({
        rootDir: process.cwd()
      }),
      commonjs(),
      ts({
        tsconfig: './tsconfig.json',
      }),
    ],
    output: [{
      file: './dist/index.js',
      format: 'cjs',
      sourcemap: true
    }],

    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
      // ...Object.keys(rootPkg.dependencies || {}),
      // ...Object.keys(rootPkg.peerDependencies || {}),
      'path', 'util', 'stream', 'os', 'tty', 'events', 'buffer'
    ],
  },
];
