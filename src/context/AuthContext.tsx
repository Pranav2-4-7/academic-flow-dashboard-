"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  User, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";

interface AuthContextType {
  user: any | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  courseraIcsUrl: string | null;
  updateCourseraIcsUrl: (url: string) => Promise<void>;
  isGuest: boolean;
  signInAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [courseraIcsUrl, setCourseraIcsUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // Check if there is a saved guest session in localStorage
    const savedGuest = localStorage.getItem("study_sync_guest_user");
    if (savedGuest) {
      setUser(JSON.parse(savedGuest));
      setIsGuest(true);
      setCourseraIcsUrl(localStorage.getItem("study_sync_guest_ics_url"));
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          setIsGuest(false);
          
          // Sync user info into Firestore
          const userRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(userRef);
          
          let existingIcsUrl = null;
          if (docSnap.exists()) {
            existingIcsUrl = docSnap.data().courseraIcsUrl || null;
            setCourseraIcsUrl(existingIcsUrl);
          }

          await setDoc(
            userRef,
            {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              courseraIcsUrl: existingIcsUrl,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } else {
          setUser(null);
          setCourseraIcsUrl(null);
          setIsGuest(false);
        }
      } catch (error) {
        console.error("Auth context initialization failed:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      localStorage.removeItem("study_sync_guest_user");
      localStorage.removeItem("study_sync_guest_ics_url");
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      setLoading(false);
      throw error;
    }
  };

  const signInAsGuest = () => {
    setLoading(true);
    const guestUser = {
      uid: "guest_user",
      displayName: "Alex Johnson",
      email: "Computer Science",
      photoURL: "https://lh3.googleusercontent.com/aida-public/AB6AXuD_LVrI0K7dGYyqxKijSWR--Fc4hHxKiz9GITNqnmRMhNxN4TB-joD4v1VffKAPSAtVoh2347ItDeJ8OAOeB2a8jdnnpb8H2rxrPlTA6dkUgXIzVMDRmDnGMO35BXFfTUcpbYqwTAgqCC8rnrHXbb_WGecDV-i5VY2BoVIPLDEnMLgCJBMaLkIBMc3ab0Yt4ZRWP5Qu_NyXMdYYAwsCp2Wnpr_15e0rHLiULwV1FaQkxlYJ7MUaVLI1",
    };
    setUser(guestUser);
    setIsGuest(true);
    localStorage.setItem("study_sync_guest_user", JSON.stringify(guestUser));
    setLoading(false);
  };

  const signOut = async () => {
    setLoading(true);
    if (isGuest) {
      localStorage.removeItem("study_sync_guest_user");
      localStorage.removeItem("study_sync_guest_ics_url");
      setUser(null);
      setCourseraIcsUrl(null);
      setIsGuest(false);
      setLoading(false);
    } else {
      try {
        await firebaseSignOut(auth);
      } catch (error) {
        console.error("Sign-Out Error:", error);
        setLoading(false);
      }
    }
  };

  const updateCourseraIcsUrl = async (url: string) => {
    if (!user) return;
    if (isGuest) {
      localStorage.setItem("study_sync_guest_ics_url", url);
      setCourseraIcsUrl(url);
    } else {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, { courseraIcsUrl: url }, { merge: true });
      setCourseraIcsUrl(url);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signOut,
        courseraIcsUrl,
        updateCourseraIcsUrl,
        isGuest,
        signInAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
