/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc 
} from "firebase/firestore";

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
const CHUNK_SIZE = 800000; // 800KB characters

// --- Helper Functions to Convert Blob <-> Base64 ---

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      if (commaIndex !== -1) {
        resolve(result.substring(commaIndex + 1));
      } else {
        resolve(result);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

function chunkString(str: string, size: number): string[] {
  const chunks = [];
  let offset = 0;
  while (offset < str.length) {
    chunks.push(str.substring(offset, offset + size));
    offset += size;
  }
  return chunks;
}

// --- IndexedDB Local Cache Functions ---

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

async function saveSongToLocal(song: DbSong): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("songs", "readwrite");
    const store = transaction.objectStore("songs");
    const request = store.put(song);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAllSongsFromLocal(): Promise<DbSong[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("songs", "readonly");
    const store = transaction.objectStore("songs");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function deleteSongFromLocal(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("songs", "readwrite");
    const store = transaction.objectStore("songs");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function saveAdToLocal(ad: DbAd): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("ads", "readwrite");
    const store = transaction.objectStore("ads");
    const request = store.put(ad);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAllAdsFromLocal(): Promise<DbAd[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("ads", "readonly");
    const store = transaction.objectStore("ads");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function deleteAdFromLocal(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("ads", "readwrite");
    const store = transaction.objectStore("ads");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// --- Firebase Sync Public API Functions ---

export async function saveSong(song: DbSong): Promise<void> {
  // 1. Save locally to IndexedDB cache
  await saveSongToLocal(song);

  // 2. Convert Blobs to Base64 strings
  const audioBase64 = await blobToBase64(song.audioBlob);
  const photoBase64 = await blobToBase64(song.photoBlob);

  // 3. Chunk the strings
  const audioChunks = chunkString(audioBase64, CHUNK_SIZE);
  const photoChunks = chunkString(photoBase64, CHUNK_SIZE);

  // 4. Save metadata to Firestore
  const songDocRef = doc(db, "songs", song.id);
  await setDoc(songDocRef, {
    id: song.id,
    title: song.title,
    artist: song.artist,
    audioMimeType: song.audioBlob.type,
    photoMimeType: song.photoBlob.type,
    createdAt: song.createdAt,
    audioChunkCount: audioChunks.length,
    photoChunkCount: photoChunks.length
  });

  // 5. Upload chunks to subcollections
  const chunkPromises = [];

  for (let i = 0; i < audioChunks.length; i++) {
    const chunkDocRef = doc(db, "songs", song.id, "audio_chunks", `chunk_${i}`);
    chunkPromises.push(setDoc(chunkDocRef, { data: audioChunks[i] }));
  }

  for (let i = 0; i < photoChunks.length; i++) {
    const chunkDocRef = doc(db, "songs", song.id, "photo_chunks", `chunk_${i}`);
    chunkPromises.push(setDoc(chunkDocRef, { data: photoChunks[i] }));
  }

  await Promise.all(chunkPromises);
}

export async function getAllSongs(): Promise<DbSong[]> {
  try {
    // 1. Fetch metadata of all songs from Firestore
    const songsCollectionRef = collection(db, "songs");
    const querySnapshot = await getDocs(songsCollectionRef);
    
    const firestoreSongsList: any[] = [];
    querySnapshot.forEach(docSnap => {
      firestoreSongsList.push(docSnap.data());
    });

    // Sort by createdAt or default
    firestoreSongsList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // 2. For each song, check if it exists in local IndexedDB cache
    const localSongs = await getAllSongsFromLocal();
    const localSongsMap = new Map(localSongs.map(s => [s.id, s]));

    const songsToReturn: DbSong[] = [];

    for (const fSong of firestoreSongsList) {
      const cached = localSongsMap.get(fSong.id);
      if (cached) {
        songsToReturn.push(cached);
      } else {
        // Not cached! Fetch its chunks and construct Blobs
        const audioChunksPromises = [];
        for (let i = 0; i < fSong.audioChunkCount; i++) {
          const chunkDocRef = doc(db, "songs", fSong.id, "audio_chunks", `chunk_${i}`);
          audioChunksPromises.push(getDoc(chunkDocRef));
        }
        const audioSnaps = await Promise.all(audioChunksPromises);
        const audioBase64 = audioSnaps.map(snap => snap.data()?.data || "").join("");

        const photoChunksPromises = [];
        for (let i = 0; i < fSong.photoChunkCount; i++) {
          const chunkDocRef = doc(db, "songs", fSong.id, "photo_chunks", `chunk_${i}`);
          photoChunksPromises.push(getDoc(chunkDocRef));
        }
        const photoSnaps = await Promise.all(photoChunksPromises);
        const photoBase64 = photoSnaps.map(snap => snap.data()?.data || "").join("");

        const audioBlob = base64ToBlob(audioBase64, fSong.audioMimeType);
        const photoBlob = base64ToBlob(photoBase64, fSong.photoMimeType);

        const reconstructedSong: DbSong = {
          id: fSong.id,
          title: fSong.title,
          artist: fSong.artist,
          audioBlob,
          photoBlob,
          createdAt: fSong.createdAt
        };

        // Cache it locally
        await saveSongToLocal(reconstructedSong);
        songsToReturn.push(reconstructedSong);
      }
    }

    // 3. Clean up deleted songs from local IndexedDB cache
    const firestoreSongIds = new Set(firestoreSongsList.map(s => s.id));
    for (const localSong of localSongs) {
      if (!firestoreSongIds.has(localSong.id)) {
        await deleteSongFromLocal(localSong.id);
      }
    }

    return songsToReturn;
  } catch (err) {
    console.error("Failed to sync/fetch from Firestore, falling back to local storage:", err);
    return getAllSongsFromLocal();
  }
}

export async function deleteSong(id: string): Promise<void> {
  // 1. Delete from IndexedDB cache
  await deleteSongFromLocal(id);

  // 2. Delete main doc from Firestore
  const songDocRef = doc(db, "songs", id);
  await deleteDoc(songDocRef);

  // 3. Delete chunks from subcollections
  try {
    const audioChunksRef = collection(db, "songs", id, "audio_chunks");
    const audioSnap = await getDocs(audioChunksRef);
    const photoChunksRef = collection(db, "songs", id, "photo_chunks");
    const photoSnap = await getDocs(photoChunksRef);

    const deletePromises: Promise<void>[] = [];
    audioSnap.forEach(docSnap => {
      deletePromises.push(deleteDoc(docSnap.ref));
    });
    photoSnap.forEach(docSnap => {
      deletePromises.push(deleteDoc(docSnap.ref));
    });
    await Promise.all(deletePromises);
  } catch (err) {
    console.error("Error deleting song chunks:", err);
  }
}

export async function saveAd(ad: DbAd): Promise<void> {
  // 1. Save locally to IndexedDB cache
  await saveAdToLocal(ad);

  // 2. Convert Blob to Base64 string
  const imageBase64 = await blobToBase64(ad.imageBlob);

  // 3. Chunk the string
  const imageChunks = chunkString(imageBase64, CHUNK_SIZE);

  // 4. Save metadata to Firestore
  const adDocRef = doc(db, "ads", ad.id);
  await setDoc(adDocRef, {
    id: ad.id,
    title: ad.title,
    link: ad.link || "",
    imageMimeType: ad.imageBlob.type,
    createdAt: ad.createdAt,
    imageChunkCount: imageChunks.length
  });

  // 5. Upload chunks to subcollection
  const chunkPromises = [];
  for (let i = 0; i < imageChunks.length; i++) {
    const chunkDocRef = doc(db, "ads", ad.id, "image_chunks", `chunk_${i}`);
    chunkPromises.push(setDoc(chunkDocRef, { data: imageChunks[i] }));
  }
  await Promise.all(chunkPromises);
}

export async function getAllAds(): Promise<DbAd[]> {
  try {
    // 1. Fetch metadata of all ads from Firestore
    const adsCollectionRef = collection(db, "ads");
    const querySnapshot = await getDocs(adsCollectionRef);

    const firestoreAdsList: any[] = [];
    querySnapshot.forEach(docSnap => {
      firestoreAdsList.push(docSnap.data());
    });

    // Sort by createdAt or default
    firestoreAdsList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // 2. For each ad, check if it exists in local IndexedDB cache
    const localAds = await getAllAdsFromLocal();
    const localAdsMap = new Map(localAds.map(a => [a.id, a]));

    const adsToReturn: DbAd[] = [];

    for (const fAd of firestoreAdsList) {
      const cached = localAdsMap.get(fAd.id);
      if (cached) {
        adsToReturn.push(cached);
      } else {
        // Fetch image chunks
        const imageChunksPromises = [];
        for (let i = 0; i < fAd.imageChunkCount; i++) {
          const chunkDocRef = doc(db, "ads", fAd.id, "image_chunks", `chunk_${i}`);
          imageChunksPromises.push(getDoc(chunkDocRef));
        }
        const imageSnaps = await Promise.all(imageChunksPromises);
        const imageBase64 = imageSnaps.map(snap => snap.data()?.data || "").join("");

        const imageBlob = base64ToBlob(imageBase64, fAd.imageMimeType);

        const reconstructedAd: DbAd = {
          id: fAd.id,
          title: fAd.title,
          imageBlob,
          link: fAd.link || undefined,
          createdAt: fAd.createdAt
        };

        // Cache it locally
        await saveAdToLocal(reconstructedAd);
        adsToReturn.push(reconstructedAd);
      }
    }

    // 3. Clean up deleted ads from local IndexedDB cache
    const firestoreAdIds = new Set(firestoreAdsList.map(a => a.id));
    for (const localAd of localAds) {
      if (!firestoreAdIds.has(localAd.id)) {
        await deleteAdFromLocal(localAd.id);
      }
    }

    return adsToReturn;
  } catch (err) {
    console.error("Failed to sync/fetch ads from Firestore, falling back to local storage:", err);
    return getAllAdsFromLocal();
  }
}

export async function deleteAd(id: string): Promise<void> {
  // 1. Delete from IndexedDB cache
  await deleteAdFromLocal(id);

  // 2. Delete main doc from Firestore
  const adDocRef = doc(db, "ads", id);
  await deleteDoc(adDocRef);

  // 3. Delete chunks from subcollection
  try {
    const imageChunksRef = collection(db, "ads", id, "image_chunks");
    const snap = await getDocs(imageChunksRef);
    const deletePromises: Promise<void>[] = [];
    snap.forEach(docSnap => {
      deletePromises.push(deleteDoc(docSnap.ref));
    });
    await Promise.all(deletePromises);
  } catch (err) {
    console.error("Error deleting ad chunks:", err);
  }
}
