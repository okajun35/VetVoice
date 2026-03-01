/**
 * Feature: ui-consistency-fix
 * Property 1: Fault Condition — inline style and hardcoded colors must not exist
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.13
 *
 * This test encodes the EXPECTED behavior (no inline style constants, no hardcoded colors).
 * It will FAIL on pre-fix code, confirming the bug exists.
 * It will PASS on post-fix code, confirming the bug is resolved.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// --- Bug condition patterns ---

const INLINE_STYLE_CONSTANTS = [
  'FIELD_STYLE',
  'SELECT_STYLE',
  'PRIMARY_BUTTON_BASE_STYLE',
  'cardStyle',
  'infoRowStyle',
];

const HARDCODED_COLORS = [
  '#1e6bff',
  '#0066cc',
  '#fff0f0',
  '#cc0000',
  '#155724',
  '#856404',
  '#242424',
];

const VITE_TEMPLATE_PATTERNS = [
  'color-scheme: light dark',
  'background-color: #242424',
];

// --- Target files ---

const COMPONENT_FILES = [
  'src/components/PipelineEntryForm.tsx',
  'src/App.tsx',
  'src/components/VisitManager.tsx',
];

const CSS_FILES = [
  'src/index.css',
];

// --- Helpers ---

function readSourceFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

function hasInlineStyleConstants(source: string): string[] {
  return INLINE_STYLE_CONSTANTS.filter(constant => source.includes(constant));
}

function hasHardcodedColors(source: string): string[] {
  return HARDCODED_COLORS.filter(color => source.includes(color));
}

function hasViteTemplateStyles(source: string): string[] {
  return VITE_TEMPLATE_PATTERNS.filter(pattern => source.includes(pattern));
}

// --- Tests ---

describe('Feature: ui-consistency-fix, Property 1: Fault Condition — inline style and hardcoded colors must not exist', () => {
  it('component files must not contain inline style constants', () => {
    fc.assert(
      fc.property(fc.constantFrom(...COMPONENT_FILES), (filePath) => {
        const source = readSourceFile(filePath);
        const found = hasInlineStyleConstants(source);
        // Encodes expected behavior: no inline style constants should exist.
        // FAILS on pre-fix code (bug confirmed), PASSES on post-fix code.
        expect(
          found,
          `${filePath} contains inline style constants: ${found.join(', ')}`
        ).toHaveLength(0);
      }),
      { numRuns: 50 }
    );
  });

  it('component files must not contain hardcoded colors in style attributes', () => {
    fc.assert(
      fc.property(fc.constantFrom(...COMPONENT_FILES), (filePath) => {
        const source = readSourceFile(filePath);
        const found = hasHardcodedColors(source);
        // Encodes expected behavior: no hardcoded colors should exist.
        // FAILS on pre-fix code (bug confirmed), PASSES on post-fix code.
        expect(
          found,
          `${filePath} contains hardcoded colors: ${found.join(', ')}`
        ).toHaveLength(0);
      }),
      { numRuns: 50 }
    );
  });

  it('index.css must not contain Vite template styles', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CSS_FILES), (filePath) => {
        const source = readSourceFile(filePath);
        const found = hasViteTemplateStyles(source);
        // Encodes expected behavior: no Vite template styles should remain.
        // FAILS on pre-fix code (bug confirmed), PASSES on post-fix code.
        expect(
          found,
          `${filePath} contains Vite template styles: ${found.join(', ')}`
        ).toHaveLength(0);
      }),
      { numRuns: 10 }
    );
  });
});
