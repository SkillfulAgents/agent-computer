// @datawizz/ac — TypeScript SDK
// Stub for Phase 0. Full implementation across later phases.

export type {
  Element,
  Snapshot,
  WindowInfo,
  ScreenshotResult,
  RecordingStatus,
  DialogInfo,
  AppInfo,
  StatusInfo,
  PermissionsInfo,
  DoctorResult,
  DisplayInfo,
  Ref,
  RefPrefix,
  NormalizedRole,
} from './types.js';

export { parseRef, isValidRef, refToRole, REF_PREFIXES } from './refs.js';
export { ACError, ElementNotFoundError, PermissionDeniedError, TimeoutError } from './errors.js';
