import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export const LF = "\n";
export const CRLF = "\r\n";

/**
 * Run git in the target directory, returning trimmed stdout or null if git is
 * missing, the directory isn't a repo, or the command fails for any reason.
 *
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<string | null>}
 */
async function git(args, cwd) {
  try {
    const { stdout } = await exec("git", args, { cwd, windowsHide: true });
    return stdout;
  } catch {
    return null;
  }
}

/**
 * Map a free-form eol token (env value or git config/attr) to a concrete EOL,
 * or null when it doesn't pin one (e.g. "native", "input", "auto", unset).
 *
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
function parseEol(value) {
  switch (value?.trim().toLowerCase()) {
    case "lf":
      return LF;
    case "crlf":
      return CRLF;
    default:
      return null;
  }
}

/**
 * Build a resolver for the line ending documenter should write into `targetRoot`.
 *
 * Repo-wide signals (env override, core.eol, core.autocrlf, is-a-repo) are read
 * once up front; per-path `.gitattributes` lookups happen lazily in `eolFor`.
 * Resolution precedence, highest first:
 *   1. DOCUMENTER_EOL env (lf|crlf)
 *   2. .gitattributes for the path: `eol` (lf|crlf), or `-text` (binary → LF)
 *   3. git config core.eol (lf|crlf; "native" is ignored)
 *   4. git config core.autocrlf (true → CRLF; input|false|unset → LF)
 *   5. fallback LF (not a repo, git missing, or nothing set)
 *
 * @param {string} targetRoot
 * @returns {Promise<{ eolFor(relPath: string): Promise<string> }>}
 */
export async function createEolResolver(targetRoot) {
  const envOverride = parseEol(process.env.DOCUMENTER_EOL);

  const isRepo = (await git(["rev-parse", "--is-inside-work-tree"], targetRoot))?.trim() === "true";

  let repoDefault = LF;
  if (isRepo) {
    const coreEol = parseEol(await git(["config", "core.eol"], targetRoot));
    if (coreEol) {
      repoDefault = coreEol;
    } else if ((await git(["config", "core.autocrlf"], targetRoot))?.trim().toLowerCase() === "true") {
      repoDefault = CRLF;
    }
  }

  return {
    async eolFor(relPath) {
      if (envOverride) return envOverride;
      if (isRepo) {
        const attr = await checkAttr(targetRoot, relPath);
        if (attr) return attr;
      }
      return repoDefault;
    }
  };
}

/**
 * Resolve `.gitattributes` line-ending intent for a single path.
 * Returns an EOL when `eol` is set (lf|crlf), LF when the path is marked `-text`
 * (git treats it as binary, so don't impose CRLF), or null when unspecified.
 *
 * @param {string} targetRoot
 * @param {string} relPath
 * @returns {Promise<string | null>}
 */
async function checkAttr(targetRoot, relPath) {
  // -z gives NUL-separated <path>\0<attr>\0<value>\0 triples, robust to odd paths.
  const out = await git(["check-attr", "-z", "eol", "text", "--", relPath], targetRoot);
  if (!out) return null;

  const fields = out.split("\0");
  const attrs = {};
  for (let i = 0; i + 2 < fields.length; i += 3) {
    attrs[fields[i + 1]] = fields[i + 2];
  }

  const eol = parseEol(attrs.eol);
  if (eol) return eol;
  if (attrs.text === "unset") return LF;
  return null;
}
