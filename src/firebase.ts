import { initializeApp } from "firebase/app";
import { initializeFirestore, setLogLevel } from "firebase/firestore";

// Suppress internal Firestore SDK verbose retry & quota warning logs in console
setLogLevel("silent");

const firebaseConfig = {
  projectId: "elemental-xyston-rgtt6",
  appId: "1:884149172455:web:8727009563a6f7bb008a42",
  apiKey: "AIzaSyAdh0yHsEjlhq87lJm6WvJNVNbl1K697_g",
  authDomain: "elemental-xyston-rgtt6.firebaseapp.com",
  storageBucket: "elemental-xyston-rgtt6.firebasestorage.app",
  messagingSenderId: "884149172455"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with the custom database ID provided in the config and force long-polling for stability in sandbox environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, "ai-studio-swagatodiawelcom-91e26fb4-9438-4b30-a1aa-8c707d4442b3");

