import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = resolve(here, "..", "..");
export const TEMPLATE_ROOT = resolve(PACKAGE_ROOT, "template");
