export interface PayKitSecondaryStorage {
  /**
   * Retrieve a value by key.
   *
   * @param key - The storage key.
   * @returns The stored string value, or null if not found.
   */
  get: (key: string) => Promise<string | null>;

  /**
   * Store a value with an optional TTL.
   *
   * @param key - The storage key.
   * @param value - The value to store.
   * @param ttl - Time to live in seconds. If ommitted, the value should be stored indefinitely.
   */
  set: (key: string, value: string, ttl?: number) => Promise<void> | void;

  /**
   * Delete a value by key.
   *
   * @param key - The storage key.
   */
  delete: (key: string) => Promise<void> | void;
}
