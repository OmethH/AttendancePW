import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../firebase';
import AttendanceTable from '../../components/AttendanceTable';
import { exportToCSV } from '../../utils/exportUtils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Search } from 'lucide-react';    

const DEPARTMENTS = [
  { value: 'Finance', label: 'Finance' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'HR', label: 'Human Resources' },
  { value: 'Operations', label: 'Operations' },
  { value: 'IT', label: 'IT' },
  { value: 'Business', label: 'Business' },
  { value: 'Trainer', label: 'Trainer' },
];

export default function AttendanceReports() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: getDefaultStartDate(),
    endDate: formatDateForInput(new Date()),
    staffName: '',
    department: '',
    office: '',
  });
  const [offices, setOffices] = useState([]);
  const [chartData, setChartData] = useState({ daily: [], department: [] });

  useEffect(() => {
    fetchOffices();
    fetchRecords();
  }, []);

  function getDefaultStartDate() {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDateForInput(d);
  }

  function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
  }

  async function fetchOffices() {
    try {
      const snap = await getDocs(query(collection(db, 'offices'), orderBy('name', 'asc')));
      setOffices(snap.docs.map((d) => d.data().name));
    } catch (error) {
      console.error('Error fetching offices for reports:', error);
    }
  }

  async function fetchRecords() {
    setLoading(true);
    try {
      // Query attendance ordered by timestamp to avoid composite index requirement
      const q = query(
        collection(db, 'attendance'),
        orderBy('timestamp', 'desc')
      );

      const snap = await getDocs(q);
      let data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // 1. Start Date filter
      if (filters.startDate) {
        data = data.filter((r) => r.date >= filters.startDate);
      }

      // 2. End Date filter
      if (filters.endDate) {
        data = data.filter((r) => r.date <= filters.endDate);
      }

      // 3. Staff Name filter
      if (filters.staffName) {
        const qStr = filters.staffName.toLowerCase();
        data = data.filter((r) => r.userName?.toLowerCase().includes(qStr));
      }

      // 4. Department filter (cross-referenced from users)
      if (filters.department) {
        const usersSnap = await getDocs(collection(db, 'users'));
        const userDepts = {};
        usersSnap.forEach((doc) => {
          userDepts[doc.id] = doc.data().department;
        });
        data = data.filter((r) => userDepts[r.userId] === filters.department);
      }

      // 5. Office location filter
      if (filters.office) {
        data = data.filter((r) => r.office === filters.office);
      }

      // Pre-calculate hours per user per month
      const userDateRecords = {};
      snap.docs.forEach((d) => {
        const r = { id: d.id, ...d.data() };
        if (!r.userId || !r.date) return;
        if (!userDateRecords[r.userId]) userDateRecords[r.userId] = {};
        if (!userDateRecords[r.userId][r.date]) userDateRecords[r.userId][r.date] = { checkIns: [], checkOuts: [] };
        
        if (r.type === 'check-in') {
          userDateRecords[r.userId][r.date].checkIns.push(r);
        } else if (r.type === 'check-out') {
          userDateRecords[r.userId][r.date].checkOuts.push(r);
        }
      });

      const userMonthMs = {};
      for (const userId in userDateRecords) {
        userMonthMs[userId] = {};
        for (const dateStr in userDateRecords[userId]) {
           const monthStr = dateStr.slice(0, 7);
           const dayInfo = userDateRecords[userId][dateStr];
           if (dayInfo.checkIns.length > 0 && dayInfo.checkOuts.length > 0) {
             const firstCheckIn = dayInfo.checkIns[dayInfo.checkIns.length - 1]; // sorted desc
             const lastCheckOut = dayInfo.checkOuts[0];
             if (firstCheckIn.timestamp && lastCheckOut.timestamp) {
               const diffMs = (lastCheckOut.timestamp.seconds - firstCheckIn.timestamp.seconds) * 1000;
               dayInfo.diffMs = diffMs;
               if (!userMonthMs[userId][monthStr]) userMonthMs[userId][monthStr] = 0;
               userMonthMs[userId][monthStr] += diffMs;
             }
           }
        }
      }

      const seenUserDate = new Set();
      data = data.map(r => {
        const monthStr = r.date.slice(0, 7);
        const totalMs = userMonthMs[r.userId]?.[monthStr] || 0;
        const monthHours = Math.floor(totalMs / 3600000);
        const monthMinutes = Math.floor((totalMs % 3600000) / 60000);
        const formattedMonthHours = totalMs > 0 ? `${monthHours}h ${monthMinutes}m` : '0h 0m';
        
        let dailyHours = '';
        const userDateKey = `${r.userId}_${r.date}`;
        if (!seenUserDate.has(userDateKey)) {
           seenUserDate.add(userDateKey);
           const dayMs = userDateRecords[r.userId]?.[r.date]?.diffMs || 0;
           if (dayMs > 0) {
             const dHours = Math.floor(dayMs / 3600000);
             const dMinutes = Math.floor((dayMs % 3600000) / 60000);
             dailyHours = `${dHours}h ${dMinutes}m`;
           }
        }

        return { ...r, hoursThisMonth: formattedMonthHours, dailyHours };
      });

      setRecords(data);
      buildChartData(data);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  }

  function buildChartData(data) {
    // Daily count
    const dailyMap = {};
    data.forEach((r) => {
      if (r.type === 'check-in') {
        dailyMap[r.date] = (dailyMap[r.date] || 0) + 1;
      }
    });
    const daily = Object.entries(dailyMap)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        checkIns: count,
      }))
      .reverse();

    // Department breakdown
    const deptMap = {};
    const userDeptMap = {};
    data.forEach((r) => {
      if (!userDeptMap[r.userId]) {
        userDeptMap[r.userId] = 'Unknown';
      }
    });

    // We'll do a simpler approach: count unique users per type
    const typeCount = { 'check-in': 0, 'check-out': 0 };
    data.forEach((r) => {
      typeCount[r.type] = (typeCount[r.type] || 0) + 1;
    });
    const department = [
      { name: 'Check-ins', value: typeCount['check-in'], color: '#6c5ce7' },
      { name: 'Check-outs', value: typeCount['check-out'], color: '#00cec9' },
    ];

    setChartData({ daily, department });
  }

  function handleFilter(e) {
    e.preventDefault();
    fetchRecords();
  }

  function handleExportCSV() {
    exportToCSV(records, `attendance_${filters.startDate}_${filters.endDate}`);
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
            {payload[0].value} check-ins
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1>Attendance Reports</h1>
            <p>View and export attendance data with filters</p>
          </div>
          <div className="flex gap-sm">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleExportCSV}
              disabled={records.length === 0}
              id="export-csv-btn"
            >
              📄 Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter}>
        <div className="filters-bar glass" style={{ borderRadius: 'var(--radius-lg)' }}>
          <div className="input-group">
            <label htmlFor="filter-start">Start Date</label>
            <input
              id="filter-start"
              type="date"
              className="input"
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className="input-group">
            <label htmlFor="filter-end">End Date</label>
            <input
              id="filter-end"
              type="date"
              className="input"
              value={filters.endDate}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
          <div className="input-group">
            <label htmlFor="filter-staff">Staff Name</label>
            <input
              id="filter-staff"
              type="text"
              className="input"
              placeholder="Search by name..."
              value={filters.staffName}
              onChange={(e) => setFilters((f) => ({ ...f, staffName: e.target.value }))}
            />
          </div>
          <div className="input-group">
            <label htmlFor="filter-dept">Department</label>
            <select
              id="filter-dept"
              className="input"
              value={filters.department}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label htmlFor="filter-office">Office Location</label>
            <select
              id="filter-office"
              className="input"
              value={filters.office}
              onChange={(e) => setFilters((f) => ({ ...f, office: e.target.value }))}
            >
              <option value="">All Offices</option>
              {offices.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="input-group" style={{ justifyContent: 'flex-end' }}>
            <label>&nbsp;</label>
            <button type="submit" className="btn btn-primary" id="apply-filters-btn">
              <Search size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Apply Filters
            </button>
          </div>
        </div>
      </form>

      {/* Charts */}
      {records.length > 0 && (
        <div className="grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="glass" style={{ padding: 'var(--space-lg)' }}>
            <h3 style={{ fontSize: 'var(--font-lg)', marginBottom: 'var(--space-md)' }}>
               Daily Check-ins
            </h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={chartData.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.3)"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.3)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                  <Bar
                    dataKey="checkIns"
                    fill="#1eff00ff"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass" style={{ padding: 'var(--space-lg)' }}>
            <h3 style={{ fontSize: 'var(--font-lg)', marginBottom: 'var(--space-md)' }}>
              Check-in vs Check-out
            </h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData.department}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {chartData.department.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {records.length > 0 && (
        <div
          className="glass flex items-center justify-between"
          style={{
            padding: 'var(--space-md) var(--space-lg)',
            marginBottom: 'var(--space-lg)',
            fontSize: 'var(--font-sm)',
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{records.length}</strong> records
            from {filters.startDate} to {filters.endDate}
          </span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center p-xl">
          <div style={{ animation: 'spin 0.8s linear infinite', fontSize: '2rem' }}>⟳</div>
        </div>
      ) : (
        <AttendanceTable records={records} pageSize={15} />
      )}
    </div>
  );
}
