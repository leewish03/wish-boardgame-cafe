import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@babel/parser';
import traversePkg from '@babel/traverse';

const traverse = traversePkg.default || traversePkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const JS_GLOBALS = new Set([
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame',
  'console', 'Math', 'Date', 'JSON', 'Object', 'Array', 'String', 'Number',
  'Boolean', 'Set', 'Map', 'Promise', 'Error', 'Uint8Array', 'Audio',
  'AudioContext', 'webkitAudioContext', 'SpeechRecognition', 'webkitSpeechRecognition',
  'RTCPeerConnection', 'RTCSessionDescription', 'RTCIceCandidate',
  'encodeURIComponent', 'decodeURIComponent', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'process', 'global', 'Buffer', 'URL', 'module', 'require',
  'fetch', 'WebSocket', 'Event', 'CustomEvent', 'location', 'history',
  'alert', 'confirm', 'prompt'
]);

function getAllFiles(dir, exts = ['.js', '.jsx', '.ts', '.tsx']) {
  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.name === 'node_modules' || item.name === 'dist' || item.name === '.git') continue;
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(item.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

console.log('🔍 Starting Strict AST Static Analysis & Symbol Verification...');

const targets = [
  ...getAllFiles(path.join(rootDir, 'src')),
  ...getAllFiles(path.join(rootDir, 'server')),
  path.join(rootDir, 'server.js')
];

let totalFilesChecked = 0;
let errorsFound = [];

for (const filePath of targets) {
  totalFilesChecked++;
  const code = fs.readFileSync(filePath, 'utf-8');
  const relPath = path.relative(rootDir, filePath);

  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    traverse(ast, {
      JSXElement(nodePath) {
        const opening = nodePath.node.openingElement;
        const nameNode = opening.name;

        // Simple tag: <Crown />
        if (nameNode.type === 'JSXIdentifier') {
          const name = nameNode.name;
          if (/^[A-Z]/.test(name)) {
            if (!nodePath.scope.hasBinding(name) && !JS_GLOBALS.has(name)) {
              const loc = nameNode.loc?.start;
              errorsFound.push({
                file: relPath,
                line: loc?.line || 0,
                col: loc?.column || 0,
                type: 'Undefined JSX Component',
                symbol: name,
              });
            }
          }
        } else if (nameNode.type === 'JSXMemberExpression') {
          // Member tag: <React.StrictMode>
          let root = nameNode.object;
          while (root.type === 'JSXMemberExpression') {
            root = root.object;
          }
          if (root.type === 'JSXIdentifier') {
            const rootName = root.name;
            if (!nodePath.scope.hasBinding(rootName) && !JS_GLOBALS.has(rootName)) {
              const loc = root.loc?.start;
              errorsFound.push({
                file: relPath,
                line: loc?.line || 0,
                col: loc?.column || 0,
                type: 'Undefined JSX Member Object',
                symbol: rootName,
              });
            }
          }
        }
      },
      ReferencedIdentifier(nodePath) {
        const name = nodePath.node.name;
        // Ignore property names in MemberExpression: obj.prop (unless computed: obj[prop])
        if (nodePath.parentPath.isMemberExpression({ property: nodePath.node })) {
          if (!nodePath.parentPath.node.computed) return;
        }
        // Ignore key in object literal: { key: value } (unless computed: { [key]: value })
        if (nodePath.parentPath.isObjectProperty({ key: nodePath.node })) {
          if (!nodePath.parentPath.node.computed) return;
        }
        // Ignore JSX attribute names: <Component attr={val} />
        if (nodePath.parentPath.isJSXAttribute()) return;
        // Ignore JSX Closing tag names
        if (nodePath.parentPath.isJSXClosingElement()) return;
        // Ignore TypeScript type annotations, interfaces, type aliases
        if (nodePath.findParent(p => p.isTSType && (p.isTSType() || p.isTSTypeAnnotation() || p.isTSInterfaceDeclaration() || p.isTSTypeAliasDeclaration() || p.isTSPropertySignature() || p.isTSMethodSignature() || p.isTSTypeParameter() || p.isTSTypeReference()))) return;

        if (!nodePath.scope.hasBinding(name) && !JS_GLOBALS.has(name)) {
          const loc = nodePath.node.loc?.start;
          errorsFound.push({
            file: relPath,
            line: loc?.line || 0,
            col: loc?.column || 0,
            type: 'Undefined Identifier Reference',
            symbol: name,
          });
        }
      }
    });
  } catch (err) {
    errorsFound.push({
      file: relPath,
      line: 0,
      col: 0,
      type: 'Syntax/Parsing Error',
      symbol: err.message,
    });
  }
}

console.log(`📊 Scanned ${totalFilesChecked} files.`);

if (errorsFound.length > 0) {
  console.error(`\n❌ Found ${errorsFound.length} Symbol / Scope Error(s):`);
  for (const err of errorsFound) {
    console.error(`  - [${err.type}] ${err.file}:${err.line}:${err.col} -> symbol '${err.symbol}'`);
  }
  process.exit(1);
} else {
  console.log('✅ ALL files passed AST Symbol & Scope analysis (0 undefined variables, 0 missing components).\n');
  process.exit(0);
}
