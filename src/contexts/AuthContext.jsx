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
  collection,
  query,
  where,
  getDocs,
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

  async function register(email, password, displayName, department, officeLocation) {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      const profile = {
        email,
        password, // Store password in Firestore for hybrid login
        displayName,
        department,
        officeLocation: officeLocation || '',
        role: 'staff',
        status: 'pending',
        createdAt: serverTimestamp(),
        photoURL: '',
      };
      await setDoc(doc(db, 'users', user.uid), profile);
      setUserProfile({ ...profile, uid: user.uid });
      return user;
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        try {
          const { user } = await signInWithEmailAndPassword(auth, email, password);
          const docRef = doc(db, 'users', user.uid);
          const snap = await getDoc(docRef);
          
          if (!snap.exists()) {
            const profile = {
              email,
              displayName,
              department,
              officeLocation: officeLocation || '',
              role: 'staff',
              status: 'pending',
              createdAt: serverTimestamp(),
              photoURL: '',
            };
            await setDoc(docRef, profile);
            setUserProfile({ ...profile, uid: user.uid });
            return user;
          } else {
            throw error;
          }
        } catch (loginError) {
          throw error;
        }
      }
      throw error;
    }
  }

  async function login(email, password) {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      localStorage.removeItem('custom_session');
      return user;
    } catch (error) {
      // Fallback: check Firestore for password (hybrid login)
      try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const userDoc = snap.docs[0];
          const data = userDoc.data();
          if (data.password === password) {
            const mockUser = {
              uid: userDoc.id,
              email: data.email,
              displayName: data.displayName,
              isCustomSession: true
            };
            localStorage.setItem('custom_session', JSON.stringify(mockUser));
            setCurrentUser(mockUser);
            setUserProfile({ uid: userDoc.id, ...data });
            return mockUser;
          }
        }
      } catch (firestoreError) {
        console.error('Firestore login fallback error:', firestoreError);
      }
      throw error;
    }
  }

  async function loginWithGoogle(department, officeLocation) {
    const { user } = await signInWithPopup(auth, googleProvider);
    const docRef = doc(db, 'users', user.uid);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      if (!department) {
        await signOut(auth);
        throw { code: 'auth/new-user', message: 'User profile does not exist. Please register first.' };
      }
      const profile = {
        email: user.email,
        displayName: user.displayName || 'Google User',
        department: department,
        officeLocation: officeLocation || '',
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
    localStorage.removeItem('custom_session');
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
      if (user) {
        setCurrentUser(user);
        await fetchUserProfile(user.uid);
      } else {
        const customSessionStr = localStorage.getItem('custom_session');
        if (customSessionStr) {
          try {
            const mockUser = JSON.parse(customSessionStr);
            setCurrentUser(mockUser);
            await fetchUserProfile(mockUser.uid);
          } catch (e) {
            localStorage.removeItem('custom_session');
            setCurrentUser(null);
            setUserProfile(null);
          }
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
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
