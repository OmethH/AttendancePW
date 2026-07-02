/**
 * One-time admin setup script.
 *
 * 1. Creates a new Firebase Auth user (admin@attendancepw.com / admin@123)
 *    and writes a Firestore 'users' doc with role: 'admin'.
 * 2. Finds rakithalakvindu@gmail.com in Firestore and demotes to role: 'staff'.
 *
 * Run with:  node scripts/setup-admin.mjs
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAHX3xrELYb6Na0qtl6BTW2uSf-FGNjPwg',
  authDomain: 'attendancepw.firebaseapp.com',
  projectId: 'attendancepw',
  storageBucket: 'attendancepw.firebasestorage.app',
  messagingSenderId: '280289339975',
  appId: '1:280289339975:web:8317be95a74fd0853d5f62',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = 'admin@attendancepw.com';
const ADMIN_PASSWORD = 'admin@123';
const ADMIN_DISPLAY_NAME = 'Admin';

const DEMOTE_EMAIL = 'rakithalakvindu@gmail.com';

async function main() {
  // ── Step 1: Create admin account ─────────────────────────
  console.log(`\n🔧 Creating admin account: ${ADMIN_EMAIL}`);
  try {
    const { user } = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log(`   ✅ Auth user created  (uid: ${user.uid})`);

    await setDoc(doc(db, 'users', user.uid), {
      email: ADMIN_EMAIL,
      displayName: ADMIN_DISPLAY_NAME,
      department: 'Administration',
      role: 'admin',
      status: 'approved',
      createdAt: serverTimestamp(),
      photoURL: '',
    });
    console.log('   ✅ Firestore profile written with role: admin');
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log('   ⚠️  Auth user already exists – skipping creation.');
      // Sign in to get uid so we can ensure Firestore doc is correct
      try {
        const { user } = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        await setDoc(doc(db, 'users', user.uid), {
          email: ADMIN_EMAIL,
          displayName: ADMIN_DISPLAY_NAME,
          department: 'Administration',
          role: 'admin',
          status: 'approved',
          createdAt: serverTimestamp(),
          photoURL: '',
        }, { merge: true });
        console.log('   ✅ Firestore profile updated to role: admin');
      } catch (loginErr) {
        console.error('   ❌ Could not sign in to update profile:', loginErr.message);
      }
    } else {
      console.error('   ❌ Error creating admin:', err.message);
    }
  }

  // ── Step 2: Demote rakithalakvindu@gmail.com ─────────────
  console.log(`\n🔧 Demoting ${DEMOTE_EMAIL} from admin to staff`);
  try {
    const q = query(collection(db, 'users'), where('email', '==', DEMOTE_EMAIL));
    const snap = await getDocs(q);
    if (snap.empty) {
      console.log('   ⚠️  No Firestore user found with that email.');
    } else {
      for (const d of snap.docs) {
        await updateDoc(doc(db, 'users', d.id), { role: 'staff' });
        console.log(`   ✅ Updated doc ${d.id} → role: staff`);
      }
    }
  } catch (err) {
    console.error('   ❌ Error demoting user:', err.message);
  }

  console.log('\n✨ Done. You can now log in as:');
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}\n`);
  process.exit(0);
}

main();
