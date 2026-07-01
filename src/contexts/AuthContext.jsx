import { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function register(email, password, displayName, department) {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    const profile = {
      email,
      displayName,
      department,
      role: 'staff',
      status: 'pending',
      createdAt: serverTimestamp(),
      photoURL: '',
    };
    await setDoc(doc(db, 'users', user.uid), profile);
    setUserProfile({ ...profile, uid: user.uid });
    return user;
  }

  async function login(email, password) {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    return user;
  }

  async function loginWithGoogle(department) {
    const { user } = await signInWithPopup(auth, googleProvider);
    const docRef = doc(db, 'users', user.uid);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      const profile = {
        email: user.email,
        displayName: user.displayName || 'Google User',
        department: department || 'Other',
        role: 'staff',
        status: 'pending',
        createdAt: serverTimestamp(),
        photoURL: user.photoURL || '',
      };
      await setDoc(docRef, profile);
      setUserProfile({ ...profile, uid: user.uid });
    } else {
      setUserProfile({ uid: user.uid, ...snap.data() });
    }
    return user;
  }

  function logout() {
    setUserProfile(null);
    return signOut(auth);
  }

  async function fetchUserProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = { uid, ...snap.data() };
      setUserProfile(data);
      return data;
    }
    return null;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
    register,
    login,
    loginWithGoogle,
    logout,
    fetchUserProfile,
    isAdmin: userProfile?.role === 'admin',
    isApproved: userProfile?.status === 'approved',
    isPending: userProfile?.status === 'pending',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
