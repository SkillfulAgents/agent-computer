// Single-letter prefixes for common roles, two-letter for rare roles
export type RefPrefix =
  | 'b' | 't' | 'l' | 'm' | 'c' | 'r' | 's' | 'd' | 'i' | 'g' | 'w' | 'x' | 'o' | 'a' | 'e'
  | 'cb' | 'sa' | 'st' | 'sp' | 'tl' | 'pg' | 'tv' | 'wb';

export type Ref = `@${RefPrefix}${number}`;

export interface Element {
  ref: string;
  role: string;
  label: string | null;
  value: string | null;
  enabled: boolean;
  focused: boolean;
  bounds: [x: number, y: number, w: number, h: number];
  children?: Element[];
}

export interface Snapshot {
  snapshot_id: string;
  window: WindowInfo;
  elements: Element[];
  fallback: 'ocr' | null;
}

export interface WindowInfo {
  ref: string;
  title: string;
  app: string;
  bundle_id?: string;
  process_id: number;
  bounds: [x: number, y: number, w: number, h: number];
  minimized: boolean;
  hidden: boolean;
  fullscreen: boolean;
}

export interface ScreenshotResult {
  path: string;
  width: number;
  height: number;
  annotations?: Array<{ ref: string; label: string; bounds: [number, number, number, number] }>;
}

export interface RecordingStatus {
  active: boolean;
  path?: string;
  duration_ms?: number;
}

export interface DialogInfo {
  type: 'alert' | 'file-open' | 'file-save' | 'custom';
  message?: string;
  buttons: string[];
  elements: Element[];
}

export interface AppInfo {
  name: string;
  bundle_id?: string;
  process_id: number;
  is_active: boolean;
  is_hidden: boolean;
}

export interface StatusInfo {
  grabbed_window: string | null;
  grabbed_app: string | null;
  grabbed_pid: number | null;
  last_snapshot_id: string | null;
  daemon_pid: number | null;
  daemon_uptime_ms: number | null;
}

export interface PermissionsInfo {
  accessibility: boolean;
  screen_recording: boolean;
}

export interface DoctorResult {
  version: string;
  permissions: PermissionsInfo;
  daemon: { running: boolean; pid?: number; uptime_ms?: number };
  binary_path: string;
  platform: string;
  arch: string;
}

export interface DisplayInfo {
  id: number;
  width: number;
  height: number;
  x: number;
  y: number;
  is_main: boolean;
  scale_factor: number;
}

// Normalized role names used across platforms
export const NORMALIZED_ROLES = [
  'button', 'textfield', 'textarea', 'link', 'checkbox', 'radio',
  'slider', 'dropdown', 'image', 'group', 'window', 'table', 'row',
  'cell', 'tabgroup', 'tab', 'menubar', 'menuitem', 'scrollarea',
  'text', 'toolbar', 'combobox', 'stepper', 'splitgroup', 'timeline',
  'progress', 'treeview', 'webarea', 'generic',
] as const;

export type NormalizedRole = typeof NORMALIZED_ROLES[number];
