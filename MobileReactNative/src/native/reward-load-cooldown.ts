import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'hly_reward_closed_at_v1:';
const closedAtByUser = new Map<string, number>();
const loadingByUser = new Map<string, Promise<void>>();

export function computeRewardLoadCooldownRemainingMs(
  closedAt: number,
  seconds: number,
  now = Date.now(),
) {
  if (!Number.isFinite(closedAt) || closedAt <= 0 || seconds <= 0) return 0;
  return Math.max(0, closedAt + seconds * 1000 - now);
}

export function getRewardLoadCooldownRemainingMs(userId: string, seconds: number) {
  return computeRewardLoadCooldownRemainingMs(closedAtByUser.get(userId) ?? 0, seconds);
}

export async function hydrateRewardLoadCooldown(userId: string) {
  if (!userId || loadingByUser.has(userId)) return loadingByUser.get(userId);
  const pending = AsyncStorage.getItem(`${STORAGE_PREFIX}${userId}`)
    .then(value => {
      const storedAt = Number(value);
      if (Number.isFinite(storedAt) && storedAt > 0) {
        closedAtByUser.set(userId, Math.max(closedAtByUser.get(userId) ?? 0, storedAt));
      }
    })
    .catch(() => undefined);
  loadingByUser.set(userId, pending);
  return pending;
}

export function recordRewardAdClosed(userId: string, now = Date.now()) {
  if (!userId) return;
  closedAtByUser.set(userId, now);
  AsyncStorage.setItem(`${STORAGE_PREFIX}${userId}`, String(now)).catch(() => undefined);
}

export async function assertRewardLoadReady(userId: string, seconds: number) {
  if (seconds <= 0) return;
  await hydrateRewardLoadCooldown(userId);
  const remainingMs = getRewardLoadCooldownRemainingMs(userId, seconds);
  if (remainingMs > 0) {
    throw new Error(`请等待 ${Math.ceil(remainingMs / 1000)} 秒后再拉取激励广告`);
  }
}
