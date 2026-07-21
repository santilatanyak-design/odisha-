/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DbSong {
  id: string;
  title: string;
  artist: string;
  audioBlob: Blob;
  photoBlob: Blob;
  createdAt: string;
}

export interface DbAd {
  id: string;
  title: string;
  imageBlob: Blob;
  link?: string;
  createdAt: string;
}

const DB_NAME = "SwagatAppDB";
const DB_VERSION = 1;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains("songs")) {
        db.createObjectStore("songs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("ads")) {
        db.createObjectStore("ads", { keyPath: "id" });
      }
    };
  });
}

export async function saveSong(song: DbSong): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("songs", "readwrite");
    const store = transaction.objectStore("songs");
    const request = store.put(song);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSongs(): Promise<DbSong[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("songs", "readonly");
    const store = transaction.objectStore("songs");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSong(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("songs", "readwrite");
    const store = transaction.objectStore("songs");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveAd(ad: DbAd): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("ads", "readwrite");
    const store = transaction.objectStore("ads");
    const request = store.put(ad);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllAds(): Promise<DbAd[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("ads", "readonly");
    const store = transaction.objectStore("ads");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAd(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("ads", "readwrite");
    const store = transaction.objectStore("ads");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
