/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Project attachments live in the private "project-files" bucket. These values
 * must stay aligned with 20261024150000_project_attachments.sql. Pure on
 * purpose (no Supabase import), so restoreBackup and the self-check can use it.
 */

export const PROJECT_FILES_BUCKET = 'project-files';
export const PROJECT_FILE_LIMIT_BYTES = 10 * 1024 * 1024;

/** Extension -> MIME type, for the bucket allow-list and for files the OS sends untyped. */
const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  csv: 'text/csv',
};
const ALLOWED = new Set(Object.values(TYPES));

/** For <input accept>: what the bucket will take. */
export const PROJECT_FILE_ACCEPT = Object.keys(TYPES).map((e) => `.${e}`).join(',');

const extensionOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

/**
 * Validates a file before any network I/O and returns the type to store it
 * under. Android pickers often send CSV or Office files with an empty or
 * generic type, so the extension decides when the browser can't.
 */
export function validateProjectFile(file: { name: string; size: number; type: string }): { type: string; extension: string } {
  if (file.size === 0) throw new Error('empty');
  if (file.size > PROJECT_FILE_LIMIT_BYTES) throw new Error('too-large');
  const extension = extensionOf(file.name);
  const raw = file.type.trim().toLowerCase();
  const type = ALLOWED.has(raw) ? raw : TYPES[extension];
  if (!type) throw new Error('unsupported');
  return { type, extension: extension || Object.keys(TYPES).find((e) => TYPES[e] === type)! };
}

/** Owned by its first segment, like a receipt. */
export const projectFilePath = (userId: string, extension: string) =>
  `${userId}/${crypto.randomUUID()}.${extension}`;

export const formatFileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
