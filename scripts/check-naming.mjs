#!/usr/bin/env node
/**
 * @file check-naming.mjs
 * @description 检查项目中所有文件与目录名是否严格受控在 8 个单词以内 (Word Count <= 8)
 * @author Agions
 * @copyright (c) 2026 Dramaxis. All rights reserved.
 */

import { readdirSync, statSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = join(__filename, '..', '..');

const MAX_WORD_LIMIT = 8;
const SUGGEST_THRESHOLD = 5;

const EXCLUDE_DIRS = new Set([
  '.git',
  'node_modules',
  'target',
  'dist',
  'cache',
  '.temp',
  '.vitepress'
]);

const COMPOUND_EXTS = [
  '.test.tsx',
  '.test.ts',
  '.spec.tsx',
  '.spec.ts',
  '.config.mjs',
  '.config.ts',
  '.config.js',
  '.d.ts',
  '.tar.gz'
];

/**
 * 提取文件/目录基础词根并切分英文单词 (CamelCase, snake_case, kebab-case, dot)
 */
function extractWords(filename) {
  let stem = filename;
  for (const ext of COMPOUND_EXTS) {
    if (stem.endsWith(ext)) {
      stem = stem.slice(0, -ext.length);
      break;
    }
  }
  const dotIdx = stem.lastIndexOf('.');
  if (dotIdx > 0) {
    stem = stem.slice(0, dotIdx);
  }

  // 匹配单词：大写驼峰分词、普通小写词、缩写大写词、数字组合
  const words = stem.match(/[A-Z]?[a-z0-9]+|[A-Z]+(?=[A-Z][a-z]|\b)/g) || [];
  return { stem, words };
}

/**
 * 生成简短优化替代名称建议
 */
function suggestShortName(words, isDir) {
  if (words.length <= 2) return words.join(isDir ? '-' : '');
  // 取首词 + 核心尾词
  const first = words[0].toLowerCase();
  const last = words[words.length - 1].toLowerCase();
  return isDir ? `${first}-${last}` : `${first}${words[words.length - 1]}`;
}

const errors = [];
const suggestions = [];
let totalScanned = 0;

function scanDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const name = entry.name;
    if (EXCLUDE_DIRS.has(name) || name.startsWith('.')) {
      continue;
    }

    const fullPath = join(dir, name);
    const relPath = relative(ROOT_DIR, fullPath);
    totalScanned++;

    const isDir = entry.isDirectory();
    const { stem, words } = extractWords(name);
    const wordCount = words.length;

    if (wordCount > MAX_WORD_LIMIT) {
      errors.push({
        type: isDir ? '目录 (DIR)' : '文件 (FILE)',
        path: relPath,
        name,
        wordCount,
        words,
        suggestion: suggestShortName(words, isDir)
      });
    } else if (wordCount >= SUGGEST_THRESHOLD) {
      suggestions.push({
        type: isDir ? '目录 (DIR)' : '文件 (FILE)',
        path: relPath,
        name,
        wordCount,
        words,
        suggestion: suggestShortName(words, isDir)
      });
    }

    if (isDir) {
      scanDir(fullPath);
    }
  }
}

console.log('🔍 开始扫描项目文件与目录命名规范 (限制: <= 8 个单词)...');
scanDir(ROOT_DIR);

console.log(`\n📊 扫描完成：共检查 ${totalScanned} 个文件与目录。`);

if (suggestions.length > 0) {
  console.log(`\n💡 命名精简建议 (当前 5~8 词的条目，可考虑更简短名称):`);
  for (const s of suggestions) {
    console.log(`  • [${s.type}] ${s.path} (${s.wordCount} 词: ${s.words.join(' ')}) -> 建议: ${s.suggestion}`);
  }
}

if (errors.length > 0) {
  console.error(`\n❌ 发现 ${errors.length} 项命名超出 8 个单词限制:`);
  for (const err of errors) {
    console.error(`  • [${err.type}] ${err.path}`);
    console.error(`    当前词数: ${err.wordCount} 词 (${err.words.join(' ')})`);
    console.error(`    建议替代名: ${err.suggestion}`);
  }
  process.exit(1);
} else {
  console.log('\n✅ 校验通过：全库所有文件与目录名均严格符合 <= 8 个单词的规范！');
  process.exit(0);
}
