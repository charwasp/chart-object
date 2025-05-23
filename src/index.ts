import { Buffer } from 'buffer';
globalThis.Buffer ??= Buffer; // pngjs uses Buffer, which is not present in the browser

export * from './bps.js';
export * from './speed.js';
export * from './note.js';
export * from './chart.js';
export * from './provider.js';
export * from './music.js';
export type * from './cbt.js';
