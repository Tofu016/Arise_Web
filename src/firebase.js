import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

// This config is a client identifier, not a secret — it's safe to commit.
// Actual access control comes from Firestore/Storage Security Rules, not
// from keeping this object private. See FIREBASE_SETUP.md for the rules
// this project expects to have in place.
const firebaseConfig = {
  apiKey: "AIzaSyBlbEhPopzySkTI6YOg18fVAOixVcKhIZM",
  authDomain: "arise-authentication-fda17.firebaseapp.com",
  databaseURL: "https://arise-authentication-fda17-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "arise-authentication-fda17",
  storageBucket: "arise-authentication-fda17.firebasestorage.app",
  messagingSenderId: "682892051669",
  appId: "1:682892051669:web:a4ca94a72ebcdb769e0e5c",
  measurementId: "G-0PZ511TTJL",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
// Region must match where the callable Cloud Functions are deployed
// (see functions/index.js) — deleteUserAccount lives in us-central1.
export const functions = getFunctions(app, "us-central1");
