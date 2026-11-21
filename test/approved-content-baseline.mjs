import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const report = new URL('../reports/project-audit-20261111/content-applied/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('changes.json', report), 'utf8'));
// Historical checks retain their original baseline. Current bytes must first match
// the separately recorded, explicitly approved content revision.
export function approvedContentBaseline(file) {
  const current = fs.readFileSync(new URL('../' + file, import.meta.url));
  const hashes = manifest.sourceHashes[file];
  if (!hashes) return current;
  assert.equal(createHash('sha256').update(current).digest('hex'), hashes.after, file + ' approved bytes');
  const before = fs.readFileSync(new URL('before/' + file, report));
  assert.equal(createHash('sha256').update(before).digest('hex'), hashes.before, file + ' original bytes');
  return before;
}
