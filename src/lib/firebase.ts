import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // <-- 1. Tambahkan ini
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); // <-- 2. Tambahkan ini agar database bisa dipakai
const provider = new GoogleAuthProvider();
// Request Google Drive scope (drive.file scope for web applications)
provider.addScope("https://www.googleapis.com/auth/drive.file");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // If we don't have token cached but user is logged in, we might need a re-auth or wait
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Gagal mendapatkan access token dari Firebase Auth");
    }

    cachedAccessToken = credential.accessToken;
    // Persist to storage so any employee upload uses the central admin Google Drive token
    sessionStorage.setItem("gdrive_access_token", cachedAccessToken);
    localStorage.setItem("gdrive_access_token", cachedAccessToken);
    if (result.user.email) {
      localStorage.setItem("gdrive_user_email", result.user.email);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  if (!cachedAccessToken) {
    cachedAccessToken = sessionStorage.getItem("gdrive_access_token") || localStorage.getItem("gdrive_access_token");
  }
  return cachedAccessToken;
};

export const logout = async () => {
  cachedAccessToken = null;
  sessionStorage.removeItem("gdrive_access_token");
  await auth.signOut();
};
