/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-check for project attachment validation. Run:
 * npx tsx src/lib/projectFiles.check.ts
 */

import assert from 'node:assert';
import { PROJECT_FILE_LIMIT_BYTES, projectFilePath, validateProjectFile } from './projectFiles.ts';

const file = (name: string, type = '', size = 10) => ({ name, type, size });

// Typed files keep their type; the extension names the stored object.
assert.deepStrictEqual(validateProjectFile(file('Invoice.PDF', 'application/pdf')), { type: 'application/pdf', extension: 'pdf' });
assert.deepStrictEqual(validateProjectFile(file('photo.jpg', 'image/jpeg')), { type: 'image/jpeg', extension: 'jpg' });

// An untyped or generically typed file from an Android picker is judged by its extension.
assert.strictEqual(validateProjectFile(file('prices.csv')).type, 'text/csv');
assert.strictEqual(validateProjectFile(file('sheet.xlsx', 'application/octet-stream')).type,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

// What the bucket would refuse is refused before upload.
assert.throws(() => validateProjectFile(file('setup.exe', 'application/x-msdownload')), /unsupported/);
assert.throws(() => validateProjectFile(file('noext')), /unsupported/);
assert.throws(() => validateProjectFile(file('a.pdf', 'application/pdf', 0)), /empty/);
assert.throws(() => validateProjectFile(file('a.pdf', 'application/pdf', PROJECT_FILE_LIMIT_BYTES + 1)), /too-large/);

// The owner's id is the first path segment — the bucket policy depends on it.
assert.match(projectFilePath('u1', 'pdf'), /^u1\/[0-9a-f-]{36}\.pdf$/);

console.log('projectFiles: all checks passed');
