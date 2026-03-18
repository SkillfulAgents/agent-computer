// @datawizz/ac — TypeScript SDK for macOS desktop automation

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
export { Bridge, type BridgeOptions } from './bridge.js';
export { AC } from './sdk.js';
