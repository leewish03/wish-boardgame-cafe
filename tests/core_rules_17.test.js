import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadTs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const transformed = esbuild.transformSync(content, {
    loader: 'ts',
    target: 'node18',
    format: 'cjs',
  });
  const m = { exports: {} };
  const dirname = path.dirname(filePath);
  const customRequire = (reqPath) => {
    if (!reqPath.startsWith('.') && !path.isAbsolute(reqPath)) {
      return nodeRequire(reqPath);
    }
    let resolved = path.resolve(dirname, reqPath);
    if (!resolved.endsWith('.ts') && !resolved.endsWith('.js')) {
      if (fs.existsSync(resolved + '.ts')) resolved += '.ts';
      else if (fs.existsSync(resolved + '.js')) resolved += '.js';
      else if (fs.existsSync(path.join(resolved, 'index.ts'))) resolved = path.join(resolved, 'index.ts');
      else if (fs.existsSync(path.join(resolved, 'index.js'))) resolved = path.join(resolved, 'index.js');
    }
    if (resolved.endsWith('.ts')) {
      return loadTs(resolved);
    }
    return nodeRequire(resolved);
  };
  const fn = new Function('module', 'exports', 'require', '__dirname', '__filename', transformed.code);
  fn(m, m.exports, customRequire, dirname, filePath);
  return m.exports;
}

const root = path.resolve(__dirname, '../');
const testPath = path.join(root, 'packages/love-letter-core/tests/core_17_rules.test.ts');
loadTs(testPath);
