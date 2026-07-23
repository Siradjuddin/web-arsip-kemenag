import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
// Pakai cakupan Google Drive penuh untuk upload ke folder pusat dan folder khusus yang telah ditentukan
provider.addScope("https://www.googleapis.com/auth/drive");
provider.addScope("https://www.googleapis.com/auth/drive.metadata.readonly");

// Memaksa Google memunculkan ulang dialog persetujuan dan pemilihan akun
provider.setCustomParameters({
  prompt: "consent select_account",
});

let isSigningIn = false;
let cachedAccessToken: string | null = 
  sessionStorage.getItem("gdrive_access_token") || 
  localStorage.getItem("gdrive_access_token");

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = getAccessToken();
      if (token) {
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      sessionStorage.removeItem("gdrive_access_token");
      localStorage.removeItem("gdrive_access_token");
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
      throw new Error("Gagal mendapatkan access token Google Drive dari autentikasi Firebase.");
    }

    cachedAccessToken = credential.accessToken;
    
    // Simpan token ke session dan local storage agar aman dan persisten
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
    cachedAccessToken = 
      sessionStorage.getItem("gdrive_access_token") || 
      localStorage.getItem("gdrive_access_token");
  }
  return cachedAccessToken;
};

export const clearGDriveToken = () => {
  cachedAccessToken = null;
  sessionStorage.removeItem("gdrive_access_token");
  localStorage.removeItem("gdrive_access_token");
};

export const logout = async () => {
  clearGDriveToken();
  localStorage.removeItem("gdrive_user_email");
  await auth.signOut();
};