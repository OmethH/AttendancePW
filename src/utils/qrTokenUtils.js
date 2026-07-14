import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Record attendance at a static office location with optional GPS coordinates.
 * Returns { success, type, message, docId }
 */
export async function recordAttendanceWithLocation(officeName, userId, userName, coords, replaceData = null) {
  try {
    const now = new Date();
    const today = formatDate(now);

    let type = 'check-in';
    let docId = null;

    if (replaceData) {
      type = replaceData.type;
      docId = replaceData.docId;
    } else {
      // 1. Determine check-in or check-out based on last record today
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('userId', '==', userId),
        where('date', '==', today),
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      const attendanceSnap = await getDocs(attendanceQuery);

      if (!attendanceSnap.empty) {
        const lastRecord = attendanceSnap.docs[0].data();
        type = lastRecord.type === 'check-in' ? 'check-out' : 'check-in';
      }
    }

    // 2. Build attendance record
    const attendanceRecord = {
      userId,
      userName,
      type,
      timestamp: serverTimestamp(),
      date: today,
      office: officeName,
    };

    if (coords) {
      attendanceRecord.location = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy || null,
      };
    }

    // 3. Save to Firestore
    if (docId) {
      // Update existing record
      const docRef = doc(db, 'attendance', docId);
      await updateDoc(docRef, attendanceRecord);
    } else {
      // Create new record
      const docRef = await addDoc(collection(db, 'attendance'), attendanceRecord);
      docId = docRef.id;
    }

    // 4. Update user's officeLocation in Firestore if it was a check-in
    if (type === 'check-in') {
      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { officeLocation: officeName });
      } catch (userErr) {
        console.error('Error updating user office location on check-in:', userErr);
      }
    }

    return {
      success: true,
      type,
      docId,
      message: type === 'check-in'
        ? `Welcome, ${userName}! You are checked in at ${officeName}.`
        : `Goodbye, ${userName}! You are checked out from ${officeName}.`,
    };
  } catch (error) {
    console.error('Error recording attendance:', error);
    return { 
      success: false, 
      type: null, 
      message: `Failed to record attendance: ${error.message || 'Unknown database error.'}` 
    };
  }
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Build static QR code payload containing app url and office identifier.
 */
export function buildStaticQRPayload(officeId = 'Main Office') {
  const baseUrl = window.location.origin;
  return `${baseUrl}/scan?office=${encodeURIComponent(officeId)}`;
}

/**
 * Calculate total milliseconds worked for a day based on consecutive check-in and check-out pairs.
 * @param {Array} dayRecords - Array of attendance records for a specific day
 */
export function calculateDailyMs(dayRecords) {
  // Sort records ASC by timestamp
  const sorted = [...dayRecords].sort((a, b) => {
    const tA = a.timestamp?.seconds || 0;
    const tB = b.timestamp?.seconds || 0;
    return tA - tB;
  });

  let totalMs = 0;
  let lastCheckInTime = null;

  for (const r of sorted) {
    if (r.type === 'check-in') {
      lastCheckInTime = r.timestamp?.seconds;
    } else if (r.type === 'check-out') {
      if (lastCheckInTime && r.timestamp?.seconds >= lastCheckInTime) {
        totalMs += (r.timestamp.seconds - lastCheckInTime) * 1000;
        lastCheckInTime = null; // consume the check-in
      }
    }
  }
  return totalMs;
}
