import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatDate } from './qrTokenUtils';

/**
 * Departments excluded from Work From Home eligibility
 */
const INELIGIBLE_DEPARTMENTS = ['trainer', 'maintenance'];

/**
 * Check if a department is eligible for WFH
 */
export function isEligibleForWFH(department) {
  if (!department) return false;
  const deptLower = String(department).trim().toLowerCase();
  return !INELIGIBLE_DEPARTMENTS.includes(deptLower);
}

/**
 * Submit a WFH request
 */
export async function submitWFHRequest({ userId, userName, department, requestDate, reason }) {
  try {
    if (!isEligibleForWFH(department)) {
      return {
        success: false,
        message: 'Employees in Trainer or Maintenance departments are not eligible for Work From Home.',
      };
    }

    if (!requestDate) {
      return { success: false, message: 'Please select a valid date for WFH request.' };
    }

    // Check if user already submitted a request for this date
    const q = query(
      collection(db, 'wfh_requests'),
      where('userId', '==', userId),
      where('requestDate', '==', requestDate)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const existing = snap.docs[0].data();
      return {
        success: false,
        message: `You already have a ${existing.status.toLowerCase()} WFH request for ${requestDate}.`,
      };
    }

    // Create WFH request
    const requestData = {
      userId,
      userName: userName || 'Employee',
      department: department || 'General',
      requestDate,
      reason: reason ? reason.trim() : '',
      status: 'PENDING',
      approvedBy: null,
      approvedByName: null,
      approvedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'wfh_requests'), requestData);

    return {
      success: true,
      id: docRef.id,
      message: `WFH request submitted for ${requestDate}. Awaiting manager approval.`,
    };
  } catch (error) {
    console.error('Error submitting WFH request:', error);
    return {
      success: false,
      message: error.message || 'Failed to submit WFH request.',
    };
  }
}

/**
 * Fetch all WFH requests for a user
 */
export async function getUserWFHRequests(userId) {
  try {
    const q = query(
      collection(db, 'wfh_requests'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return results.sort((a, b) => (b.requestDate || '').localeCompare(a.requestDate || ''));
  } catch (error) {
    console.error('Error fetching user WFH requests:', error);
    return [];
  }
}

/**
 * Fetch today's WFH request status for a user
 */
export async function getTodayWFHRequest(userId, todayDateStr) {
  try {
    const todayStr = todayDateStr || formatDate(new Date());
    const q = query(
      collection(db, 'wfh_requests'),
      where('userId', '==', userId),
      where('requestDate', '==', todayStr)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch (error) {
    console.error('Error fetching today WFH request:', error);
    return null;
  }
}

/**
 * Fetch all WFH requests for Admin review
 */
export async function getAllWFHRequests() {
  try {
    const q = query(collection(db, 'wfh_requests'));
    const snap = await getDocs(q);
    const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return results.sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      if (tA !== tB) return tB - tA;
      return (b.requestDate || '').localeCompare(a.requestDate || '');
    });
  } catch (error) {
    console.error('Error fetching all WFH requests:', error);
    return [];
  }
}

/**
 * Update WFH request status (Admin Approve / Reject)
 */
export async function updateWFHRequestStatus(requestId, status, adminId, adminName) {
  try {
    const docRef = doc(db, 'wfh_requests', requestId);
    await updateDoc(docRef, {
      status,
      approvedBy: adminId,
      approvedByName: adminName || 'Admin',
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating WFH request status:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Reverse Geocode coordinates to city/location string
 */
export async function fetchLocationName(lat, lng) {
  if (!lat || !lng) return 'Remote Location';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
      {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'AttendEase-WFHApp/1.0',
        },
      }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.address) {
        const city =
          data.address.city ||
          data.address.town ||
          data.address.suburb ||
          data.address.village ||
          data.address.county ||
          '';
        const country = data.address.country || '';
        if (city && country) return `${city}, ${country}`;
        if (city) return city;
        if (data.display_name) {
          const parts = data.display_name.split(',');
          return parts.slice(0, 2).join(',').trim();
        }
      }
    }
  } catch (e) {
    // Ignore timeout / network errors and fallback
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/**
 * Get device user agent and IP info
 */
export async function getDeviceAndIPInfo() {
  let ip = 'Unknown IP';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      ip = data.ip || ip;
    }
  } catch {
    // Ignore error
  }

  return {
    deviceInformation: navigator.userAgent || 'Unknown Device',
    ipAddress: ip,
  };
}

/**
 * Record WFH Attendance Check-In / Check-Out
 */
export async function recordWFHAttendance({ userId, userName, type, coords, wfhRequestId }) {
  try {
    const now = new Date();
    const today = formatDate(now);

    // Get location name
    let locationName = 'Work From Home';
    if (coords && coords.latitude && coords.longitude) {
      locationName = await fetchLocationName(coords.latitude, coords.longitude);
    }

    // Get device & IP info
    const deviceDetails = await getDeviceAndIPInfo();

    const attendanceRecord = {
      userId,
      userName,
      type, // 'check-in' or 'check-out'
      attendanceType: 'WFH',
      wfhRequestId: wfhRequestId || null,
      office: 'Work From Home',
      date: today,
      timestamp: serverTimestamp(),
      location: coords
        ? {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy || null,
            addressName: locationName,
            googleMapsUrl: `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`,
          }
        : {
            addressName: 'Work From Home',
          },
      deviceInformation: deviceDetails.deviceInformation,
      ipAddress: deviceDetails.ipAddress,
    };

    const docRef = await addDoc(collection(db, 'attendance'), attendanceRecord);

    return {
      success: true,
      docId: docRef.id,
      type,
      locationName,
      message:
        type === 'check-in'
          ? `Checked in for WFH successfully at ${locationName}!`
          : `Checked out from WFH successfully at ${locationName}!`,
    };
  } catch (error) {
    console.error('Error recording WFH attendance:', error);
    return {
      success: false,
      message: error.message || 'Failed to record WFH attendance.',
    };
  }
}
