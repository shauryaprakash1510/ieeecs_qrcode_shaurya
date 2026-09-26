"use client";

import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { Participant, ScanRequest, ScanResult } from "./types";

interface EventScannerDB extends DBSchema {
  participants: {
    key: string;
    value: Participant;
    indexes: { "by-name": string };
  };
  offline_queue: {
    key: number;
    value: {
      id?: number;
      payload: ScanRequest;
      timestamp: number;
      retryCount: number;
    };
  };
  local_redemptions: {
    key: string; // composite: `${participantId}_${mealSession}`
    value: {
      key: string;
      participantId: string;
      mealSession: string;
      timestamp: string;
    };
  };
}

const DB_NAME = "ieee_event_scanner_db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<EventScannerDB>> | null = null;

export function getOfflineDB(): Promise<IDBPDatabase<EventScannerDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is only available in browser environments"));
  }

  if (!dbPromise) {
    dbPromise = openDB<EventScannerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store 1: Participants Cache
        if (!db.objectStoreNames.contains("participants")) {
          const partStore = db.createObjectStore("participants", {
            keyPath: "participant_id",
          });
          partStore.createIndex("by-name", "name");
        }

        // Store 2: Offline Pending Scans Queue
        if (!db.objectStoreNames.contains("offline_queue")) {
          db.createObjectStore("offline_queue", {
            keyPath: "id",
            autoIncrement: true,
          });
        }

        // Store 3: Local Fast Duplicate Guards
        if (!db.objectStoreNames.contains("local_redemptions")) {
          db.createObjectStore("local_redemptions", {
            keyPath: "key",
          });
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Cache full participant directory into IndexedDB for offline access
 */
export async function cacheParticipantsLocally(participants: Participant[]): Promise<void> {
  try {
    const db = await getOfflineDB();
    const tx = db.transaction("participants", "readwrite");
    for (const p of participants) {
      await tx.store.put(p);
    }
    await tx.done;
  } catch (err) {
    console.warn("Failed to cache participants in IndexedDB:", err);
  }
}

/**
 * Retrieve a cached participant by ID
 */
export async function getCachedParticipant(id: string): Promise<Participant | undefined> {
  try {
    const db = await getOfflineDB();
    return await db.get("participants", id);
  } catch (err) {
    console.warn("Failed to read participant from IndexedDB:", err);
    return undefined;
  }
}

/**
 * Enqueue a scan for background sync when offline or network fails
 */
export async function enqueueOfflineScan(request: ScanRequest): Promise<number | null> {
  try {
    const db = await getOfflineDB();
    const id = await db.add("offline_queue", {
      payload: request,
      timestamp: Date.now(),
      retryCount: 0,
    });
    return id;
  } catch (err) {
    console.error("Failed to enqueue offline scan:", err);
    return null;
  }
}

/**
 * Get count of pending offline scans
 */
export async function getOfflineQueueCount(): Promise<number> {
  try {
    const db = await getOfflineDB();
    return await db.count("offline_queue");
  } catch {
    return 0;
  }
}

/**
 * Flush and synchronize pending offline scans sequentially to /api/scan
 */
export async function flushOfflineQueue(
  onProgress?: (synced: number, remaining: number) => void
): Promise<{ synced: number; failed: number }> {
  try {
    const db = await getOfflineDB();
    const queue = await db.getAll("offline_queue");

    if (queue.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      if (!item.id) continue;

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });

        if (res.ok) {
          await db.delete("offline_queue", item.id);
          synced++;
          onProgress?.(synced, queue.length - synced);
        } else {
          failed++;
        }
      } catch (networkErr) {
        console.warn("Offline queue sync network pause:", networkErr);
        break; // Stop loop if network is still down
      }
    }

    return { synced, failed };
  } catch (err) {
    console.error("Flush offline queue error:", err);
    return { synced: 0, failed: 0 };
  }
}
