import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode } from 'lucide-react';
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
  const navigate = useNavigate();
  const [todayStatus, setTodayStatus] = useState(null);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ thisWeek: 0, thisMonth: 0, totalHoursToday: '—', totalHoursThisMonth: '—' });
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
      let allRecords = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Calculate daily hours for UI
      const dateRecordsMap = {};
      allRecords.forEach(r => {
        if (!dateRecordsMap[r.date]) dateRecordsMap[r.date] = { checkIns: [], checkOuts: [] };
        if (r.type === 'check-in') dateRecordsMap[r.date].checkIns.push(r);
        else if (r.type === 'check-out') dateRecordsMap[r.date].checkOuts.push(r);
      });

      const seenDate = new Set();
      allRecords = allRecords.map(r => {
        let dailyHours = '';
        if (!seenDate.has(r.date)) {
          seenDate.add(r.date);
          const dayInfo = dateRecordsMap[r.date];
          if (dayInfo.checkIns.length > 0 && dayInfo.checkOuts.length > 0) {
            const firstCheckIn = dayInfo.checkIns[dayInfo.checkIns.length - 1];
            const lastCheckOut = dayInfo.checkOuts[0];
            if (firstCheckIn.timestamp && lastCheckOut.timestamp) {
              const diffMs = (lastCheckOut.timestamp.seconds - firstCheckIn.timestamp.seconds) * 1000;
              const dHours = Math.floor(diffMs / 3600000);
              const dMinutes = Math.floor((diffMs % 3600000) / 60000);
              dailyHours = `${dHours}h ${dMinutes}m`;
            }
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
      const monthRecords = allRecords.filter((r) => r.date >= monthStart);

      const thisMonthDays = new Set(
        monthRecords
          .filter((r) => r.type === 'check-in')
          .map((r) => r.date)
      );

      let totalMsThisMonth = 0;
      const daysInMonth = Array.from(new Set(monthRecords.map(r => r.date)));
      
      daysInMonth.forEach(day => {
        const dayRecords = monthRecords.filter(r => r.date === day);
        const checkIns = dayRecords.filter(r => r.type === 'check-in');
        const checkOuts = dayRecords.filter(r => r.type === 'check-out');
        
        if (checkIns.length > 0 && checkOuts.length > 0) {
          const firstCheckIn = checkIns[checkIns.length - 1];
          const lastCheckOut = checkOuts[0];
          if (firstCheckIn.timestamp && lastCheckOut.timestamp) {
            const diffMs = (lastCheckOut.timestamp.seconds - firstCheckIn.timestamp.seconds) * 1000;
            totalMsThisMonth += diffMs;
          }
        }
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

      {/* Quick Actions & Status Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
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
            minHeight: '140px',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
            Today's Status
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
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
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-md)',
            border: '1px dashed var(--border-accent)',
            animationDelay: '100ms',
            minHeight: '140px',
          }}
        >
          <div>
            <h4 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Mark Your Attendance
            </h4>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', lineHeight: '1.4', maxWidth: '240px' }}>
              Scan the checkpoint QR code to record your check-in or check-out details.
            </p>
          </div>
          <button
            onClick={() => navigate('/staff/scan')}
            className="btn btn-primary"
            style={{
              padding: '12px 20px',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(216, 0, 0, 0.3)',
            }}
          >
            <QrCode size={18} />
            Scan QR
          </button>
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
