import type { Element } from '../types.js';
import { randomBytes } from 'crypto';

// Format output — text mode is default, --json for JSON
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

    // Windows list
    if ('windows' in obj && Array.isArray(obj.windows)) {
      return formatWindowsList(obj.windows as Record<string, unknown>[]);
    }

    // Apps list
    if ('apps' in obj && Array.isArray(obj.apps)) {
      return formatAppsList(obj.apps as Record<string, unknown>[]);
    }

    // Find results
    if ('elements' in obj && Array.isArray(obj.elements) && !('snapshot_id' in obj)) {
      return formatFindResults(obj.elements as Record<string, unknown>[]);
    }

    // Dialog detection
    if ('found' in obj && 'dialog' in obj) {
      return formatDialogResult(obj);
    }

    // Batch results
    if ('results' in obj && Array.isArray(obj.results) && 'total' in obj) {
      return formatBatchResults(obj);
    }

    // Diff/changed
    if ('changed' in obj && typeof obj.changed === 'boolean') {
      return formatDiffResult(obj);
    }

    // Menu list
    if ('items' in obj && Array.isArray(obj.items)) {
      return formatMenuItems(obj.items as Record<string, unknown>[], obj.menu as string | undefined);
    }

    // Screenshot
    if ('path' in obj && typeof obj.path === 'string' && ('width' in obj || 'ok' in obj)) {
      return formatScreenshot(obj);
    }

    // Displays
    if ('displays' in obj && Array.isArray(obj.displays)) {
      return formatDisplays(obj.displays as Record<string, unknown>[]);
    }

    // Permissions
    if ('accessibility' in obj && 'screen_recording' in obj) {
      return formatPermissions(obj);
    }

    // Simple ok result
    if ('ok' in obj && Object.keys(obj).length <= 3) {
      const extra = Object.entries(obj)
        .filter(([k]) => k !== 'ok')
        .map(([k, v]) => {
          if (typeof v !== 'object' || v === null) return `${k}: ${v}`;
          // Format nested objects as key=value pairs
          const inner = Object.entries(v as Record<string, unknown>)
            .map(([ik, iv]) => `${ik}=${Array.isArray(iv) ? iv.join(',') : iv}`)
            .join(', ');
          return `${k}: ${inner}`;
        })
        .join(', ');
      return extra ? `OK (${extra})` : 'OK';
    }

    // Clipboard
    if ('text' in obj && typeof obj.text === 'string' && Object.keys(obj).length <= 2) {
      return obj.text as string;
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
  if (el.value !== null && el.value !== undefined) parts.push(`value="${truncate(String(el.value), 50)}"`);

  const attrs: string[] = [];
  if (el.enabled) attrs.push('enabled');
  if (!el.enabled) attrs.push('disabled');
  if (el.focused) attrs.push('focused');
  if (el.bounds) {
    const [x, y, w, h] = el.bounds;
    attrs.push(`${x},${y} ${w}x${h}`);
  }

  lines.push(`${prefix}${parts.join(' ')} (${attrs.join(', ')})`);

  if (el.children) {
    for (const child of el.children) {
      formatElementTree(child, indent + 1, lines);
    }
  }
}

function formatWindowsList(windows: Record<string, unknown>[]): string {
  if (windows.length === 0) return 'No windows';
  return windows.map(w =>
    `${w.ref || '-'} ${w.app}: "${w.title}"${w.minimized ? ' (minimized)' : ''}${w.hidden ? ' (hidden)' : ''}`
  ).join('\n');
}

function formatAppsList(apps: Record<string, unknown>[]): string {
  if (apps.length === 0) return 'No running apps';
  return apps.map(a =>
    `${a.name}${a.is_active ? ' *' : ''}${a.is_hidden ? ' (hidden)' : ''} [${a.bundle_id}]`
  ).join('\n');
}

function formatFindResults(elements: Record<string, unknown>[]): string {
  if (elements.length === 0) return 'No elements found';
  return elements.map(e => {
    const parts = [`[${e.ref}] ${e.role}`];
    if (e.label) parts.push(`"${e.label}"`);
    if (e.value) parts.push(`value="${truncate(String(e.value), 40)}"`);
    return parts.join(' ');
  }).join('\n');
}

function formatDialogResult(obj: Record<string, unknown>): string {
  if (!obj.found) return 'No dialog found';
  const dialog = obj.dialog as Record<string, unknown>;
  const lines = [`Dialog: ${dialog.type}`];
  if (dialog.title) lines.push(`  Title: ${dialog.title}`);
  if (dialog.message) lines.push(`  Message: ${dialog.message}`);
  if (dialog.buttons && Array.isArray(dialog.buttons)) {
    const btns = (dialog.buttons as Array<{ title: string }>).map(b => b.title).join(', ');
    lines.push(`  Buttons: ${btns}`);
  }
  return lines.join('\n');
}

function formatBatchResults(obj: Record<string, unknown>): string {
  const results = obj.results as Array<Record<string, unknown>>;
  const lines = [`Batch: ${obj.count}/${obj.total} completed${obj.ok ? '' : ' (stopped on error)'}`];
  for (const r of results) {
    if (r.error) {
      lines.push(`  [${r.index}] ${r.method}: ERROR - ${r.error}`);
    } else {
      lines.push(`  [${r.index}] ${r.method}: OK`);
    }
  }
  return lines.join('\n');
}

function formatDiffResult(obj: Record<string, unknown>): string {
  if (!obj.changed) return 'No changes detected';
  const lines = ['Changes detected'];
  if (obj.added_count) lines.push(`  Added: ${obj.added_count}`);
  if (obj.removed_count) lines.push(`  Removed: ${obj.removed_count}`);
  if (Array.isArray(obj.added) && (obj.added as unknown[]).length > 0) {
    lines.push(`  Added elements: ${(obj.added as unknown[]).length}`);
  }
  if (Array.isArray(obj.removed) && (obj.removed as unknown[]).length > 0) {
    lines.push(`  Removed elements: ${(obj.removed as unknown[]).length}`);
  }
  return lines.join('\n');
}

function formatMenuItems(items: Record<string, unknown>[], menuName?: string): string {
  if (items.length === 0) return menuName ? `No items in menu "${menuName}"` : 'No menus';
  const header = menuName ? `Menu: ${menuName}` : 'Menus';
  const lines = [header];
  for (const item of items) {
    const enabled = item.enabled !== false ? '' : ' (disabled)';
    lines.push(`  ${item.title}${enabled}`);
    if (Array.isArray(item.children)) {
      for (const child of item.children as Record<string, unknown>[]) {
        const cEnabled = child.enabled !== false ? '' : ' (disabled)';
        lines.push(`    ${child.title}${cEnabled}`);
      }
    }
  }
  return lines.join('\n');
}

function formatScreenshot(obj: Record<string, unknown>): string {
  const parts = [`Screenshot: ${obj.path}`];
  if (obj.width && obj.height) parts.push(`(${obj.width}x${obj.height})`);
  return parts.join(' ');
}

function formatDisplays(displays: Record<string, unknown>[]): string {
  return displays.map(d =>
    `Display ${d.id}${d.is_main ? ' (main)' : ''}: ${d.width}x${d.height} @ ${d.x},${d.y} scale=${d.scale_factor}`
  ).join('\n');
}

function formatPermissions(obj: Record<string, unknown>): string {
  const lines = ['Permissions:'];
  lines.push(`  Accessibility: ${obj.accessibility ? 'granted' : 'NOT GRANTED'}`);
  lines.push(`  Screen Recording: ${obj.screen_recording ? 'granted' : 'NOT GRANTED'}`);
  return lines.join('\n');
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
