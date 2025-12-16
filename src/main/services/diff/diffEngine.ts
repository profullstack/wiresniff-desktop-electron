/**
 * Diff Engine Service
 *
 * Compares HTTP responses to identify differences in headers, body, and timing.
 * Supports semantic JSON comparison for intelligent body diffing.
 */

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timing: {
    total: number;
    dns?: number;
    connect?: number;
    ttfb?: number;
    download?: number;
  };
  timestamp: string;
}

export interface HeaderDiff {
  key: string;
  type: 'added' | 'removed' | 'modified';
  leftValue?: string;
  rightValue?: string;
}

export interface BodyDiff {
  type: 'identical' | 'different' | 'json-semantic' | 'binary';
  textDiff?: string[];
  jsonDiff?: JsonDiffEntry[];
  similarity: number;
}

export interface JsonDiffEntry {
  path: string;
  type: 'added' | 'removed' | 'modified' | 'type-changed';
  leftValue?: unknown;
  rightValue?: unknown;
  leftType?: string;
  rightType?: string;
}

export interface TimingDiff {
  totalDelta: number;
  dnsDelta?: number;
  connectDelta?: number;
  ttfbDelta?: number;
  downloadDelta?: number;
  percentageChange: number;
}

export interface DiffResult {
  id: string;
  leftResponse: ResponseData;
  rightResponse: ResponseData;
  statusDiff: {
    identical: boolean;
    left: { status: number; statusText: string };
    right: { status: number; statusText: string };
  };
  headerDiff: HeaderDiff[];
  bodyDiff: BodyDiff;
  timingDiff: TimingDiff;
  summary: {
    hasStatusDiff: boolean;
    hasHeaderDiff: boolean;
    hasBodyDiff: boolean;
    hasSignificantTimingDiff: boolean;
    overallSimilarity: number;
  };
  createdAt: string;
}

export interface DiffOptions {
  ignoreHeaders?: string[];
  ignoreJsonPaths?: string[];
  timingThreshold?: number; // percentage threshold for "significant" timing diff
  semanticJsonDiff?: boolean;
}

const DEFAULT_OPTIONS: DiffOptions = {
  ignoreHeaders: ['date', 'x-request-id', 'x-correlation-id', 'set-cookie'],
  ignoreJsonPaths: [],
  timingThreshold: 20, // 20% change is significant
  semanticJsonDiff: true,
};

/**
 * Generate a unique ID for the diff result
 */
function generateDiffId(): string {
  return `diff_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Compare headers between two responses
 */
export function compareHeaders(
  leftHeaders: Record<string, string>,
  rightHeaders: Record<string, string>,
  ignoreHeaders: string[] = []
): HeaderDiff[] {
  const diffs: HeaderDiff[] = [];
  const ignoreSet = new Set(ignoreHeaders.map((h) => h.toLowerCase()));

  // Normalize headers to lowercase keys
  const normalizeHeaders = (headers: Record<string, string>): Record<string, string> => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      normalized[key.toLowerCase()] = value;
    }
    return normalized;
  };

  const left = normalizeHeaders(leftHeaders);
  const right = normalizeHeaders(rightHeaders);

  const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);

  for (const key of allKeys) {
    if (ignoreSet.has(key)) continue;

    const leftValue = left[key];
    const rightValue = right[key];

    if (leftValue === undefined) {
      diffs.push({ key, type: 'added', rightValue });
    } else if (rightValue === undefined) {
      diffs.push({ key, type: 'removed', leftValue });
    } else if (leftValue !== rightValue) {
      diffs.push({ key, type: 'modified', leftValue, rightValue });
    }
  }

  return diffs;
}

/**
 * Check if a string is valid JSON
 */
function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all paths in a JSON object
 */
function getJsonPaths(obj: unknown, prefix = ''): Map<string, unknown> {
  const paths = new Map<string, unknown>();

  if (obj === null || obj === undefined) {
    paths.set(prefix || '$', obj);
    return paths;
  }

  if (typeof obj !== 'object') {
    paths.set(prefix || '$', obj);
    return paths;
  }

  if (Array.isArray(obj)) {
    paths.set(prefix || '$', obj);
    obj.forEach((item, index) => {
      const itemPaths = getJsonPaths(item, `${prefix}[${index}]`);
      itemPaths.forEach((value, path) => paths.set(path, value));
    });
  } else {
    paths.set(prefix || '$', obj);
    for (const [key, value] of Object.entries(obj)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      const valuePaths = getJsonPaths(value, newPrefix);
      valuePaths.forEach((v, path) => paths.set(path, v));
    }
  }

  return paths;
}

/**
 * Compare two JSON objects semantically
 */
export function compareJsonSemantic(
  leftJson: unknown,
  rightJson: unknown,
  ignorePaths: string[] = []
): JsonDiffEntry[] {
  const diffs: JsonDiffEntry[] = [];
  const ignoreSet = new Set(ignorePaths);

  const leftPaths = getJsonPaths(leftJson);
  const rightPaths = getJsonPaths(rightJson);

  const allPaths = new Set([...leftPaths.keys(), ...rightPaths.keys()]);

  for (const path of allPaths) {
    if (ignoreSet.has(path)) continue;

    const leftValue = leftPaths.get(path);
    const rightValue = rightPaths.get(path);
    const leftHas = leftPaths.has(path);
    const rightHas = rightPaths.has(path);

    if (!leftHas && rightHas) {
      diffs.push({ path, type: 'added', rightValue });
    } else if (leftHas && !rightHas) {
      diffs.push({ path, type: 'removed', leftValue });
    } else if (leftHas && rightHas) {
      const leftType = typeof leftValue;
      const rightType = typeof rightValue;

      if (leftType !== rightType) {
        diffs.push({
          path,
          type: 'type-changed',
          leftValue,
          rightValue,
          leftType,
          rightType,
        });
      } else if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) {
        // Only report leaf differences, not container differences
        if (
          typeof leftValue !== 'object' ||
          leftValue === null ||
          typeof rightValue !== 'object' ||
          rightValue === null
        ) {
          diffs.push({ path, type: 'modified', leftValue, rightValue });
        }
      }
    }
  }

  return diffs;
}

/**
 * Calculate text similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  // For very long strings, use a simpler comparison
  if (str1.length > 10000 || str2.length > 10000) {
    const commonLength = Math.min(str1.length, str2.length);
    let matches = 0;
    for (let i = 0; i < commonLength; i++) {
      if (str1[i] === str2[i]) matches++;
    }
    return matches / Math.max(str1.length, str2.length);
  }

  const matrix: number[][] = [];

  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[str1.length][str2.length];
  return 1 - distance / Math.max(str1.length, str2.length);
}

/**
 * Generate line-by-line text diff
 */
function generateTextDiff(left: string, right: string): string[] {
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  const diff: string[] = [];

  const maxLines = Math.max(leftLines.length, rightLines.length);

  for (let i = 0; i < maxLines; i++) {
    const leftLine = leftLines[i];
    const rightLine = rightLines[i];

    if (leftLine === undefined) {
      diff.push(`+ ${rightLine}`);
    } else if (rightLine === undefined) {
      diff.push(`- ${leftLine}`);
    } else if (leftLine !== rightLine) {
      diff.push(`- ${leftLine}`);
      diff.push(`+ ${rightLine}`);
    } else {
      diff.push(`  ${leftLine}`);
    }
  }

  return diff;
}

/**
 * Check if content appears to be binary
 */
function isBinaryContent(content: string): boolean {
  // Check for null bytes or high concentration of non-printable characters
  let nonPrintable = 0;
  const sampleSize = Math.min(content.length, 1000);

  for (let i = 0; i < sampleSize; i++) {
    const code = content.charCodeAt(i);
    if (code === 0 || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      nonPrintable++;
    }
  }

  return nonPrintable / sampleSize > 0.1;
}

/**
 * Compare response bodies
 */
export function compareBody(
  leftBody: string,
  rightBody: string,
  options: { semanticJsonDiff?: boolean; ignoreJsonPaths?: string[] } = {}
): BodyDiff {
  const { semanticJsonDiff = true, ignoreJsonPaths = [] } = options;

  // Check for identical content
  if (leftBody === rightBody) {
    return { type: 'identical', similarity: 1 };
  }

  // Check for binary content
  if (isBinaryContent(leftBody) || isBinaryContent(rightBody)) {
    return {
      type: 'binary',
      similarity: leftBody === rightBody ? 1 : 0,
    };
  }

  // Try JSON semantic comparison
  if (semanticJsonDiff && isValidJson(leftBody) && isValidJson(rightBody)) {
    const leftJson = JSON.parse(leftBody);
    const rightJson = JSON.parse(rightBody);
    const jsonDiff = compareJsonSemantic(leftJson, rightJson, ignoreJsonPaths);

    // Calculate similarity based on number of differences
    const leftPaths = getJsonPaths(leftJson);
    const rightPaths = getJsonPaths(rightJson);
    const totalPaths = new Set([...leftPaths.keys(), ...rightPaths.keys()]).size;
    const diffCount = jsonDiff.length;
    const similarity = totalPaths > 0 ? 1 - diffCount / totalPaths : 1;

    return {
      type: 'json-semantic',
      jsonDiff,
      similarity: Math.max(0, similarity),
    };
  }

  // Fall back to text diff
  const textDiff = generateTextDiff(leftBody, rightBody);
  const similarity = calculateSimilarity(leftBody, rightBody);

  return {
    type: 'different',
    textDiff,
    similarity,
  };
}

/**
 * Compare response timing
 */
export function compareTiming(
  leftTiming: ResponseData['timing'],
  rightTiming: ResponseData['timing'],
  threshold = 20
): TimingDiff {
  const totalDelta = rightTiming.total - leftTiming.total;
  const percentageChange =
    leftTiming.total > 0 ? ((rightTiming.total - leftTiming.total) / leftTiming.total) * 100 : 0;

  const result: TimingDiff = {
    totalDelta,
    percentageChange,
  };

  if (leftTiming.dns !== undefined && rightTiming.dns !== undefined) {
    result.dnsDelta = rightTiming.dns - leftTiming.dns;
  }

  if (leftTiming.connect !== undefined && rightTiming.connect !== undefined) {
    result.connectDelta = rightTiming.connect - leftTiming.connect;
  }

  if (leftTiming.ttfb !== undefined && rightTiming.ttfb !== undefined) {
    result.ttfbDelta = rightTiming.ttfb - leftTiming.ttfb;
  }

  if (leftTiming.download !== undefined && rightTiming.download !== undefined) {
    result.downloadDelta = rightTiming.download - leftTiming.download;
  }

  return result;
}

/**
 * Main diff function - compares two complete responses
 */
export function diffResponses(
  leftResponse: ResponseData,
  rightResponse: ResponseData,
  options: DiffOptions = {}
): DiffResult {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const headerDiff = compareHeaders(
    leftResponse.headers,
    rightResponse.headers,
    mergedOptions.ignoreHeaders
  );

  const bodyDiff = compareBody(leftResponse.body, rightResponse.body, {
    semanticJsonDiff: mergedOptions.semanticJsonDiff,
    ignoreJsonPaths: mergedOptions.ignoreJsonPaths,
  });

  const timingDiff = compareTiming(
    leftResponse.timing,
    rightResponse.timing,
    mergedOptions.timingThreshold
  );

  const statusIdentical =
    leftResponse.status === rightResponse.status &&
    leftResponse.statusText === rightResponse.statusText;

  const hasSignificantTimingDiff =
    Math.abs(timingDiff.percentageChange) > (mergedOptions.timingThreshold ?? 20);

  // Calculate overall similarity
  const statusScore = statusIdentical ? 1 : 0;
  const headerScore = headerDiff.length === 0 ? 1 : Math.max(0, 1 - headerDiff.length * 0.1);
  const bodyScore = bodyDiff.similarity;
  const timingScore = hasSignificantTimingDiff ? 0.5 : 1;

  const overallSimilarity = (statusScore + headerScore + bodyScore + timingScore) / 4;

  return {
    id: generateDiffId(),
    leftResponse,
    rightResponse,
    statusDiff: {
      identical: statusIdentical,
      left: { status: leftResponse.status, statusText: leftResponse.statusText },
      right: { status: rightResponse.status, statusText: rightResponse.statusText },
    },
    headerDiff,
    bodyDiff,
    timingDiff,
    summary: {
      hasStatusDiff: !statusIdentical,
      hasHeaderDiff: headerDiff.length > 0,
      hasBodyDiff: bodyDiff.type !== 'identical',
      hasSignificantTimingDiff,
      overallSimilarity,
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a diff summary for display
 */
export function createDiffSummary(result: DiffResult): string {
  const lines: string[] = [];

  lines.push(`Diff ID: ${result.id}`);
  lines.push(`Overall Similarity: ${(result.summary.overallSimilarity * 100).toFixed(1)}%`);
  lines.push('');

  if (result.summary.hasStatusDiff) {
    lines.push(
      `Status: ${result.statusDiff.left.status} ${result.statusDiff.left.statusText} → ${result.statusDiff.right.status} ${result.statusDiff.right.statusText}`
    );
  } else {
    lines.push(`Status: ${result.statusDiff.left.status} ${result.statusDiff.left.statusText} ✓`);
  }

  lines.push('');
  lines.push(`Headers: ${result.headerDiff.length} difference(s)`);
  for (const diff of result.headerDiff) {
    switch (diff.type) {
      case 'added':
        lines.push(`  + ${diff.key}: ${diff.rightValue}`);
        break;
      case 'removed':
        lines.push(`  - ${diff.key}: ${diff.leftValue}`);
        break;
      case 'modified':
        lines.push(`  ~ ${diff.key}: ${diff.leftValue} → ${diff.rightValue}`);
        break;
    }
  }

  lines.push('');
  lines.push(`Body: ${result.bodyDiff.type} (${(result.bodyDiff.similarity * 100).toFixed(1)}% similar)`);

  lines.push('');
  lines.push(
    `Timing: ${result.timingDiff.totalDelta > 0 ? '+' : ''}${result.timingDiff.totalDelta}ms (${result.timingDiff.percentageChange > 0 ? '+' : ''}${result.timingDiff.percentageChange.toFixed(1)}%)`
  );

  return lines.join('\n');
}