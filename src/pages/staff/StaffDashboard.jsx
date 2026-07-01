import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/qrTokenUtils';
import StatCard from '../../components/StatCard';
import AttendanceTable from '../../components/AttendanceTable';

export default function StaffDashboard() {
  const { currentUser, userProfile } = useAuth();
  const [todayStatus, setTodayStatus] = useState(null);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ thisWeek: 0, thisMonth: 0, totalHoursToday: '—' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchMyAttendance();
    }
  }, [currentUser]);

  async function fetchMyAttendance() {
    try {
      const today = formatDate(new Date());

      // Fetch all records for this user (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = formatDate(thirtyDaysAgo);

      const q = query(
        collection(db, 'attendance'),
        where('userId', '==', currentUser.uid),
        where('date', '>=', startDate),
        orderBy('date', 'desc'),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      const allRecords = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRecords(allRecords);

      // Today's status
      const todayRecords = allRecords.filter((r) => r.date === today);
      if (todayRecords.length > 0) {
        const lastRecord = todayRecords[0];
        setTodayStatus({
          type: lastRecord.type,
          time: lastRecord.timestamp
            ? new Date(lastRecord.timestamp.seconds * 1000).toLocaleTimeString()
            : '—',
          totalRecords: todayRecords.length,
        });

        // Calculate hours today
        const checkIns = todayRecords.filter((r) => r.type === 'check-in');
        const checkOuts = todayRecords.filter((r) => r.type === 'check-out');
        if (checkIns.length > 0 && checkOuts.length > 0) {
          const firstCheckIn = checkIns[checkIns.length - 1];
          const lastCheckOut = checkOuts[0];
          if (firstCheckIn.timestamp && lastCheckOut.timestamp) {
            const diffMs =
              (lastCheckOut.timestamp.seconds - firstCheckIn.timestamp.seconds) * 1000;
            const hours = Math.floor(diffMs / 3600000);
            const minutes = Math.floor((diffMs % 3600000) / 60000);
            setStats((prev) => ({
              ...prev,
              totalHoursToday: `${hours}h ${minutes}m`,
            }));
          }
        }
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
      const thisMonthDays = new Set(
        allRecords
          .filter((r) => r.date >= monthStart && r.type === 'check-in')
          .map((r) => r.date)
      );

      setStats((prev) => ({
        ...prev,
        thisWeek: thisWeekDays.size,
        thisMonth: thisMonthDays.size,
      }));
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
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
      <div className="page-header">
        <h1>Welcome, {userProfile?.displayName?.split(' ')[0] || 'Staff'} 👋</h1>
        <p>Your attendance summary and history</p>
      </div>

      {/* Today's Status */}
      <div
        className="glass animate-fade-in-up"
        style={{
          padding: 'var(--space-lg)',
          marginBottom: 'var(--space-xl)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
        }}
      >
        <div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
            Today's Status
          </div>
          {todayStatus ? (
            <div className="flex items-center gap-sm">
              <span
                className={`badge ${
                  todayStatus.type === 'check-in' ? 'badge-success' : 'badge-warning'
                }`}
                style={{ fontSize: 'var(--font-sm)', padding: '6px 14px' }}
              >
                {todayStatus.type === 'check-in' ? '🟢 Checked In' : '🟡 Checked Out'}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
                at {todayStatus.time}
              </span>
            </div>
          ) : (
            <span className="badge badge-neutral" style={{ fontSize: 'var(--font-sm)', padding: '6px 14px' }}>
              ⚪ Not checked in yet
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
            {new Date().toLocaleDateString('en', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
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
