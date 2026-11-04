#!/usr/bin/env node
// Generate IDE-specific AI rule files from the shared rules in ai-rules/.
//
// Usage:
//   node scripts/generate-ai-rules.mjs <target...>   e.g. claude cursor
//   node scripts/generate-ai-rules.mjs all
//   node scripts/generate-ai-rules.mjs --list
//
// Each source file in ai-rules/ has frontmatter:
//   description: one line
//   globs: []            -> always applied
//   globs:               -> applied only to matching files
//     - "src/**/*.controller.ts"
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(ROOT, 'ai-rules');
const MARKER =
  'AUTO-GENERATED from ai-rules/ — do not edit, run: npm run rules:generate';

function parse_rule(file_name, text) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error(`${file_name}: missing frontmatter`);
  let description = '';
  const globs = [];
  for (const line of match[1].split('\n')) {
    const item = /^\s+-\s*"?([^"]+?)"?\s*$/.exec(line);
    if (item) globs.push(item[1]);
    else if (line.startsWith('description:')) {
      description = line.slice('description:'.length).trim();
    }
  }
  if (!description) throw new Error(`${file_name}: missing description`);
  return {
    name: file_name.replace(/\.md$/, ''),
    description,
    globs,
    body: text.slice(match[0].length).trim(),
  };
}

async function load_rules() {
  const files = (await readdir(SOURCE_DIR))
    .filter((f) => f.endsWith('.md'))
    .sort();
  return Promise.all(
    files.map(async (f) =>
      parse_rule(f, await readFile(join(SOURCE_DIR, f), 'utf8')),
    ),
  );
}

const quote = (value) => JSON.stringify(value);
const comment = `<!-- ${MARKER} -->`;

function frontmatter(lines) {
  return `---\n${lines.join('\n')}\n---\n\n${comment}\n\n`;
}

// One file per rule, written into a directory.
function per_file_target(dir, ext, render_frontmatter) {
  return {
    dir,
    files: (rules) =>
      rules.map((rule) => ({
        path: join(dir, `${rule.name}${ext}`),
        content: render_frontmatter(rule) + rule.body + '\n',
      })),
  };
}

// All rules concatenated into one file (for tools without scoped rules).
function single_file_target(path, title) {
  return {
    files: (rules) => [
      {
        path,
        content:
          `${comment}\n\n# ${title}\n\n` +
          rules
            .map((rule) => {
              const scope = rule.globs.length
                ? `> Áp dụng cho: ${rule.globs.map((g) => `\`${g}\``).join(', ')}\n\n`
                : '';
              return scope + demote_headings(rule.body);
            })
            .join('\n\n---\n\n') +
          '\n',
      },
    ],
  };
}

function demote_headings(body) {
  let in_code = false;
  return body
    .split('\n')
    .map((line) => {
      if (line.startsWith('```')) in_code = !in_code;
      return !in_code && /^#{1,5} /.test(line) ? `#${line}` : line;
    })
    .join('\n');
}

const TARGETS = {
  claude: per_file_target('.claude/rules', '.md', (r) =>
    r.globs.length
      ? frontmatter(['paths:', ...r.globs.map((g) => `  - ${quote(g)}`)])
      : `${comment}\n\n`,
  ),
  cursor: per_file_target('.cursor/rules', '.mdc', (r) =>
    frontmatter([
      `description: ${quote(r.description)}`,
      `globs: ${r.globs.join(',')}`,
      `alwaysApply: ${r.globs.length === 0}`,
    ]),
  ),
  copilot: per_file_target('.github/instructions', '.instructions.md', (r) =>
    frontmatter([
      `applyTo: ${quote(r.globs.length ? r.globs.join(',') : '**')}`,
      `description: ${quote(r.description)}`,
    ]),
  ),
  windsurf: per_file_target('.windsurf/rules', '.md', (r) =>
    frontmatter(
      r.globs.length
        ? ['trigger: glob', `globs: ${r.globs.join(',')}`]
        : ['trigger: always_on'],
    ),
  ),
  agents: single_file_target('AGENTS.md', 'Coding rules'),
  gemini: single_file_target('GEMINI.md', 'Coding rules'),
};

// Remove files a previous run generated, leaving hand-written ones alone.
async function clean(target) {
  if (!target.dir) return;
  const dir = join(ROOT, target.dir);
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    const text = await readFile(path, 'utf8').catch(() => '');
    if (text.includes(MARKER)) await rm(path);
  }
}

async function write_target(name, rules) {
  const target = TARGETS[name];
  await clean(target);
  const files = target.files(rules);
  for (const file of files) {
    const path = join(ROOT, file.path);
    const existing = await readFile(path, 'utf8').catch(() => null);
    if (existing !== null && !existing.includes(MARKER)) {
      throw new Error(
        `${file.path} exists and was not generated; refusing to overwrite`,
      );
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.content);
  }
  console.log(
    `${name}: ${files.length} file(s) -> ${target.dir ?? files[0].path}`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--list')) {
    console.log(`Targets: ${Object.keys(TARGETS).join(', ')}, all`);
    return args.length === 0 ? 1 : 0;
  }
  const names = args.includes('all') ? Object.keys(TARGETS) : args;
  const unknown = names.filter((n) => !(n in TARGETS));
  if (unknown.length) {
    console.error(`Unknown target(s): ${unknown.join(', ')}`);
    return 1;
  }
  const rules = await load_rules();
  for (const name of names) await write_target(name, rules);
  return 0;
}

process.exitCode = await main();
