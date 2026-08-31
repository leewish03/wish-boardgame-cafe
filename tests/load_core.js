import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const moduleCache = new Map();

export function loadTs(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (moduleCache.has(resolvedPath)) {
    return moduleCache.get(resolvedPath);
  }

  const content = fs.readFileSync(resolvedPath, 'utf8');
  const transformed = esbuild.transformSync(content, {
    loader: 'ts',
    target: 'node18',
    format: 'cjs',
  });
  const m = { exports: {} };
  moduleCache.set(resolvedPath, m.exports);

  const dirname = path.dirname(resolvedPath);
  const customRequire = (reqPath) => {
    let resolved = path.resolve(dirname, reqPath);
    if (!resolved.endsWith('.ts') && !resolved.endsWith('.js')) {
      if (fs.existsSync(resolved + '.ts')) resolved += '.ts';
      else if (fs.existsSync(resolved + '.js')) resolved += '.js';
    }
    if (resolved.endsWith('.ts')) {
      return loadTs(resolved);
    }
    return require(resolved);
  };
  const fn = new Function('module', 'exports', 'require', '__dirname', '__filename', transformed.code);
  fn(m, m.exports, customRequire, dirname, resolvedPath);
  moduleCache.set(resolvedPath, m.exports);
  return m.exports;
}

export const core = loadTs(path.join(rootDir, 'packages/love-letter-core/src/index.ts'));
