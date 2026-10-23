// Publishes the source of one app build to the public source repository, as
// the GPL requires for builds that link Stockfish: the tree at `<commit>`, as
// one new commit tagged `<tag>`, authored by the GitHub noreply address so no
// personal email is published. Development history stays in this repository.
//
//   npm run source:publish -- <commit> <tag>     e.g. c191bd8 ios-build-62
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repo =
  process.env.KNIGHTLY_SOURCE_REPO ?? 'hunterrhansen/knightly-source';
const author = 'hunterrhansen';
const email = '67199212+hunterrhansen@users.noreply.github.com';
const [commit, tag] = process.argv.slice(2);
if (!commit || !tag || !/^[\w.-]+$/.test(tag)) {
  console.error('Usage: npm run source:publish -- <commit> <tag>');
  process.exit(1);
}

const run = (command, args, options = {}) =>
  execFileSync(command, args, { encoding: 'utf8', ...options }).trim();
const sha = run('git', ['rev-parse', '--verify', `${commit}^{commit}`]);
const work = mkdtempSync(join(tmpdir(), 'knightly-source-'));
const checkout = join(work, 'repo');
try {
  run('gh', ['repo', 'clone', repo, checkout, '--', '--quiet']);
  const git = (...args) => run('git', args, { cwd: checkout });
  if (git('tag', '--list', tag)) throw new Error(`${repo} already has ${tag}.`);
  // Replace the tree wholesale, so files removed since the last build go too.
  for (const entry of readdirSync(checkout))
    if (entry !== '.git') rmSync(join(checkout, entry), { recursive: true });
  execFileSync('sh', ['-c', `git archive "${sha}" | tar -x -C "${checkout}"`]);
  git('checkout', '-B', 'main');
  git('add', '--all');
  const identity = {
    GIT_AUTHOR_NAME: author,
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: author,
    GIT_COMMITTER_EMAIL: email,
  };
  run(
    'git',
    ['commit', '--quiet', '--allow-empty', '-m', `Knightly source for ${tag}`],
    { cwd: checkout, env: { ...process.env, ...identity } },
  );
  run('git', ['tag', '-a', tag, '-m', `Knightly source for ${tag}`], {
    cwd: checkout,
    env: { ...process.env, ...identity },
  });
  git('push', '--quiet', 'origin', 'main', tag);
  console.log(`Published ${sha.slice(0, 7)} as ${repo}@${tag}.`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
