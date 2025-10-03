// Global polyfills for Node.js modules in browser (ESM-safe)
import process from 'process';
import { Buffer } from 'buffer';

// Ensure global alias
(globalThis as any).global = globalThis;

// Provide process polyfill
if (!(globalThis as any).process) {
  (globalThis as any).process = process;
}

// Provide Buffer polyfill
if (!(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}