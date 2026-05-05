export const RUNTIME_MODE = {
  ONLINE: "online",
  OFFLINE: "offline",
} as const;

export type RuntimeMode = (typeof RUNTIME_MODE)[keyof typeof RUNTIME_MODE];

export function parseRuntimeMode(raw: string | undefined): RuntimeMode {
  const v = raw?.trim().toLowerCase();
  if (v === RUNTIME_MODE.OFFLINE) {
    return RUNTIME_MODE.OFFLINE;
  }
  return RUNTIME_MODE.ONLINE;
}
