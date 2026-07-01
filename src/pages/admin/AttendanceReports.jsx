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
import { exportToCSV, exportToPDF } from '../../utils/exportUtils';
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
  const [departments, setDepartments] = useState([]);
  const [offices, setOffices] = useState([]);
  const [chartData, setChartData] = useState({ daily: [], department: [] });

  useEffect(() => {
    fetchDepartments();
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

  async function fetchDepartments() {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'staff')));
    const depts = [...new Set(snap.docs.map((d) => d.data().department).filter(Boolean))];
    setDepartments(depts);
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
      let q = query(
        collection(db, 'attendance'),
        where('date', '>=', filters.startDate),
        where('date', '<=', filters.endDate),
        orderBy('date', 'desc'),
        orderBy('timestamp', 'desc')
      );

      const snap = await getDocs(q);
      let data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Client-side filters
      if (filters.staffName) {
        const q = filters.staffName.toLowerCase();
        data = data.filter((r) => r.userName?.toLowerCase().includes(q));
      }

      // For department filter, we need to cross-reference users
      if (filters.department) {
        const usersSnap = await getDocs(
          query(collection(db, 'users'), where('department', '==', filters.department))
        );
        const userIds = new Set(usersSnap.docs.map((d) => d.id));
        data = data.filter((r) => userIds.has(r.userId));
      }

      // Office location filter
      if (filters.office) {
        data = data.filter((r) => r.office === filters.office);
      }

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

  function handleExportPDF() {
    exportToPDF(records, `attendance_${filters.startDate}_${filters.endDate}`, {
      dateRange: `${filters.startDate} to ${filters.endDate}`,
      department: filters.department || 'All',
    });
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
              className="btn btn-secondary btn-sm"
              onClick={handleExportCSV}
              disabled={records.length === 0}
              id="export-csv-btn"
            >
              📄 Export CSV
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleExportPDF}
              disabled={records.length === 0}
              id="export-pdf-btn"
            >
              📑 Export PDF
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
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
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
              🔍 Apply Filters
            </button>
          </div>
        </div>
      </form>

      {/* Charts */}
      {records.length > 0 && (
        <div className="grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="glass" style={{ padding: 'var(--space-lg)' }}>
            <h3 style={{ fontSize: 'var(--font-lg)', marginBottom: 'var(--space-md)' }}>
              📊 Daily Check-ins
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
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="checkIns"
                    fill="#6c5ce7"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass" style={{ padding: 'var(--space-lg)' }}>
            <h3 style={{ fontSize: 'var(--font-lg)', marginBottom: 'var(--space-md)' }}>
              🍩 Check-in vs Check-out
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
