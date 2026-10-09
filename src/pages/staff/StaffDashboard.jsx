import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, calculateDailyMs } from '../../utils/qrTokenUtils';
import {
  isEligibleForWFH,
  recordWFHAttendance,
} from '../../utils/wfhUtils';
import StatCard from '../../components/StatCard';
import AttendanceTable from '../../components/AttendanceTable';

export default function StaffDashboard() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [todayStatus, setTodayStatus] = useState(null);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ thisWeek: 0, thisMonth: 0, totalHoursToday: '—', totalHoursThisMonth: '—' });
  const [loading, setLoading] = useState(true);

  // WFH Feature State
  const [wfhActiveRecord, setWfhActiveRecord] = useState(null);
  const [wfhActionLoading, setWfhActionLoading] = useState(false);
  const [wfhAlert, setWfhAlert] = useState({ text: '', type: '' });

  const eligibleForWFH = isEligibleForWFH(userProfile?.department);

  useEffect(() => {
    if (currentUser) {
      fetchMyAttendance();
    }
  }, [currentUser, userProfile]);

  async function fetchMyAttendance() {
    try {
      const today = formatDate(new Date());

      // Fetch all records for this user
      const q = query(
        collection(db, 'attendance'),
        where('userId', '==', currentUser.uid)
      );
      const snap = await getDocs(q);
      let allRecords = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Sort desc
      allRecords = allRecords
        .sort((a, b) => {
          if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
          const tA = a.timestamp?.seconds || 0;
          const tB = b.timestamp?.seconds || 0;
          return tB - tA;
        });

      // Calculate daily hours for UI
      const dateRecordsMap = {};
      allRecords.forEach((r) => {
        if (!dateRecordsMap[r.date]) dateRecordsMap[r.date] = [];
        dateRecordsMap[r.date].push(r);
      });

      const seenDate = new Set();
      allRecords = allRecords.map((r) => {
        let dailyHours = '';
        if (!seenDate.has(r.date)) {
          seenDate.add(r.date);
          const dayRecords = dateRecordsMap[r.date];
          const diffMs = calculateDailyMs(dayRecords);
          if (diffMs > 0) {
            const dHours = Math.floor(diffMs / 3600000);
            const dMinutes = Math.floor((diffMs % 3600000) / 60000);
            dailyHours = `${dHours}h ${dMinutes}m`;
          }
        }
        return { ...r, dailyHours };
      });

      setRecords(allRecords);

      // Today's status
      const todayRecords = allRecords.filter((r) => r.date === today);
      if (todayRecords.length > 0) {
        const lastRecord = todayRecords[0];
        setTodayStatus({
          type: lastRecord.type,
          attendanceType: lastRecord.attendanceType || 'OFFICE',
          time: lastRecord.timestamp
            ? new Date(lastRecord.timestamp.seconds * 1000).toLocaleTimeString()
            : '—',
          totalRecords: todayRecords.length,
          record: lastRecord,
        });

        // Check if latest action is WFH check-in
        if (lastRecord.attendanceType === 'WFH' && lastRecord.type === 'check-in') {
          setWfhActiveRecord(lastRecord);
        } else {
          setWfhActiveRecord(null);
        }

        // Calculate hours today
        const diffMs = calculateDailyMs(todayRecords);
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        setStats((prev) => ({
          ...prev,
          totalHoursToday: diffMs > 0 ? `${hours}h ${minutes}m` : '0h 0m',
        }));
      } else {
        setWfhActiveRecord(null);
      }

      // This week count (unique days with check-in)
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const weekStart = formatDate(startOfWeek);
      const thisWeekDays = new Set(
        allRecords
          .filter((r) => r.date >= weekStart && r.type === 'check-in')
          .map((r) => r.date)
      );

      // This month count
      const monthStart = `${today.slice(0, 7)}-01`;
      const monthRecords = allRecords.filter((r) => r.date >= monthStart);

      const thisMonthDays = new Set(
        monthRecords.filter((r) => r.type === 'check-in').map((r) => r.date)
      );

      let totalMsThisMonth = 0;
      const daysInMonth = Array.from(new Set(monthRecords.map((r) => r.date)));

      daysInMonth.forEach((day) => {
        const dayRecords = monthRecords.filter((r) => r.date === day);
        totalMsThisMonth += calculateDailyMs(dayRecords);
      });

      const monthHours = Math.floor(totalMsThisMonth / 3600000);
      const monthMinutes = Math.floor((totalMsThisMonth % 3600000) / 60000);
      const formattedMonthHours = totalMsThisMonth > 0 ? `${monthHours}h ${monthMinutes}m` : '0h 0m';

      setStats((prev) => ({
        ...prev,
        thisWeek: thisWeekDays.size,
        thisMonth: thisMonthDays.size,
        totalHoursThisMonth: formattedMonthHours,
      }));
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }

  // WFH Check-in / Check-out button handler
  async function handleWFHButtonClick() {
    setWfhAlert({ text: '', type: '' });

    if (!eligibleForWFH) {
      return;
    }

    // Check if user is currently checked in at Office
    if (todayStatus && todayStatus.type === 'check-in' && todayStatus.attendanceType === 'OFFICE') {
      setWfhAlert({
        text: 'You are currently checked in at an Office checkpoint. Please check out before starting a WFH session.',
        type: 'error',
      });
      return;
    }

    const actionType = wfhActiveRecord ? 'check-out' : 'check-in';
    await processWFHCheckInOut(actionType);
  }

  async function processWFHCheckInOut(actionType) {
    setWfhActionLoading(true);
    setWfhAlert({ text: '', type: '' });

    if (!navigator.geolocation) {
      setWfhAlert({
        text: 'Geolocation is not supported by your browser.',
        type: 'error',
      });
      setWfhActionLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        const res = await recordWFHAttendance({
          userId: currentUser.uid,
          userName: userProfile?.displayName || currentUser.email,
          office: userProfile?.officeLocation || userProfile?.office || 'Head Office',
          type: actionType,
          coords,
        });

        setWfhActionLoading(false);

        if (res.success) {
          setWfhAlert({ text: res.message, type: 'success' });
          await fetchMyAttendance();
        } else {
          setWfhAlert({ text: res.message, type: 'error' });
        }
      },
      (error) => {
        console.error('Error getting location for WFH:', error);
        setWfhActionLoading(false);
        setWfhAlert({
          text: 'Location permission is required for Work From Home check-in/check-out. Please enable GPS permissions.',
          type: 'error',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ animation: 'spin 0.8s linear infinite', fontSize: '2rem', marginBottom: '8px' }}>⟳</div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h1>Welcome, {userProfile?.displayName?.split(' ')[0] || 'Staff'} 👋</h1>
          <p>Your attendance summary and history</p>
        </div>
        <div className="flex gap-xs" style={{ alignItems: 'center' }}>
          {userProfile?.department && (
            <div className="glass" style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Department:</span>
              <span className="badge badge-neutral" style={{ fontWeight: 600 }}>{userProfile.department}</span>
            </div>
          )}
          {userProfile?.officeLocation && (
            <div className="glass" style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Office:</span>
              <span className="badge badge-neutral" style={{ fontWeight: 600 }}>📍 {userProfile.officeLocation}</span>
            </div>
          )}
        </div>
      </div>

      {/* Global Alert Messages */}
      {wfhAlert.text && (
        <div
          className={`badge ${wfhAlert.type === 'success' ? 'badge-success' : 'badge-danger'}`}
          style={{
            padding: '12px 16px',
            fontSize: 'var(--font-sm)',
            width: '100%',
            marginBottom: 'var(--space-md)',
            display: 'block',
          }}
        >
          {wfhAlert.type === 'success' ? '✅' : '⚠️'} {wfhAlert.text}
        </div>
      )}

      {/* Quick Actions & Status Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-xl)',
        }}
      >
        {/* Today's Status */}
        <div
          className="glass animate-fade-in-up"
          style={{
            padding: 'var(--space-lg)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: '160px',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
            Today's Status
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {todayStatus ? (
              <div className="flex flex-col gap-xs">
                <div className="flex items-center gap-sm">
                  <span
                    className={`badge ${
                      todayStatus.type === 'check-in' ? 'badge-success' : 'badge-warning'
                    }`}
                    style={{ fontSize: 'var(--font-sm)', padding: '6px 14px' }}
                  >
                    {todayStatus.type === 'check-in' ? '🟢 Checked In' : '🟡 Checked Out'}
                  </span>
                  <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                    {todayStatus.attendanceType === 'WFH' ? '🏠 WFH' : '🏢 Office'}
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', marginTop: '4px' }}>
                  At {todayStatus.time} ({todayStatus.record?.office || 'Checkpoint'})
                </div>
              </div>
            ) : (
              <span className="badge badge-neutral" style={{ fontSize: 'var(--font-sm)', padding: '6px 14px', alignSelf: 'flex-start' }}>
                ⚪ Not checked in yet
              </span>
            )}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: '12px' }}>
            {new Date().toLocaleDateString('en', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>

        {/* Quick Scan QR Card */}
        <div
          className="glass animate-fade-in-up"
          style={{
            padding: 'var(--space-lg)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 'var(--space-sm)',
            border: '1px dashed var(--border-accent)',
            animationDelay: '100ms',
            minHeight: '160px',
          }}
        >
          <div>
            <h4 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              🏢 Office Checkpoint
            </h4>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Scan the physical checkpoint QR code at your office location.
            </p>
          </div>
          <button
            onClick={() => navigate('/staff/scan')}
            className="btn btn-primary"
            style={{
              padding: '10px 16px',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(216, 0, 0, 0.3)',
              alignSelf: 'stretch',
            }}
          >
            <QrCode size={18} />
            Scan Office QR
          </button>
        </div>

        {/* Work From Home Card */}
        {eligibleForWFH && (
          <div
            className="glass animate-fade-in-up"
            style={{
              padding: 'var(--space-lg)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 'var(--space-sm)',
              border: wfhActiveRecord ? '1px solid var(--accent-success)' : '1px dashed var(--border-subtle)',
              animationDelay: '200ms',
              minHeight: '160px',
              background: wfhActiveRecord ? 'rgba(46, 213, 115, 0.05)' : 'transparent',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h4 style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {wfhActiveRecord ? '🏠 WFH Active' : '🏠 Work From Home'}
                </h4>
              </div>

              {wfhActiveRecord ? (
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                  <div style={{ color: 'var(--accent-success)', fontWeight: 600, marginBottom: '2px' }}>
                    Checked In at {todayStatus?.time}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    📍 {wfhActiveRecord.location?.addressName || 'Work From Home'}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Click below to check in remotely for Work From Home.
                </p>
              )}
            </div>

            <button
              onClick={handleWFHButtonClick}
              className={`btn ${wfhActiveRecord ? 'btn-secondary' : 'btn-primary'}`}
              disabled={wfhActionLoading}
              style={{
                padding: '10px 16px',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                alignSelf: 'stretch',
                backgroundColor: wfhActiveRecord ? 'var(--surface-2)' : undefined,
                color: wfhActiveRecord ? 'var(--accent-warning)' : undefined,
                borderColor: wfhActiveRecord ? 'var(--accent-warning)' : undefined,
              }}
            >
              {wfhActionLoading ? (
                <>⟳ Fetching Location...</>
              ) : wfhActiveRecord ? (
                <>🏠 WFH Active — Check Out</>
              ) : (
                <>🏠 Work From Home — Check In</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid-stats" style={{ marginBottom: 'var(--space-xl)' }}>
        <StatCard
          icon="⏱"
          label="Hours Today"
          value={stats.totalHoursToday}
          color="primary"
          delay={0}
        />
        <StatCard
          icon="📅"
          label="Days This Week"
          value={stats.thisWeek}
          color="secondary"
          delay={50}
        />
        <StatCard
          icon="⏳"
          label="Hours This Month"
          value={stats.totalHoursThisMonth}
          color="warning"
          delay={75}
        />
        <StatCard
          icon="📊"
          label="Days This Month"
          value={stats.thisMonth}
          color="accent"
          delay={100}
        />
      </div>

      {/* History */}
      <div>
        <h3 style={{ fontSize: 'var(--font-lg)', marginBottom: 'var(--space-md)' }}>
          🕐 Attendance History (Last 30 Days)
        </h3>
        <AttendanceTable records={records} showUser={false} pageSize={10} />
      </div>
    </div>
  );
}
