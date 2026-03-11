/**
 * Local credit usage for the conversation engine.
 * Tracks usage per device (and optionally global) so the app can enforce limits or show usage.
 */

/** Credits used per device id (e.g. deviceId from client). */
const usageByDevice = new Map<string, number>();

/** Global usage count (all devices). */
let globalUsage = 0;

/** Default credits consumed per analyzeMessage call. */
export const CREDITS_PER_ANALYSIS = 1;

/** Optional cap per device (0 = no cap). */
let deviceCap: number = 0;

/** Optional global cap (0 = no cap). */
let globalCap: number = 0;

export function setDeviceCap(cap: number): void {
  deviceCap = Math.max(0, cap);
}

export function setGlobalCap(cap: number): void {
  globalCap = Math.max(0, cap);
}

/**
 * Get current usage for a device.
 */
export function getCreditUsage(deviceId: string | undefined): number {
  if (!deviceId) return 0;
  return usageByDevice.get(deviceId) ?? 0;
}

/**
 * Get global credit usage.
 */
export function getGlobalCreditUsage(): number {
  return globalUsage;
}

export interface CreditUsageInfo {
  used: number;
  limit: number | null;
  remaining: number | null;
}

/**
 * Get usage for a device and remaining credits (if caps are set).
 */
export function getCreditUsageInfo(deviceId: string | undefined): CreditUsageInfo {
  const used = deviceId ? (usageByDevice.get(deviceId) ?? 0) : 0;
  const limit = deviceCap > 0 ? deviceCap : null;
  const remaining = limit !== null ? Math.max(0, limit - used) : null;
  return { used, limit, remaining };
}

/**
 * Consume credits for a device. Returns true if allowed, false if over limit.
 * If deviceId is missing, only global usage is updated (and global cap checked).
 */
export function consumeCredits(
  deviceId: string | undefined,
  amount: number = CREDITS_PER_ANALYSIS
): { ok: boolean; reason?: string } {
  const currentDevice = deviceId ? (usageByDevice.get(deviceId) ?? 0) : 0;
  const newDevice = currentDevice + amount;
  const newGlobal = globalUsage + amount;

  if (deviceCap > 0 && newDevice > deviceCap) {
    return { ok: false, reason: "DEVICE_CREDIT_LIMIT" };
  }
  if (globalCap > 0 && newGlobal > globalCap) {
    return { ok: false, reason: "GLOBAL_CREDIT_LIMIT" };
  }

  if (deviceId) {
    usageByDevice.set(deviceId, newDevice);
  }
  globalUsage = newGlobal;
  return { ok: true };
}

/**
 * Reset usage for a device (e.g. for testing or monthly reset).
 */
export function resetDeviceCredits(deviceId: string): void {
  const prev = usageByDevice.get(deviceId) ?? 0;
  usageByDevice.delete(deviceId);
  globalUsage = Math.max(0, globalUsage - prev);
}

/**
 * Reset all usage (e.g. for testing).
 */
export function resetAllCredits(): void {
  usageByDevice.clear();
  globalUsage = 0;
}
