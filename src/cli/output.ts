import type { Element } from '../types.js';
import { randomBytes } from 'crypto';

// Format output based on --text flag
export function formatOutput(data: unknown, textMode: boolean): string {
  if (textMode) {
    return formatText(data);
  }
  return JSON.stringify(data, null, 2);
}

// Human-readable text formatting
function formatText(data: unknown): string {
  if (data === null || data === undefined) {
    return '';
  }

  if (typeof data === 'string') {
    return data;
  }

  if (typeof data === 'boolean' || typeof data === 'number') {
    return String(data);
  }

  if (Array.isArray(data)) {
    return data.map(item => formatText(item)).join('\n');
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    // Snapshot result — format as tree
    if ('snapshot_id' in obj && 'elements' in obj) {
      return formatSnapshotText(obj);
    }

    // Window list
    if (Array.isArray(obj) && obj.length > 0 && 'ref' in (obj[0] as Record<string, unknown>)) {
      return obj.map((w: any) => `${w.ref} ${w.app}: "${w.title}"${w.minimized ? ' (minimized)' : ''}${w.hidden ? ' (hidden)' : ''}`).join('\n');
    }

    // Generic key-value
    return Object.entries(obj)
      .map(([key, val]) => `${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`)
      .join('\n');
  }

  return JSON.stringify(data);
}

// Format snapshot as hierarchical tree
function formatSnapshotText(snap: Record<string, unknown>): string {
  const elements = snap.elements as Element[];
  const lines: string[] = [];
  for (const el of elements) {
    formatElementTree(el, 0, lines);
  }
  return lines.join('\n');
}

function formatElementTree(el: Element, indent: number, lines: string[]): void {
  const prefix = '  '.repeat(indent);
  const focusMarker = el.focused ? '*' : '';
  const parts: string[] = [];

  parts.push(`${focusMarker}[${el.ref}] ${capitalize(el.role)}`);
  if (el.label) parts.push(`"${el.label}"`);
  if (el.value !== null && el.value !== undefined) parts.push(`value="${truncate(el.value, 50)}"`);

  const attrs: string[] = [];
  if (el.enabled) attrs.push('enabled');
  if (!el.enabled) attrs.push('disabled');
  if (el.focused) attrs.push('focused');
  if (el.bounds) {
    const [x, y, w, h] = el.bounds;
    attrs.push(`${x},${y} ${w}×${h}`);
  }

  lines.push(`${prefix}${parts.join(' ')} (${attrs.join(', ')})`);

  if (el.children) {
    for (const child of el.children) {
      formatElementTree(child, indent + 1, lines);
    }
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + '...';
}

// Content boundary wrapping
export function wrapBoundary(content: string): string {
  const boundary = `AC_BOUNDARY_${randomBytes(4).toString('hex')}`;
  return `<<<${boundary}\n${content}\n${boundary}>>>`;
}

// Max-output truncation
export function truncateOutput(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + `\n... (truncated at ${maxChars} chars)`;
}
