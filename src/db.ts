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
  deleteDoc,
  onSnapshot
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
const CHUNK_SIZE = 750000; // 750KB characters per chunk

const DEFAULT_COVER_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'><rect width='600' height='600' fill='%230f172a'/><circle cx='300' cy='300' r='180' fill='%23f59e0b' opacity='0.15'/><path d='M250 200 v200 l160 -100 z' fill='%23f59e0b'/><text x='300' y='500' font-family='sans-serif' font-size='28' font-weight='bold' fill='%23fef3c7' text-anchor='middle'>Odia Bhajan &amp; Music</text></svg>";

// --- Helper Functions to Compress and Convert Images <-> DataURL <-> Base64 ---

export function compressImageToMaxDataUrl(blob: Blob, maxDim = 800, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    if (!blob || blob.size === 0) {
      resolve(DEFAULT_COVER_SVG);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        resolve(DEFAULT_COVER_SVG);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Scale down to maxDim (e.g. 800x800 max)
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Produces clean JPEG Data URL (~40KB - 90KB) well under Firestore 1MB doc limit
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => resolve(src || DEFAULT_COVER_SVG);
      img.src = src;
    };
    reader.onerror = () => resolve(DEFAULT_COVER_SVG);
    reader.readAsDataURL(blob);
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    if (!dataUrl || typeof dataUrl !== "string") {
      return new Blob([], { type: "image/jpeg" });
    }

    if (!dataUrl.startsWith("data:")) {
      return base64ToBlob(dataUrl, "image/jpeg");
    }

    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex === -1) {
      return new Blob([], { type: "image/jpeg" });
    }

    const header = dataUrl.substring(0, commaIndex);
    const rawData = dataUrl.substring(commaIndex + 1);
    const mimeMatch = header.match(/^data:(.*?)(;base64)?$/);
    const mime = mimeMatch?.[1] || "image/jpeg";
    const isBase64 = header.includes(";base64");

    if (isBase64) {
      return base64ToBlob(rawData, mime);
    } else {
      let decoded: string;
      try {
        decoded = decodeURIComponent(rawData);
      } catch {
        decoded = rawData;
      }
      return new Blob([decoded], { type: mime });
    }
  } catch (err) {
    return new Blob([], { type: "image/jpeg" });
  }
}

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
  try {
    if (!base64 || typeof base64 !== "string") {
      return new Blob([], { type: mimeType });
    }
    let cleaned = base64.replace(/\s/g, "");
    while (cleaned.length % 4 !== 0) {
      cleaned += "=";
    }

    const byteCharacters = atob(cleaned);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  } catch (err) {
    try {
      const encoder = new TextEncoder();
      const u8 = encoder.encode(base64);
      return new Blob([u8], { type: mimeType });
    } catch {
      return new Blob([], { type: mimeType });
    }
  }
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

    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains("songs")) {
        idb.createObjectStore("songs", { keyPath: "id" });
      }
      if (!idb.objectStoreNames.contains("ads")) {
        idb.createObjectStore("ads", { keyPath: "id" });
      }
    };
  });
}

async function saveSongToLocal(song: DbSong): Promise<void> {
  const idb = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction("songs", "readwrite");
    const store = transaction.objectStore("songs");
    const request = store.put(song);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAllSongsFromLocal(): Promise<DbSong[]> {
  const idb = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction("songs", "readonly");
    const store = transaction.objectStore("songs");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function deleteSongFromLocal(id: string): Promise<void> {
  const idb = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction("songs", "readwrite");
    const store = transaction.objectStore("songs");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function saveAdToLocal(ad: DbAd): Promise<void> {
  const idb = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction("ads", "readwrite");
    const store = transaction.objectStore("ads");
    const request = store.put(ad);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAllAdsFromLocal(): Promise<DbAd[]> {
  const idb = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction("ads", "readonly");
    const store = transaction.objectStore("ads");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function deleteAdFromLocal(id: string): Promise<void> {
  const idb = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction("ads", "readwrite");
    const store = transaction.objectStore("ads");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// --- Persistent Deleted Items Helper ---

function getDeletedIds(): Set<string> {
  try {
    const savedNew = localStorage.getItem("swagat_deleted_ids");
    const savedOld = localStorage.getItem("swagat_deleted_samples");
    const arr1 = savedNew ? JSON.parse(savedNew) : [];
    const arr2 = savedOld ? JSON.parse(savedOld) : [];
    return new Set([...arr1, ...arr2]);
  } catch {
    return new Set();
  }
}

export function recordDeletedId(id: string): void {
  try {
    const deleted = getDeletedIds();
    deleted.add(id);
    const arr = Array.from(deleted);
    localStorage.setItem("swagat_deleted_ids", JSON.stringify(arr));
    localStorage.setItem("swagat_deleted_samples", JSON.stringify(arr));

    // Persist tombstone in Firestore so all connected devices sync deletion in realtime
    setDoc(doc(db, "deleted_ids", id), {
      id,
      deletedAt: new Date().toISOString()
    }).catch(err => console.warn("Notice: deleted_ids tombstone write:", err));
  } catch (e) {
    console.error("Error recording deleted ID:", e);
  }
}

export function removeDeletedId(id: string): void {
  try {
    const deleted = getDeletedIds();
    if (deleted.has(id)) {
      deleted.delete(id);
      const arr = Array.from(deleted);
      localStorage.setItem("swagat_deleted_ids", JSON.stringify(arr));
      localStorage.setItem("swagat_deleted_samples", JSON.stringify(arr));
    }
    deleteDoc(doc(db, "deleted_ids", id)).catch(() => {});
  } catch (e) {
    console.error("Error removing deleted ID:", e);
  }
}

export function subscribeDeletedIds(callback: (deletedSet: Set<string>) => void): () => void {
  const deletedColRef = collection(db, "deleted_ids");
  return onSnapshot(deletedColRef, (snapshot) => {
    try {
      const deletedSet = getDeletedIds();
      snapshot.forEach(docSnap => {
        if (docSnap.id) {
          deletedSet.add(docSnap.id);
          deleteSongFromLocal(docSnap.id).catch(() => {});
          deleteAdFromLocal(docSnap.id).catch(() => {});
        }
      });
      const arr = Array.from(deletedSet);
      localStorage.setItem("swagat_deleted_ids", JSON.stringify(arr));
      localStorage.setItem("swagat_deleted_samples", JSON.stringify(arr));
      callback(deletedSet);
    } catch (e) {
      console.error("Error in subscribeDeletedIds listener:", e);
      callback(getDeletedIds());
    }
  }, (err) => {
    console.warn("Notice in subscribeDeletedIds listener:", err);
    callback(getDeletedIds());
  });
}

export interface DbComment {
  id: string;
  itemId: string; // song or ad ID
  itemType: "song" | "ad";
  userName: string;
  comment: string;
  createdAt: string;
}

// --- COMMENTS SYSTEM (Realtime Firestore & Local Persistence) ---

export function getLocalComments(): DbComment[] {
  try {
    const saved = localStorage.getItem("swagat_app_comments");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveLocalComments(comments: DbComment[]): void {
  try {
    localStorage.setItem("swagat_app_comments", JSON.stringify(comments));
  } catch (e) {
    console.error("Error saving comments to localStorage:", e);
  }
}

export async function addCommentToDb(comment: DbComment): Promise<void> {
  const current = getLocalComments();
  const updated = [comment, ...current.filter(c => c.id !== comment.id)];
  saveLocalComments(updated);

  try {
    const commentDocRef = doc(db, "comments", comment.id);
    await setDoc(commentDocRef, comment, { merge: true });
  } catch (e) {
    console.warn("Firestore addComment notice (saved locally):", e);
  }
}

export async function deleteCommentFromDb(commentId: string): Promise<void> {
  const current = getLocalComments();
  const updated = current.filter(c => c.id !== commentId);
  saveLocalComments(updated);

  try {
    const commentDocRef = doc(db, "comments", commentId);
    await deleteDoc(commentDocRef);
  } catch (e) {
    console.warn("Firestore deleteComment notice (deleted locally):", e);
  }
}

export function subscribeComments(callback: (comments: DbComment[]) => void): () => void {
  const commentsColRef = collection(db, "comments");
  return onSnapshot(commentsColRef, (snapshot) => {
    try {
      const firestoreComments: DbComment[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.id && data.itemId && data.comment) {
          firestoreComments.push(data as DbComment);
        }
      });

      firestoreComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Merge with local comments if any exist offline
      const localComments = getLocalComments();
      const mergedMap = new Map<string, DbComment>();
      firestoreComments.forEach(c => mergedMap.set(c.id, c));
      localComments.forEach(c => {
        if (!mergedMap.has(c.id)) mergedMap.set(c.id, c);
      });

      const finalComments = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      saveLocalComments(finalComments);
      callback(finalComments);
    } catch (e) {
      console.error("Error in subscribeComments listener:", e);
      callback(getLocalComments());
    }
  }, (err) => {
    console.warn("Notice in subscribeComments listener:", err);
    callback(getLocalComments());
  });
}

// --- SONG VIEW COUNTING (3-Minute Original View Count) ---

export function getLocalSongViews(): Record<string, number> {
  try {
    const saved = localStorage.getItem("swagat_song_views");
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function saveLocalSongViews(viewsMap: Record<string, number>): void {
  try {
    localStorage.setItem("swagat_song_views", JSON.stringify(viewsMap));
  } catch (e) {
    console.error("Error saving song views to localStorage:", e);
  }
}

export async function incrementSongViews(songId: string): Promise<number> {
  const viewsMap = getLocalSongViews();
  const currentCount = (viewsMap[songId] || 0) + 1;
  viewsMap[songId] = currentCount;
  saveLocalSongViews(viewsMap);

  try {
    const viewDocRef = doc(db, "song_views", songId);
    await setDoc(viewDocRef, {
      id: songId,
      views: currentCount,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    const songDocRef = doc(db, "songs", songId);
    await setDoc(songDocRef, {
      views: currentCount
    }, { merge: true });
  } catch (e) {
    console.warn("Firestore incrementSongViews notice (stored locally):", e);
  }

  return currentCount;
}

export function subscribeSongViews(callback: (viewsMap: Record<string, number>) => void): () => void {
  const viewsColRef = collection(db, "song_views");
  return onSnapshot(viewsColRef, (snapshot) => {
    try {
      const viewsMap = getLocalSongViews();
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (docSnap.id && typeof data?.views === "number") {
          viewsMap[docSnap.id] = Math.max(viewsMap[docSnap.id] || 0, data.views);
        }
      });
      saveLocalSongViews(viewsMap);
      callback(viewsMap);
    } catch (e) {
      console.error("Error in subscribeSongViews listener:", e);
      callback(getLocalSongViews());
    }
  }, (err) => {
    console.warn("Notice in subscribeSongViews listener:", err);
    callback(getLocalSongViews());
  });
}

// --- Firebase Sync Public API Functions & Realtime Listeners ---

export async function saveSong(song: DbSong): Promise<void> {
  removeDeletedId(song.id);

  // 1. Compress photo to clean lightweight DataURL (< 100KB)
  const photoDataUrl = await compressImageToMaxDataUrl(song.photoBlob, 800, 0.82);
  const compressedPhotoBlob = dataUrlToBlob(photoDataUrl);

  const songToSave: DbSong = {
    ...song,
    photoBlob: compressedPhotoBlob.size > 0 ? compressedPhotoBlob : song.photoBlob
  };

  // 2. Save locally to IndexedDB cache
  await saveSongToLocal(songToSave);

  try {
    // 3. Convert audio blob to base64 string
    const audioBase64 = await blobToBase64(song.audioBlob);
    const audioChunks = chunkString(audioBase64, CHUNK_SIZE);

    // 4. Save metadata and photoDataUrl directly to Firestore doc
    const songDocRef = doc(db, "songs", song.id);
    await setDoc(songDocRef, {
      id: song.id,
      title: song.title,
      artist: song.artist,
      photoDataUrl: photoDataUrl,
      audioMimeType: song.audioBlob.type || "audio/mp3",
      createdAt: song.createdAt,
      audioChunkCount: audioChunks.length
    });

    // 5. Upload audio chunks to subcollection
    const chunkPromises = [];
    for (let i = 0; i < audioChunks.length; i++) {
      const chunkDocRef = doc(db, "songs", song.id, "audio_chunks", `chunk_${i}`);
      chunkPromises.push(setDoc(chunkDocRef, { data: audioChunks[i] }));
    }
    await Promise.all(chunkPromises);
  } catch (err) {
    console.warn("Firestore saveSong notice (saved to local cache):", err);
  }
}

export function subscribeSongs(callback: (songs: DbSong[]) => void): () => void {
  const songsCollectionRef = collection(db, "songs");
  return onSnapshot(songsCollectionRef, async (querySnapshot) => {
    try {
      const deletedIds = getDeletedIds();
      const firestoreSongsList: any[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.id && !deletedIds.has(data.id)) {
          firestoreSongsList.push(data);
        }
      });

      firestoreSongsList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const localSongs = await getAllSongsFromLocal();
      const localSongsMap = new Map(localSongs.filter(s => !deletedIds.has(s.id)).map(s => [s.id, s]));
      const seenIds = new Set<string>();

      const songsToReturn: DbSong[] = [];

      for (const fSong of firestoreSongsList) {
        if (deletedIds.has(fSong.id)) continue;
        seenIds.add(fSong.id);
        const cached = localSongsMap.get(fSong.id);
        if (cached && cached.photoBlob && cached.photoBlob.size > 0) {
          songsToReturn.push(cached);
        } else {
          // Reconstruct photoBlob from photoDataUrl or fallback SVG
          const photoDataUrl = fSong.photoDataUrl || DEFAULT_COVER_SVG;
          let photoBlob = dataUrlToBlob(photoDataUrl);
          if (photoBlob.size === 0) {
            photoBlob = dataUrlToBlob(DEFAULT_COVER_SVG);
          }

          // Fetch audio chunks
          const audioChunksPromises = [];
          for (let i = 0; i < (fSong.audioChunkCount || 0); i++) {
            const chunkDocRef = doc(db, "songs", fSong.id, "audio_chunks", `chunk_${i}`);
            audioChunksPromises.push(getDoc(chunkDocRef));
          }
          const audioSnaps = await Promise.all(audioChunksPromises);
          const audioBase64 = audioSnaps.map(snap => snap.data()?.data || "").join("");
          const audioBlob = base64ToBlob(audioBase64, fSong.audioMimeType || "audio/mp3");

          const reconstructedSong: DbSong = {
            id: fSong.id,
            title: fSong.title,
            artist: fSong.artist,
            audioBlob,
            photoBlob,
            createdAt: fSong.createdAt
          };

          await saveSongToLocal(reconstructedSong);
          songsToReturn.push(reconstructedSong);
        }
      }

      // Merge local songs that haven't synced to Firestore due to quota limits
      for (const [id, localSong] of localSongsMap.entries()) {
        if (!seenIds.has(id) && !deletedIds.has(id)) {
          songsToReturn.push(localSong);
        }
      }

      callback(songsToReturn);
    } catch (err) {
      console.error("Error in subscribeSongs listener:", err);
      const deletedIds = getDeletedIds();
      const local = await getAllSongsFromLocal();
      callback(local.filter(s => !deletedIds.has(s.id)));
    }
  }, (error) => {
    console.error("Firestore songs onSnapshot error:", error);
    const deletedIds = getDeletedIds();
    getAllSongsFromLocal().then(local => callback(local.filter(s => !deletedIds.has(s.id))));
  });
}

export async function getAllSongs(): Promise<DbSong[]> {
  const deletedIds = getDeletedIds();
  try {
    const songsCollectionRef = collection(db, "songs");
    const querySnapshot = await getDocs(songsCollectionRef);
    
    const firestoreSongsList: any[] = [];
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data && data.id && !deletedIds.has(data.id)) {
        firestoreSongsList.push(data);
      }
    });

    firestoreSongsList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const localSongs = await getAllSongsFromLocal();
    const localSongsMap = new Map(localSongs.filter(s => !deletedIds.has(s.id)).map(s => [s.id, s]));
    const seenIds = new Set<string>();

    const songsToReturn: DbSong[] = [];

    for (const fSong of firestoreSongsList) {
      if (deletedIds.has(fSong.id)) continue;
      seenIds.add(fSong.id);
      const cached = localSongsMap.get(fSong.id);
      if (cached && cached.photoBlob && cached.photoBlob.size > 0) {
        songsToReturn.push(cached);
      } else {
        const photoDataUrl = fSong.photoDataUrl || DEFAULT_COVER_SVG;
        let photoBlob = dataUrlToBlob(photoDataUrl);
        if (photoBlob.size === 0) {
          photoBlob = dataUrlToBlob(DEFAULT_COVER_SVG);
        }

        const audioChunksPromises = [];
        for (let i = 0; i < (fSong.audioChunkCount || 0); i++) {
          const chunkDocRef = doc(db, "songs", fSong.id, "audio_chunks", `chunk_${i}`);
          audioChunksPromises.push(getDoc(chunkDocRef));
        }
        const audioSnaps = await Promise.all(audioChunksPromises);
        const audioBase64 = audioSnaps.map(snap => snap.data()?.data || "").join("");
        const audioBlob = base64ToBlob(audioBase64, fSong.audioMimeType || "audio/mp3");

        const reconstructedSong: DbSong = {
          id: fSong.id,
          title: fSong.title,
          artist: fSong.artist,
          audioBlob,
          photoBlob,
          createdAt: fSong.createdAt
        };

        await saveSongToLocal(reconstructedSong);
        songsToReturn.push(reconstructedSong);
      }
    }

    for (const [id, localSong] of localSongsMap.entries()) {
      if (!seenIds.has(id) && !deletedIds.has(id)) {
        songsToReturn.push(localSong);
      }
    }

    return songsToReturn;
  } catch (err) {
    console.error("Failed to fetch songs from Firestore, falling back to local storage:", err);
    const local = await getAllSongsFromLocal();
    return local.filter(s => !deletedIds.has(s.id));
  }
}

export async function deleteSong(id: string): Promise<void> {
  recordDeletedId(id);
  await deleteSongFromLocal(id);

  try {
    const songDocRef = doc(db, "songs", id);
    await deleteDoc(songDocRef);

    const audioChunksRef = collection(db, "songs", id, "audio_chunks");
    const audioSnap = await getDocs(audioChunksRef);
    const deletePromises: Promise<void>[] = [];
    audioSnap.forEach(docSnap => {
      deletePromises.push(deleteDoc(docSnap.ref));
    });
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn("Error deleting song from Firestore (quota/network):", err);
  }
}

export async function saveAd(ad: DbAd): Promise<void> {
  removeDeletedId(ad.id);

  // 1. Compress advertisement poster image to lightweight DataURL (< 100KB)
  const imageDataUrl = await compressImageToMaxDataUrl(ad.imageBlob, 800, 0.82);
  const compressedImageBlob = dataUrlToBlob(imageDataUrl);

  const adToSave: DbAd = {
    ...ad,
    imageBlob: compressedImageBlob.size > 0 ? compressedImageBlob : ad.imageBlob
  };

  // 2. Save locally to IndexedDB cache
  await saveAdToLocal(adToSave);

  try {
    // 3. Save metadata and imageDataUrl directly to Firestore doc
    const adDocRef = doc(db, "ads", ad.id);
    await setDoc(adDocRef, {
      id: ad.id,
      title: ad.title,
      link: ad.link || "",
      imageDataUrl: imageDataUrl,
      createdAt: ad.createdAt
    });
  } catch (err) {
    console.warn("Firestore saveAd quota/network notice (saved to local cache):", err);
  }
}

export function subscribeAds(callback: (ads: DbAd[]) => void): () => void {
  const adsCollectionRef = collection(db, "ads");
  return onSnapshot(adsCollectionRef, async (querySnapshot) => {
    try {
      const deletedIds = getDeletedIds();
      const firestoreAdsList: any[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.id && !deletedIds.has(data.id)) {
          firestoreAdsList.push(data);
        }
      });

      firestoreAdsList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const localAds = await getAllAdsFromLocal();
      const localAdsMap = new Map(localAds.filter(a => !deletedIds.has(a.id)).map(a => [a.id, a]));
      const seenIds = new Set<string>();

      const adsToReturn: DbAd[] = [];

      for (const fAd of firestoreAdsList) {
        if (deletedIds.has(fAd.id)) continue;
        seenIds.add(fAd.id);
        const cached = localAdsMap.get(fAd.id);
        if (cached && cached.imageBlob && cached.imageBlob.size > 0) {
          adsToReturn.push(cached);
        } else {
          const imageDataUrl = fAd.imageDataUrl || DEFAULT_COVER_SVG;
          let imageBlob = dataUrlToBlob(imageDataUrl);
          if (imageBlob.size === 0) {
            imageBlob = dataUrlToBlob(DEFAULT_COVER_SVG);
          }

          const reconstructedAd: DbAd = {
            id: fAd.id,
            title: fAd.title,
            imageBlob,
            link: fAd.link || undefined,
            createdAt: fAd.createdAt
          };

          await saveAdToLocal(reconstructedAd);
          adsToReturn.push(reconstructedAd);
        }
      }

      for (const [id, localAd] of localAdsMap.entries()) {
        if (!seenIds.has(id) && !deletedIds.has(id)) {
          adsToReturn.push(localAd);
        }
      }

      callback(adsToReturn);
    } catch (err) {
      console.error("Error in subscribeAds listener:", err);
      const deletedIds = getDeletedIds();
      const local = await getAllAdsFromLocal();
      callback(local.filter(a => !deletedIds.has(a.id)));
    }
  }, (error) => {
    console.error("Firestore ads onSnapshot error:", error);
    const deletedIds = getDeletedIds();
    getAllAdsFromLocal().then(local => callback(local.filter(a => !deletedIds.has(a.id))));
  });
}

export async function getAllAds(): Promise<DbAd[]> {
  const deletedIds = getDeletedIds();
  try {
    const adsCollectionRef = collection(db, "ads");
    const querySnapshot = await getDocs(adsCollectionRef);

    const firestoreAdsList: any[] = [];
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data && data.id && !deletedIds.has(data.id)) {
        firestoreAdsList.push(data);
      }
    });

    firestoreAdsList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const localAds = await getAllAdsFromLocal();
    const localAdsMap = new Map(localAds.filter(a => !deletedIds.has(a.id)).map(a => [a.id, a]));
    const seenIds = new Set<string>();

    const adsToReturn: DbAd[] = [];

    for (const fAd of firestoreAdsList) {
      if (deletedIds.has(fAd.id)) continue;
      seenIds.add(fAd.id);
      const cached = localAdsMap.get(fAd.id);
      if (cached && cached.imageBlob && cached.imageBlob.size > 0) {
        adsToReturn.push(cached);
      } else {
        const imageDataUrl = fAd.imageDataUrl || DEFAULT_COVER_SVG;
        let imageBlob = dataUrlToBlob(imageDataUrl);
        if (imageBlob.size === 0) {
          imageBlob = dataUrlToBlob(DEFAULT_COVER_SVG);
        }

        const reconstructedAd: DbAd = {
          id: fAd.id,
          title: fAd.title,
          imageBlob,
          link: fAd.link || undefined,
          createdAt: fAd.createdAt
        };

        await saveAdToLocal(reconstructedAd);
        adsToReturn.push(reconstructedAd);
      }
    }

    for (const [id, localAd] of localAdsMap.entries()) {
      if (!seenIds.has(id) && !deletedIds.has(id)) {
        adsToReturn.push(localAd);
      }
    }

    return adsToReturn;
  } catch (err) {
    console.error("Failed to fetch ads from Firestore, falling back to local storage:", err);
    const local = await getAllAdsFromLocal();
    return local.filter(a => !deletedIds.has(a.id));
  }
}

export async function deleteAd(id: string): Promise<void> {
  recordDeletedId(id);
  await deleteAdFromLocal(id);

  try {
    const adDocRef = doc(db, "ads", id);
    await deleteDoc(adDocRef);
  } catch (err) {
    console.warn("Error deleting ad from Firestore (quota/network):", err);
  }
}
