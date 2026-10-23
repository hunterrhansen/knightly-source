import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const platforms = {
  web: ['.web', ''],
  ios: ['.ios', '.native', ''],
  android: ['.android', '.native', ''],
};
const sourceExtension = /\.[cm]?[jt]sx?$/;
const variant = /\.(web|ios|android|native)(?:\.d)?\.[cm]?[jt]sx?$/;
const development =
  /(?:^|\/)__tests__\/|\.(test|spec|stories)(?:\.(web|ios|android|native))?\.[cm]?[jt]sx?$/;
const pathName = (root, file) => relative(root, file).split(sep).join('/');
const feature = (file) => file.match(/^src\/features\/([^/]+)\//)?.[1];
const shared = (file) => /^src\/(chess|components|ui|theme|lib)\//.test(file);
const pureChess = (file) =>
  file.startsWith('src/chess/') && !file.startsWith('src/chess/board/');
const unvariant = (file) =>
  file.replace(/\.(web|ios|android|native)(?=(?:\.d)?\.[cm]?[jt]sx?$)/, '');

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const file = join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(
          `Cannot inspect source symlink ${file}; use a real source file.`,
        );
      return entry.isDirectory()
        ? sourceFiles(file)
        : sourceExtension.test(file)
          ? [file]
          : [];
    })
    .sort();
}

function applicable(file, platform) {
  const suffix = file.match(variant)?.[1];
  return (
    !suffix ||
    suffix === platform ||
    (suffix === 'native' && platform !== 'web')
  );
}

function namedTypes(bindings) {
  return (
    bindings &&
    ts.isNamedImports(bindings) &&
    bindings.elements.length > 0 &&
    bindings.elements.every((element) => element.isTypeOnly)
  );
}

function imports(source, report) {
  const edges = [];
  function add(node, literal, typeOnly = false) {
    const line =
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    if (
      !literal ||
      !(
        ts.isStringLiteral(literal) ||
        ts.isNoSubstitutionTemplateLiteral(literal)
      )
    ) {
      report(
        line,
        'computed import/require cannot be inspected. Use literal imports or an explicit map of literal loaders.',
      );
    } else {
      edges.push({ specifier: literal.text, line, typeOnly });
    }
  }
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      add(
        node,
        node.moduleSpecifier,
        !!clause &&
          (clause.isTypeOnly ||
            (!clause.name && namedTypes(clause.namedBindings))),
      );
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const clause = node.exportClause;
      const onlyTypes =
        clause &&
        ts.isNamedExports(clause) &&
        clause.elements.length > 0 &&
        clause.elements.every((element) => element.isTypeOnly);
      add(node, node.moduleSpecifier, node.isTypeOnly || onlyTypes);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node, node.moduleReference.expression, node.isTypeOnly);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument)
    ) {
      add(node, node.argument.literal, true);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
    ) {
      add(node, node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return edges;
}

function boundary(from, to, typeOnly, publicFiles) {
  if (!development.test(from) && development.test(to)) {
    return 'production code cannot import development-only tests/stories. Move reusable behavior into a production module.';
  }
  if (
    shared(from) &&
    !development.test(from) &&
    /^src\/(features|app)\//.test(to)
  ) {
    return 'shared code cannot import feature workflows or routes. Move composition into the feature/route and pass data or callbacks.';
  }
  if (
    from.startsWith('src/chess/') &&
    to.startsWith('src/lib/') &&
    !development.test(from)
  ) {
    return 'chess cannot depend on auth/API infrastructure. Move requests into the owning feature and pass plain chess data.';
  }
  if (
    pureChess(from) &&
    !development.test(from) &&
    /^src\/(chess\/board|components|ui|theme|lib)\//.test(to)
  ) {
    if (!(typeOnly && to === 'src/chess/board/board.types.ts')) {
      return 'pure chess cannot depend on rendering or infrastructure. Extract plain domain types/helpers; only explicit type imports from board.types.ts are allowed.';
    }
  }
  if (
    /^src\/(features|app)\//.test(from) &&
    to.startsWith('src/components/ui/')
  ) {
    return 'features and routes import shared UI from src/ui (or src/ui/native-settings for SwiftUI), not src/components/ui. Export the component there.';
  }
  const owner = feature(from);
  if (
    owner &&
    feature(to) &&
    owner !== feature(to) &&
    !publicFiles.has(unvariant(to))
  ) {
    return 'private cross-feature import. Use an intentional API file registered in architecture.config.json or extract genuinely shared code.';
  }
}

// DFS reports witnessed cycles, including type-only edges, without enumerating
// every possible path through a cyclic component (which can be exponential).
function cycles(graph, report) {
  const visited = new Set();
  const active = new Set();
  const path = [];
  function visit(file) {
    visited.add(file);
    active.add(file);
    path.push(file);
    for (const edge of graph.get(file) ?? []) {
      if (active.has(edge.to)) {
        report(
          file,
          edge.line,
          `circular dependency: ${[...path.slice(path.indexOf(edge.to)), edge.to].join(' -> ')}. Break the cycle by moving shared types/helpers into a lower-level module.`,
        );
      } else if (!visited.has(edge.to)) {
        visit(edge.to);
      }
    }
    path.pop();
    active.delete(file);
  }
  for (const file of graph.keys()) if (!visited.has(file)) visit(file);
}

export function checkArchitecture(root) {
  root = resolve(root);
  const problems = new Map();
  function report(file, line, message, platform) {
    const key = `${file}:${line}: ${message}`;
    if (!problems.has(key)) problems.set(key, new Set());
    if (platform) problems.get(key).add(platform);
  }
  try {
    const configPath = join(root, 'tsconfig.json');
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error)
      throw new Error(
        ts.flattenDiagnosticMessageText(config.error.messageText, ' '),
      );
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    if (parsed.errors.length)
      throw new Error(
        parsed.errors
          .map((error) =>
            ts.flattenDiagnosticMessageText(error.messageText, ' '),
          )
          .join('\n'),
      );
    const policy = JSON.parse(
      readFileSync(join(root, 'architecture.config.json'), 'utf8'),
    );
    if (
      !Array.isArray(policy.featurePublicFiles) ||
      Object.keys(policy).some((key) => key !== 'featurePublicFiles')
    ) {
      throw new Error(
        'architecture.config.json must contain only featurePublicFiles, an array of explicit source file paths.',
      );
    }
    const publicFiles = new Set();
    for (const file of policy.featurePublicFiles) {
      if (
        typeof file !== 'string' ||
        !/^src\/features\/[^/]+\/.+/.test(file) ||
        !sourceExtension.test(file) ||
        pathName(root, resolve(root, file)) !== file ||
        !existsSync(join(root, file))
      ) {
        report(
          'architecture.config.json',
          1,
          `invalid or missing feature public file ${JSON.stringify(file)}. Register an existing file under its owning feature.`,
        );
      } else if (development.test(file)) {
        report(
          'architecture.config.json',
          1,
          `development-only public file ${file}. Register a production API instead.`,
        );
      } else {
        publicFiles.add(unvariant(file));
      }
    }
    const files = sourceFiles(join(root, 'src'));
    const sourceIdentity = (file) =>
      ts.sys.useCaseSensitiveFileNames
        ? resolve(file)
        : resolve(file).toLowerCase();
    const canonicalSources = new Map(
      files.map((file) => [sourceIdentity(file), file]),
    );
    const declarations = new Map();
    for (const file of files) {
      const name = pathName(root, file);
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      for (const error of source.parseDiagnostics) {
        report(
          name,
          source.getLineAndCharacterOfPosition(error.start ?? 0).line + 1,
          `syntax: ${ts.flattenDiagnosticMessageText(error.messageText, ' ')}`,
        );
      }
      declarations.set(
        name,
        imports(source, (line, message) => report(name, line, message)),
      );
    }
    const aliasPatterns = Object.keys(parsed.options.paths ?? {}).map(
      (pattern) =>
        new RegExp(
          `^${pattern
            .split('*')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*')}$`,
        ),
    );
    for (const [platform, moduleSuffixes] of Object.entries(platforms)) {
      const options = { ...parsed.options, moduleSuffixes, allowJs: true };
      const cache = ts.createModuleResolutionCache(
        root,
        (file) => file,
        options,
      );
      const graph = new Map();
      for (const file of files.filter((entry) => applicable(entry, platform))) {
        const from = pathName(root, file);
        const edges = [];
        graph.set(from, edges);
        for (const declaration of declarations.get(from)) {
          const { specifier, line, typeOnly } = declaration;
          const local =
            specifier.startsWith('.') ||
            specifier.startsWith('/') ||
            aliasPatterns.some((pattern) => pattern.test(specifier));
          if (
            pureChess(from) &&
            !development.test(from) &&
            /^(react(?:$|[-/])|expo(?:$|[-/])|@(?:clerk|tanstack)\/|openapi-fetch(?:$|\/)|axios(?:$|\/)|(?:node:)?(?:http|https|net|tls)$)/.test(
              specifier,
            )
          ) {
            report(
              from,
              line,
              `pure chess cannot import ${specifier}. Keep UI, authentication and transport in their owning layers.`,
              platform,
            );
          }
          const resolved = ts.resolveModuleName(
            specifier,
            file,
            options,
            ts.sys,
            cache,
          ).resolvedModule;
          // Metro asset requires are real dependencies, but not source modules.
          const assetPath = resolve(dirname(file), specifier);
          const asset =
            !resolved &&
            specifier.startsWith('.') &&
            extname(specifier) &&
            !sourceExtension.test(specifier) &&
            existsSync(assetPath) &&
            statSync(assetPath).isFile();
          if (!resolved && !asset) {
            if (local)
              report(
                from,
                line,
                `unresolved local import ${specifier}. Fix the path/alias or supply the ${platform} adapter.`,
                platform,
              );
            continue;
          }
          const target =
            resolved?.resolvedFileName ?? resolve(dirname(file), specifier);
          // The resolver can preserve import casing on case-insensitive disks.
          // Use scanned identities so ownership and graph nodes stay consistent.
          const to = pathName(
            root,
            canonicalSources.get(sourceIdentity(target)) ?? target,
          );
          if (/^backend\//i.test(to)) {
            report(
              from,
              line,
              `package boundary: Expo cannot import ${to}. Own frontend code in src/ and access the backend through its HTTP contract.`,
              platform,
            );
            continue;
          }
          if (!to.startsWith('src/')) continue;
          if (!applicable(to, platform)) {
            report(
              from,
              line,
              `platform-specific import ${specifier} targets a different platform. Import the extensionless adapter base path.`,
              platform,
            );
            continue;
          }
          const violation = boundary(from, to, typeOnly, publicFiles);
          if (violation)
            report(from, line, `${violation} Target: ${to}.`, platform);
          edges.push({ ...declaration, to });
        }
      }
      cycles(graph, (file, line, message) =>
        report(file, line, message, platform),
      );
    }
  } catch (error) {
    report('architecture configuration', 1, error.message);
  }
  return [...problems].map(([message, affected]) =>
    affected.size ? `${message} [${[...affected].join(', ')}]` : message,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const started = performance.now();
  const issues = checkArchitecture(process.cwd());
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `Architecture OK: shared boundaries, feature APIs and cycles checked for web/iOS/Android (${Math.round(performance.now() - started)} ms).`,
    );
  }
}
