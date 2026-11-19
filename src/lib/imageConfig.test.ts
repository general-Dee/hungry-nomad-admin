import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Vercel's image optimizer returns 402 on this hobby team, which blanks photos.
// Every next/image must load straight from storage, so this must stay on.
describe('next.config images', () => {
  it('keeps images.unoptimized set to true', () => {
    const src = readFileSync(path.resolve(__dirname, '../../next.config.mjs'), 'utf8');
    expect(src).toMatch(/images:\s*\{[\s\S]*?unoptimized:\s*true/);
  });
});
