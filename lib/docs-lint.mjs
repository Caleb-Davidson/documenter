import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import process from "node:process";
import yaml from "js-yaml";

// Repo-local docs quality gate for validating markdown structure and docs metadata.
// It enforces rules that keep the static docs shell deterministic and safe.
const DOCS_DIR = "docs";
const INDEX_MD = join(DOCS_DIR, "index.md");
const REQUIRED_FRONTMATTER_FIELDS = ["title", "section", "description"];
const TEMPLATE_REQUIRED_FRONTMATTER_FIELDS = ["template"];
const MAX_DESCRIPTION_LENGTH = 180;
const ALLOWED_HTML_TAGS = new Set(["div", "svg", "title", "desc", "defs", "marker", "path", "rect", "text", "tspan"]);
const ALLOWED_HTML_CLASSES = new Set(["diagram-frame", "diagram-node", "diagram-arrow", "diagram-label", "diagram-caption"]);

/**
 * Parsed representation of a markdown document in the docs tree.
 * @typedef {object} DocRecord
 * @property {string} file Repo-relative path under docs/ (for example, "architecture/overview.md").
 * @property {string} path Filesystem path used for reads and diagnostics (for example, "docs/architecture/overview.md").
 * @property {string} source Full raw markdown source including frontmatter.
 * @property {object|null} frontmatter Parsed YAML frontmatter object, or null when parsing fails.
 * @property {string|null} frontmatterError Human-readable parse/validation error for frontmatter.
 * @property {string} body Markdown body content after frontmatter removal.
 * @property {number} bodyStartLine 1-based line number where body content starts in source.
 */

main();

/**
 * Runs all documentation validations and exits with a CI-friendly status code.
 * @returns {void}
 */
function main() {
  const issues = [];
  const docFiles = listMarkdownDocs();
  const docs = readDocs(docFiles);

  checkIndexSync(docs, issues);
  checkCrossDocUniqueness(docs, issues);

  for (const doc of docs) {
    checkFrontmatter(doc, issues);
    checkTemplateCompliance(doc, docs, issues);
    checkHeadingStructure(doc, issues);
    checkEmptySections(doc, issues);
    checkInternalLinks(doc, issues);
    checkRawHtmlPolicy(doc, issues);
  }

  reportAndExit(issues);
}

/**
 * Discovers all markdown docs under docs/ and returns a stable sorted list.
 * @returns {string[]} Repo-relative markdown file paths.
 */
function listMarkdownDocs() {
  return listMarkdownDocsFromDir(DOCS_DIR, "").sort();
}

/**
 * Recursively walks a docs subtree and collects markdown file paths.
 * @param {string} rootDir Root directory used as the recursion base.
 * @param {string} relativeDir Current directory relative to rootDir.
 * @returns {string[]} Repo-relative markdown file paths.
 */
function listMarkdownDocsFromDir(rootDir, relativeDir) {
  const dirPath = relativeDir ? join(rootDir, relativeDir) : rootDir;
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = relativeDir ? join(relativeDir, entry.name) : entry.name;
    const fullPath = join(rootDir, relativePath);

    if (entry.isDirectory()) {
      files.push(...listMarkdownDocsFromDir(rootDir, relativePath));
      continue;
    }

    if (extname(entry.name) !== ".md") {
      continue;
    }

    if (!statSync(fullPath).isFile()) {
      continue;
    }

    files.push(relativePath);
  }

  return files;
}

/**
 * Reads and parses markdown docs into normalized records for downstream validators.
 * @param {string[]} files Repo-relative markdown paths under docs/.
 * @returns {DocRecord[]} Parsed documentation records.
 */
function readDocs(files) {
  return files.map((file) => {
    const path = join(DOCS_DIR, file);
    const source = readFileSync(path, "utf-8");
    const parsed = parseFrontmatter(source);
    return {
      file,
      path,
      source,
      frontmatter: parsed.frontmatter,
      frontmatterError: parsed.error,
      body: parsed.body,
      bodyStartLine: parsed.bodyStartLine
    };
  });
}

/**
 * Splits YAML frontmatter from markdown body and reports parse errors without throwing.
 * @param {string} source Full markdown source.
 * @returns {{frontmatter: object|null, error: string|null, body: string, bodyStartLine: number}} Parsed frontmatter result.
 */
function parseFrontmatter(source) {
  // Parse frontmatter manually so we can return precise, user-facing error messages
  // with predictable body offsets for later line-based validation checks.
  const lines = source.split(/\r?\n/);
  if (lines[0] !== "---") {
    return {
      frontmatter: null,
      error: "missing frontmatter start delimiter '---' at line 1",
      body: source,
      bodyStartLine: 1
    };
  }

  let endLine = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === "---") {
      endLine = i;
      break;
    }
  }

  if (endLine < 0) {
    return {
      frontmatter: null,
      error: "missing closing frontmatter delimiter '---'",
      body: "",
      bodyStartLine: lines.length + 1
    };
  }

  const rawFrontmatter = lines.slice(1, endLine).join("\n");
  const body = lines.slice(endLine + 1).join("\n");
  try {
    const parsed = yaml.load(rawFrontmatter);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        frontmatter: null,
        error: "frontmatter must be a YAML object with key/value pairs",
        body,
        bodyStartLine: endLine + 2
      };
    }
    return {
      frontmatter: parsed,
      error: null,
      body,
      bodyStartLine: endLine + 2
    };
  } catch (error) {
    return {
      frontmatter: null,
      error: `invalid YAML frontmatter: ${error.message}`,
      body,
      bodyStartLine: endLine + 2
    };
  }
}

/**
 * Ensures docs/index.md links to all docs pages and does not reference missing targets.
 * @param {DocRecord[]} docs Parsed docs records.
 * @param {string[]} issues Mutable list of validation issues.
 * @returns {void}
 */
function checkIndexSync(docs, issues) {
  const indexDoc = docs.find((doc) => doc.file === "index.md");
  if (!indexDoc) {
    issues.push(`${INDEX_MD}: missing required documentation index file.`);
    return;
  }

  const otherDocFiles = docs
    .map((doc) => doc.file)
    .filter((file) => file !== "index.md" && !file.startsWith("templates/"));

  const tocLinks = extractMarkdownDocLinks(indexDoc.body);
  for (const file of otherDocFiles) {
    if (!tocLinks.has(file)) {
      issues.push(`${INDEX_MD}: missing entry for '${file}'.`);
    }
  }

  for (const link of tocLinks) {
    if (link === "index.md") {
      issues.push(`${INDEX_MD}: must not link to itself.`);
      continue;
    }
    const exists = otherDocFiles.includes(link);
    if (!exists) {
      issues.push(`${INDEX_MD}: references '${link}' which does not exist in docs/.`);
    }
  }
}

/**
 * Validates required frontmatter fields and description formatting constraints.
 * @param {DocRecord} doc Doc record being validated.
 * @param {string[]} issues Mutable list of validation issues.
 * @returns {void}
 */
function checkFrontmatter(doc, issues) {
  if (doc.frontmatterError) {
    issues.push(`${doc.path}: ${doc.frontmatterError}.`);
    return;
  }

  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    const value = doc.frontmatter[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      issues.push(`${doc.path}: frontmatter field '${field}' is required and must be a non-empty string.`);
    }
  }

  if (typeof doc.frontmatter.description === "string") {
    const description = doc.frontmatter.description;
    if (description.includes("\n")) {
      issues.push(`${doc.path}: frontmatter 'description' must be a single line.`);
    }
    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      issues.push(`${doc.path}: frontmatter 'description' exceeds ${MAX_DESCRIPTION_LENGTH} characters.`);
    }
  }
}

/**
 * Enforces template linkage and exact H2 section parity for template-driven docs pages.
 * @param {DocRecord} doc Doc record being validated.
 * @param {DocRecord[]} docs All parsed docs records, used to resolve template targets.
 * @param {string[]} issues Mutable list of validation issues.
 * @returns {void}
 */
function checkTemplateCompliance(doc, docs, issues) {
  if (doc.frontmatterError) {
    return;
  }

  if (!requiresTemplateCompliance(doc.file)) {
    return;
  }

  for (const field of TEMPLATE_REQUIRED_FRONTMATTER_FIELDS) {
    const value = doc.frontmatter[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      issues.push(`${doc.path}: frontmatter field '${field}' is required and must be a non-empty string.`);
      return;
    }
  }

  const templateValue = doc.frontmatter.template.trim();
  if (!templateValue.startsWith("./") || !templateValue.toLowerCase().endsWith(".md")) {
    issues.push(`${doc.path}: frontmatter 'template' must be a relative docs markdown path like './templates/standard-template.md'.`);
    return;
  }

  const templateFile = templateValue.slice(2);
  if (templateFile === doc.file) {
    issues.push(`${doc.path}: frontmatter 'template' must not reference itself.`);
    return;
  }

  const templateDoc = docs.find((candidate) => candidate.file === templateFile);
  if (!templateDoc) {
    issues.push(`${doc.path}: template '${templateValue}' does not exist in docs/.`);
    return;
  }

  // Require exact section parity with the referenced template so authored docs stay
  // consistent enough for humans and AI tooling to navigate and compare reliably.
  const requiredSections = extractRequiredTemplateSections(templateDoc);
  const docSections = extractLevelTwoHeadings(doc.body);
  if (!arraysEqual(requiredSections, docSections)) {
    const expected = requiredSections.join(" | ");
    const actual = docSections.join(" | ");
    issues.push(
      `${doc.path}: H2 section list must exactly match template '${templateValue}' in the same order with no extras. Expected: [${expected}]. Actual: [${actual}].`
    );
  }
}

/**
 * Validates heading hierarchy constraints required by the docs shell (H2/H3 only, no skipped levels).
 * @param {DocRecord} doc Doc record being validated.
 * @param {string[]} issues Mutable list of validation issues.
 * @returns {void}
 */
function checkHeadingStructure(doc, issues) {
  const lines = doc.body.split(/\r?\n/);
  let firstHeadingLevel = null;
  let previousHeadingLevel = null;

  walkBodyLines(doc, function (line, lineNumber) {
    const match = line.match(/^(#{1,6})\s+\S/);
    if (!match) {
      return;
    }

    const level = match[1].length;
    if (firstHeadingLevel === null) {
      firstHeadingLevel = level;
    }

    if (level === 1) {
      issues.push(`${doc.path}:${lineNumber} contains an H1 heading. Use frontmatter title and start body headings at H2.`);
    }

    if (level > 3) {
      issues.push(`${doc.path}:${lineNumber} uses H${level}. Only H2/H3 are allowed in docs bodies.`);
    }

    if (previousHeadingLevel !== null && level - previousHeadingLevel > 1) {
      issues.push(`${doc.path}:${lineNumber} skips heading levels (H${previousHeadingLevel} -> H${level}).`);
    }

    previousHeadingLevel = level;
  });

  if (firstHeadingLevel !== null && firstHeadingLevel !== 2) {
    issues.push(`${doc.path}: first heading in body must be H2 (##).`);
  }

  if (lines.join("\n").trim().length > 0 && firstHeadingLevel === null) {
    issues.push(`${doc.path}: body must contain at least one Markdown heading starting at H2.`);
  }
}

/**
 * Detects headings whose sections contain no meaningful content.
 * @param {DocRecord} doc Doc record being validated.
 * @param {string[]} issues Mutable list of validation issues.
 * @returns {void}
 */
function checkEmptySections(doc, issues) {
  const lines = doc.body.split(/\r?\n/);
  const headings = [];
  let inFence = false;
  let fenceDelimiter = "";

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    const fenceMatch = trimmed.match(/^(```|~~~)/);
    if (fenceMatch) {
      const delimiter = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceDelimiter = delimiter;
      } else if (delimiter === fenceDelimiter) {
        inFence = false;
        fenceDelimiter = "";
      }
      continue;
    }

    if (inFence) {
      continue;
    }

    const headingMatch = line.match(/^(#{2,6})\s+(\S.*)$/);
    if (headingMatch) {
      headings.push({
        level: headingMatch[1].length,
        title: headingMatch[2].trim(),
        lineIndex: i,
        lineNumber: doc.bodyStartLine + i
      });
    }
  }

  for (let i = 0; i < headings.length; i += 1) {
    const current = headings[i];
    let endIndex = lines.length;

    for (let j = i + 1; j < headings.length; j += 1) {
      if (headings[j].level <= current.level) {
        endIndex = headings[j].lineIndex;
        break;
      }
    }

    const sectionLines = lines.slice(current.lineIndex + 1, endIndex);
    const hasMeaningfulContent = sectionLines.some((sectionLine) => sectionLine.trim().length > 0);

    if (!hasMeaningfulContent) {
      issues.push(
        `${doc.path}:${current.lineNumber} section '${current.title}' is empty or whitespace-only. Add content or an 'Intentionally empty: ...' marker.`
      );
    }
  }
}

/**
 * Validates markdown links against docs-shell internal linking rules.
 * @param {DocRecord} doc Doc record being validated.
 * @param {string[]} issues Mutable list of validation issues.
 * @returns {void}
 */
function checkInternalLinks(doc, issues) {
  const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

  walkBodyLines(doc, function (line, lineNumber) {
    let match;
    while ((match = markdownLinkPattern.exec(line)) !== null) {
      const href = match[1].trim();
      if (!href || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
        continue;
      }

      if (href.startsWith("#")) {
        issues.push(`${doc.path}:${lineNumber} uses hash-route link '${href}'. Link docs with relative .md paths instead.`);
        continue;
      }

      if (/\.html?(?=[#?]|$)/i.test(href)) {
        issues.push(`${doc.path}:${lineNumber} links to HTML '${href}'. Use relative .md links for docs.`);
      }

      if (/\.md(?=[#?]|$)/i.test(href) && !href.startsWith("./")) {
        issues.push(`${doc.path}:${lineNumber} uses '${href}'. Docs links should start with './'.`);
      }
    }
  });
}

/**
 * Restricts raw HTML tags/classes to an approved allowlist for safe diagram rendering.
 * @param {DocRecord} doc Doc record being validated.
 * @param {string[]} issues Mutable list of validation issues.
 * @returns {void}
 */
function checkRawHtmlPolicy(doc, issues) {
  const htmlTagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
  const classAttrPattern = /\bclass\s*=\s*"([^"]+)"/i;

  walkBodyLines(doc, function (line, lineNumber) {
    let match;
    while ((match = htmlTagPattern.exec(line)) !== null) {
      const tag = match[1].toLowerCase();
      const attrs = match[2] || "";

      if (tag === "script") {
        issues.push(`${doc.path}:${lineNumber} uses <script>, which is not allowed in docs markdown.`);
        continue;
      }

      if (!ALLOWED_HTML_TAGS.has(tag)) {
        issues.push(`${doc.path}:${lineNumber} uses raw HTML tag <${tag}> which is not in the approved docs set.`);
      }

      if (/\bstyle\s*=\s*"/i.test(attrs)) {
        issues.push(`${doc.path}:${lineNumber} uses inline style attribute, which is not allowed.`);
      }

      const classMatch = attrs.match(classAttrPattern);
      if (classMatch) {
        const classNames = classMatch[1].split(/\s+/).filter(Boolean);
        for (const className of classNames) {
          if (!ALLOWED_HTML_CLASSES.has(className)) {
            issues.push(`${doc.path}:${lineNumber} uses class '${className}' which is not an approved docs class.`);
          }
        }
      }
    }
  });
}

/**
 * Ensures slug and title uniqueness across docs to avoid ambiguous routing and grouping.
 * @param {DocRecord[]} docs Parsed docs records.
 * @param {string[]} issues Mutable list of validation issues.
 * @returns {void}
 */
function checkCrossDocUniqueness(docs, issues) {
  const titleMap = new Map();
  const slugMap = new Map();

  for (const doc of docs) {
    const slug = doc.file.replace(/\.md$/i, "");
    const slugKey = slug.toLowerCase();
    if (!slugMap.has(slugKey)) {
      slugMap.set(slugKey, []);
    }
    slugMap.get(slugKey).push(doc.path);

    if (doc.frontmatter && typeof doc.frontmatter.title === "string") {
      const titleKey = doc.frontmatter.title.trim().toLowerCase();
      if (!titleKey) {
        continue;
      }
      if (!titleMap.has(titleKey)) {
        titleMap.set(titleKey, []);
      }
      titleMap.get(titleKey).push(doc.path);
    }
  }

  for (const [slug, paths] of slugMap.entries()) {
    if (paths.length > 1) {
      issues.push(`Duplicate doc slug '${slug}' across: ${paths.join(", ")}.`);
    }
  }

  for (const [title, paths] of titleMap.entries()) {
    if (paths.length > 1) {
      issues.push(`Duplicate frontmatter title '${title}' across: ${paths.join(", ")}.`);
    }
  }
}

/**
 * Iterates markdown body lines excluding fenced code blocks.
 * @param {DocRecord} doc Doc record whose body should be traversed.
 * @param {(line: string, lineNumber: number) => void} callback Callback invoked per non-fenced line.
 * @returns {void}
 */
function walkBodyLines(doc, callback) {
  // Most markdown validators should ignore fenced code blocks to avoid false positives
  // from sample snippets that intentionally contain headings, links, or raw HTML.
  const lines = doc.body.split(/\r?\n/);
  let inFence = false;
  let fenceDelimiter = "";

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNumber = doc.bodyStartLine + i;

    const fenceMatch = trimmed.match(/^(```|~~~)/);
    if (fenceMatch) {
      const delimiter = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceDelimiter = delimiter;
      } else if (delimiter === fenceDelimiter) {
        inFence = false;
        fenceDelimiter = "";
      }
      continue;
    }

    if (inFence) {
      continue;
    }

    callback(line, lineNumber);
  }
}

/**
 * Extracts relative markdown links used by the docs index manifest.
 * @param {string} markdown Markdown source text.
 * @returns {Set<string>} Linked markdown paths without the leading "./".
 */
function extractMarkdownDocLinks(markdown) {
  const links = new Set();
  const pattern = /\[[^\]]+\]\(\.\/([^)]+\.md)(?:[#?][^)]+)?\)/g;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    links.add(match[1]);
  }
  return links;
}

/**
 * Collects H2 headings from markdown while ignoring fenced code blocks.
 * @param {string} markdown Markdown source text.
 * @returns {string[]} Ordered H2 heading texts.
 */
function extractLevelTwoHeadings(markdown) {
  const headings = [];
  let inFence = false;
  let fenceDelimiter = "";
  const lines = markdown.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(```|~~~)/);
    if (fenceMatch) {
      const delimiter = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceDelimiter = delimiter;
      } else if (delimiter === fenceDelimiter) {
        inFence = false;
        fenceDelimiter = "";
      }
      continue;
    }

    if (inFence) {
      continue;
    }

    const headingMatch = line.match(/^##\s+(\S.*)$/);
    if (headingMatch) {
      headings.push(headingMatch[1].trim());
    }
  }

  return headings;
}

/**
 * Extracts required template sections, excluding instructional placeholder headings.
 * @param {DocRecord} templateDoc Template doc record.
 * @returns {string[]} Ordered required section headings.
 */
function extractRequiredTemplateSections(templateDoc) {
  // Template placeholders like "{Component Name}" are instructional markers, not
  // required literal headings in authored documents.
  const sectionHeadings = extractLevelTwoHeadings(templateDoc.body);
  return sectionHeadings.filter((heading) => !heading.includes("{") && !heading.includes("}"));
}

/**
 * Determines whether a docs file should be validated against template requirements.
 * @param {string} file Repo-relative docs file path.
 * @returns {boolean} True when template compliance checks should run.
 */
function requiresTemplateCompliance(file) {
  if (file === "index.md") {
    return false;
  }

  if (file.startsWith("templates/")) {
    return false;
  }

  return true;
}

/**
 * Performs exact ordered equality for string arrays.
 * @param {string[]} a First array.
 * @param {string[]} b Second array.
 * @returns {boolean} True when arrays have identical length and item order.
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Reports accumulated issues and exits with process code 0 or 1.
 * @param {string[]} issues Collected validation issues.
 * @returns {void}
 */
function reportAndExit(issues) {
  if (issues.length === 0) {
    console.log("Documentation checks passed.");
    process.exit(0);
  }

  for (const issue of issues) {
    console.error(issue);
  }
  console.error(`\nDocumentation checks failed with ${issues.length} issue(s).`);
  process.exit(1);
}
