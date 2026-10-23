import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function markdownFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? markdownFiles(path)
      : entry.name.endsWith('.md')
        ? [path]
        : [];
  });
}

// Extensions a backticked module path may omit, as imports do.
const moduleSuffixes = ['.ts', '.tsx', '.js', '.mjs', '.ios.tsx', '.web.tsx'];

// A backticked path whose first segment is a top-level repository directory
// must exist, so renamed or deleted files don't linger in docs. Placeholders
// (`<name>`, globs, `${var}`, ellipses) are not paths.
function missingCodePaths(line, root, topLevel) {
  return [...line.matchAll(/(`+)([^`]+?)\1/g)]
    .map((match) => match[2].trim())
    .filter(
      (text) =>
        !/[\s<>*{}$…]|\.\.\./.test(text) &&
        topLevel.has(text.split('/')[0]) &&
        text.includes('/'),
    )
    .filter((text) => {
      const path = resolve(root, text.replace(/[#:].*$/, ''));
      return ![path, ...moduleSuffixes.map((suffix) => path + suffix)].some(
        (candidate) => existsSync(candidate),
      );
    });
}

// Generated, git-ignored outputs (`.verification/`, postinstall's
// `public/canvaskit.wasm`) need not exist in every checkout.
function gitIgnored(root, paths) {
  if (!paths.length) return new Set();
  const result = spawnSync('git', ['-C', root, 'check-ignore', '--stdin'], {
    input: paths.join('\n'),
    encoding: 'utf8',
  });
  // Status 1 means none are ignored; 128 means root is not a repository.
  return new Set(result.status === 0 ? result.stdout.split('\n') : []);
}

// Check filesystem destinations, not remote URLs or heading fragments.
export function checkDocs(root) {
  const topLevel = new Set(
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== '.git')
      .map((entry) => entry.name),
  );
  const missingPaths = [];
  const files = [
    ...readdirSync(root)
      .filter((name) => name.endsWith('.md'))
      .map((name) => join(root, name)),
    ...markdownFiles(join(root, 'docs')),
    ...markdownFiles(join(root, 'assets/licenses')),
  ];
  const issues = [];
  const indexFile = resolve(root, 'docs/index.md');
  const indexed = new Set([indexFile]);
  if (!existsSync(indexFile))
    issues.push('docs/index.md: missing documentation index');
  for (const file of files) {
    let fence;
    for (const [index, raw] of readFileSync(file, 'utf8')
      .split('\n')
      .entries()) {
      const delimiter = raw.match(/^\s{0,3}(`{3,}|~{3,})/);
      if (delimiter) {
        if (!fence) fence = delimiter[1];
        else if (
          delimiter[1][0] === fence[0] &&
          delimiter[1].length >= fence.length
        )
          fence = undefined;
        continue;
      }
      if (fence || /^( {4}|\t)/.test(raw)) continue;
      for (const path of missingCodePaths(raw, root, topLevel)) {
        missingPaths.push({
          location: `${relative(root, file)}:${index + 1}`,
          path,
        });
      }
      const line = raw.replace(/(`+).*?\1/g, '');
      const destinations = [
        ...line.matchAll(
          /!?\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+['"][^)]*)?\s*\)/g,
        ),
      ].map((match) => match[1]);
      const reference = line.match(/^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/);
      if (reference) destinations.push(reference[1]);
      for (const destination of destinations) {
        const target = destination.replace(/^<|>$/g, '');
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) continue;
        try {
          const path = decodeURIComponent(target.split(/[?#]/)[0]);
          if (path && resolve(file) === indexFile) {
            indexed.add(resolve(file, '..', path));
          }
          if (path && !existsSync(resolve(file, '..', path))) {
            issues.push(
              `${relative(root, file)}:${index + 1}: missing local link ${target}`,
            );
          }
        } catch {
          issues.push(
            `${relative(root, file)}:${index + 1}: invalid link encoding ${target}`,
          );
        }
      }
    }
  }
  const ignoredPaths = gitIgnored(
    root,
    missingPaths.map(({ path }) => path.replace(/[#:].*$/, '')),
  );
  for (const { location, path } of missingPaths) {
    if (!ignoredPaths.has(path.replace(/[#:].*$/, '')))
      issues.push(`${location}: missing repository path ${path}`);
  }
  for (const file of files) {
    if (!indexed.has(resolve(file))) {
      issues.push(`${relative(root, file)}: not linked from docs/index.md`);
    }
  }
  return issues;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const issues = checkDocs(fileURLToPath(new URL('../', import.meta.url)));
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      'Documentation local links, repository paths and index coverage OK (root Markdown, docs, asset licenses).',
    );
  }
}
