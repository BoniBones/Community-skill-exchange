import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStorage = new Map<string, string>();

function canUseNativeStorage(): boolean {
  const isReactNative = typeof navigator !== 'undefined' && navigator?.product === 'ReactNative';
  const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  return isReactNative || isBrowser;
}

function resolveAsyncStorage(): {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
} | null {
  if (!canUseNativeStorage()) return null;
  const candidate =
    (AsyncStorage as unknown as { default?: typeof AsyncStorage })?.default ?? AsyncStorage;
  if (candidate && typeof candidate.getItem === 'function' && typeof candidate.setItem === 'function') {
    return candidate;
  }
  return null;
}

export async function getStoredItem(key: string): Promise<string | null> {
  try {
    const storage = resolveAsyncStorage();
    if (storage) {
      const value = await storage.getItem(key);
      if (value !== null) {
        memoryStorage.set(key, value);
        return value;
      }
      return null;
    }
  } catch {
    // Fall back to in-memory storage when native storage is unavailable
  }
  return memoryStorage.get(key) ?? null;
}

export async function setStoredItem(key: string, value: string): Promise<void> {
  memoryStorage.set(key, value);
  try {
    const storage = resolveAsyncStorage();
    if (storage) {
      await storage.setItem(key, value);
    }
  } catch {
    // Keep in-memory fallback only
  }
}
