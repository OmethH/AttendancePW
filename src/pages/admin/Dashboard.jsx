import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { formatDate } from '../../utils/qrTokenUtils';
import StatCard from '../../components/StatCard';
import AttendanceTable from '../../components/AttendanceTable';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStaff: 0,
    presentToday: 0,
    absentToday: 0,
    pendingApprovals: 0,
  });
  const [recentRecords, setRecentRecords] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      // Get all approved staff
      const staffQuery = query(
        collection(db, 'users'),
        where('role', '==', 'staff')
      );
      const staffSnap = await getDocs(staffQuery);
      const approvedStaff = staffSnap.docs.filter((d) => d.data().status === 'approved');
      const pendingStaff = staffSnap.docs.filter((d) => d.data().status === 'pending');

      // Get today's attendance
      const today = formatDate(new Date());
      const todayQuery = query(
        collection(db, 'attendance'),
        where('date', '==', today),
        where('type', '==', 'check-in')
      );
      const todaySnap = await getDocs(todayQuery);
      const uniquePresent = new Set(todaySnap.docs.map((d) => d.data().userId));

      setStats({
        totalStaff: approvedStaff.length,
        presentToday: uniquePresent.size,
        absentToday: Math.max(0, approvedStaff.length - uniquePresent.size),
        pendingApprovals: pendingStaff.length,
      });

      // Recent attendance records
      const recentQuery = query(
        collection(db, 'attendance'),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      const recentSnap = await getDocs(recentQuery);
      setRecentRecords(
        recentSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );

      // Weekly data for chart
      const weekData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = formatDate(date);
        const dayQuery = query(
          collection(db, 'attendance'),
          where('date', '==', dateStr),
          where('type', '==', 'check-in')
        );
        const daySnap = await getDocs(dayQuery);
        const uniqueUsers = new Set(daySnap.docs.map((d) => d.data().userId));
        weekData.push({
          day: date.toLocaleDateString('en', { weekday: 'short' }),
          date: dateStr,
          present: uniqueUsers.size,
        });
      }
      setWeeklyData(weekData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: 'var(--font-sm)',
          }}
        >
          <div style={{ fontWeight: 600 }}>{label}</div>
          <div style={{ color: 'var(--accent-primary)', marginTop: '4px' }}>
            {payload[0].value} staff present
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ animation: 'spin 0.8s linear infinite', fontSize: '2rem', marginBottom: '8px' }}>⟳</div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of staff attendance and activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid-stats" style={{ marginBottom: 'var(--space-xl)' }}>
        <StatCard
          icon="👥"
          label="Total Staff"
          value={stats.totalStaff}
          color="primary"
          delay={0}
          onClick={() => navigate('/admin/staff')}
        />
        <StatCard
          icon="✅"
          label="Present Today"
          value={stats.presentToday}
          color="success"
          delay={50}
          onClick={() => navigate('/admin/reports')}
        />
        <StatCard
          icon="❌"
          label="Absent Today"
          value={stats.absentToday}
          color="danger"
          delay={100}
          onClick={() => navigate('/admin/reports')}
        />
        <StatCard
          icon="⏳"
          label="Pending Approvals"
          value={stats.pendingApprovals}
          color="warning"
          delay={150}
          onClick={() => navigate('/admin/staff?status=pending')}
        />
      </div>

      {/* Chart & Recent Activity */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
        {/* Weekly Chart */}
        <div className="glass" style={{ padding: 'var(--space-lg)' }}>
          <h3 style={{ fontSize: 'var(--font-lg)', marginBottom: 'var(--space-md)' }}>
            Weekly Attendance Trend
          </h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6c5ce7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6c5ce7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="day"
                  stroke="rgba(255,255,255,0.3)"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.3)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="present"
                  stroke="#6c5ce7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPresent)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="glass" style={{ padding: 'var(--space-lg)' }}>
          <h3 style={{ fontSize: 'var(--font-lg)', marginBottom: 'var(--space-md)' }}>
            Quick Overview
          </h3>
          <div className="flex flex-col gap-md">
            <InfoRow
              label="Attendance Rate"
              value={
                stats.totalStaff > 0
                  ? `${Math.round((stats.presentToday / stats.totalStaff) * 100)}%`
                  : '0%'
              }
              color="var(--accent-success)"
            />
            <InfoRow
              label="Today's Date"
              value={new Date().toLocaleDateString('en', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              color="var(--text-primary)"
            />
            <InfoRow
              label="Latest Check-in"
              value={
                recentRecords.length > 0
                  ? `${recentRecords[0].userName} at ${
                      recentRecords[0].timestamp
                        ? new Date(recentRecords[0].timestamp.seconds * 1000).toLocaleTimeString()
                        : '—'
                    }`
                  : 'No activity today'
              }
              color="var(--accent-primary)"
            />
            <InfoRow
              label="Pending Approvals"
              value={stats.pendingApprovals > 0 ? `${stats.pendingApprovals} staff awaiting` : 'None'}
              color={stats.pendingApprovals > 0 ? 'var(--accent-warning)' : 'var(--accent-success)'}
            />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 style={{ fontSize: 'var(--font-lg)', marginBottom: 'var(--space-md)' }}>
           Recent Activity
        </h3>
        <AttendanceTable records={recentRecords} pageSize={8} />
      </div>
    </div>
  );
}

function InfoRow({ label, value, color }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        background: 'var(--surface-1)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color }}>
        {value}
      </div>
    </div>
  );
}
