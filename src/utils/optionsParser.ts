/**
 * Parses Wandbox-style options string into compiler flags.
 * Example: "warning-all,std=c++17" -> ["-Wall", "-std=c++17"]
 * Sanitizes input to prevent injection (only alphanumeric, comma, hyphen, underscore, =).
 */

const KNOWN_OPTIONS: Record<string, string[]> = {
  "warning-all": ["-Wall"],
  "warning-extra": ["-Wextra"],
  "pedantic": ["-pedantic"],
  "pedantic-errors": ["-pedantic-errors"],
  "cpp-pedantic-errors": ["-pedantic-errors"],
  "optimize": ["-O2"],
  "optimize-o3": ["-O3"],
  "std=c++14": ["-std=c++14"],
  "std=c++17": ["-std=c++17"],
  "std=c++20": ["-std=c++20"],
  "std=c++23": ["-std=c++23"],
  "c++14": ["-std=c++14"],
  "c++17": ["-std=c++17"],
  "c++20": ["-std=c++20"],
  "c++23": ["-std=c++23"],
};

/** Allowed chars for unknown option tokens (no shell metacharacters). */
const SAFE_OPTION_REGEX = /^[-a-zA-Z0-9_=.+]+$/;

/**
 * @param optionsString - Comma-separated Wandbox options, e.g. "warning-all,std=c++17"
 * @returns Array of compiler flags to pass to g++/clang++
 */
export function parseOptions(optionsString: string | undefined): string[] {
  if (!optionsString || optionsString.trim() === "") return [];

  const flags: string[] = [];
  const tokens = optionsString.split(",").map((s) => s.trim()).filter(Boolean);

  for (const token of tokens) {
    const lower = token.toLowerCase();
    const known = KNOWN_OPTIONS[lower] ?? KNOWN_OPTIONS[token];
    if (known) {
      flags.push(...known);
      continue;
    }
    // Unknown option: pass as single flag only if safe (no injection)
    if (SAFE_OPTION_REGEX.test(token)) {
      flags.push(token.startsWith("-") ? token : `-${token}`);
    }
  }

  return flags;
}
