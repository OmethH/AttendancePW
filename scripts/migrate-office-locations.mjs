import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocs,
  collection,
  updateDoc,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAHX3xrELYb6Na0qtl6BTW2uSf-FGNjPwg',
  authDomain: 'attendancepw.firebaseapp.com',
  projectId: 'attendancepw',
  storageBucket: 'attendancepw.firebasestorage.app',
  messagingSenderId: '280289339975',
  appId: '1:280289339975:web:8317be95a74fd0853d5f62',
};

const ADMIN_EMAIL = 'admin@pw.com';
const ADMIN_PASSWORD = 'admin123';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function runMigration() {
  console.log('🚀 Starting Office Location Migration...');

  try {
    // 1. Authenticate as Admin to bypass Firestore security rules
    console.log(`🔐 Authenticating as admin: ${ADMIN_EMAIL}...`);
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Authentication successful.');

    // 2. Fetch available offices to determine a default fallback location
    const officesSnap = await getDocs(collection(db, 'offices'));
    const officeNames = officesSnap.docs.map((d) => d.data().name);
    console.log(`🏢 Configured offices in DB: ${JSON.stringify(officeNames)}`);
    const defaultOffice = officeNames.length > 0 ? officeNames[0] : 'Main Office Premises';
    console.log(`📌 Using default fallback office: "${defaultOffice}"`);

    // 3. Fetch all users
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log(`👤 Found ${usersSnap.size} total users in DB.`);

    // 4. Fetch all attendance records for processing in-memory
    const attendanceSnap = await getDocs(collection(db, 'attendance'));
    const attendanceRecords = attendanceSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    console.log(`📅 Loaded ${attendanceRecords.length} attendance records.`);

    // 5. Iterate over users and update officeLocation
    let updatedCount = 0;
    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      console.log(`\nProcessing user: ${userData.displayName || userData.email} (${userId})`);

      // Filter and sort attendance records for this user in-memory
      const userCheckIns = attendanceRecords
        .filter((r) => r.userId === userId && r.type === 'check-in')
        .sort((a, b) => {
          const timeA = a.timestamp?.seconds || 0;
          const timeB = b.timestamp?.seconds || 0;
          return timeB - timeA; // Descending order (latest first)
        });

      let finalOffice = '';
      if (userCheckIns.length > 0) {
        finalOffice = userCheckIns[0].office || '';
        console.log(`   👉 Found latest check-in at office: "${finalOffice}" (Record ID: ${userCheckIns[0].id})`);
      } else {
        finalOffice = '';
        console.log(`   👉 No check-in records found. Keeping office location blank.`);
      }

      // Update the user's document with officeLocation
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        officeLocation: finalOffice,
      });
      console.log(`   ✅ User profile updated successfully with officeLocation: "${finalOffice}"`);
      updatedCount++;
    }

    console.log(`\n🎉 Migration completed successfully! Updated ${updatedCount} users.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed with error:', error);
    process.exit(1);
  }
}

runMigration();
