import { useState, useEffect } from 'react';
import { getAllWFHRequests, updateWFHRequestStatus } from '../../utils/wfhUtils';
import { useAuth } from '../../contexts/AuthContext';
import StatCard from '../../components/StatCard';
import { Check, X, Search, RefreshCw } from 'lucide-react';

export default function WFHRequests() {
  const { currentUser, userProfile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING'); // 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    try {
      const data = await getAllWFHRequests();
      setRequests(data);
    } catch (error) {
      console.error('Error fetching WFH requests:', error);
      setMessage({ text: 'Failed to load WFH requests.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(requestId, newStatus) {
    setActionLoading(requestId);
    setMessage({ text: '', type: '' });
    try {
      const res = await updateWFHRequestStatus(
        requestId,
        newStatus,
        currentUser.uid,
        userProfile?.displayName || currentUser.email
      );

      if (res.success) {
        setMessage({
          text: `WFH Request successfully ${newStatus.toLowerCase()}!`,
          type: 'success',
        });
        await fetchRequests();
      } else {
        setMessage({ text: res.message || 'Failed to update request.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: err.message || 'Error performing action.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  }

  // Filter requests
  const filteredRequests = requests.filter((r) => {
    const matchesTab = activeTab === 'ALL' ? true : r.status === activeTab;
    const matchesSearch =
      (r.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.reason || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.requestDate || '').includes(searchTerm);
    return matchesTab && matchesSearch;
  });

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ animation: 'spin 0.8s linear infinite', fontSize: '2rem', marginBottom: '8px' }}>⟳</div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading WFH requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h1>🏠 Work From Home Requests</h1>
          <p>Manage and approve employee remote work requests</p>
        </div>
        <button
          onClick={fetchRequests}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {message.text && (
        <div
          className={`badge ${message.type === 'success' ? 'badge-success' : 'badge-danger'}`}
          style={{
            padding: '12px 16px',
            fontSize: 'var(--font-sm)',
            width: '100%',
            marginBottom: 'var(--space-md)',
            display: 'block',
          }}
        >
          {message.type === 'success' ? '✅' : '⚠️'} {message.text}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid-stats" style={{ marginBottom: 'var(--space-xl)' }}>
        <StatCard
          icon="⏳"
          label="Pending Approvals"
          value={pendingCount}
          color="warning"
          delay={0}
          onClick={() => setActiveTab('PENDING')}
        />
        <StatCard
          icon="✅"
          label="Approved Requests"
          value={approvedCount}
          color="success"
          delay={50}
          onClick={() => setActiveTab('APPROVED')}
        />
        <StatCard
          icon="❌"
          label="Rejected Requests"
          value={rejectedCount}
          color="danger"
          delay={100}
          onClick={() => setActiveTab('REJECTED')}
        />
        <StatCard
          icon="📊"
          label="Total Requests"
          value={requests.length}
          color="primary"
          delay={150}
          onClick={() => setActiveTab('ALL')}
        />
      </div>

      {/* Filter Tabs & Search */}
      <div
        className="glass"
        style={{
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
        }}
      >
        <div className="flex gap-xs" style={{ flexWrap: 'wrap' }}>
          {[
            { id: 'PENDING', label: `Pending (${pendingCount})` },
            { id: 'APPROVED', label: `Approved (${approvedCount})` },
            { id: 'REJECTED', label: `Rejected (${rejectedCount})` },
            { id: 'ALL', label: `All Requests (${requests.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 'var(--font-xs)', padding: '6px 14px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
            }}
          />
          <input
            type="text"
            className="input"
            placeholder="Search employee, dept..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '36px', fontSize: 'var(--font-xs)' }}
          />
        </div>
      </div>

      {/* Requests Table */}
      {filteredRequests.length === 0 ? (
        <div className="empty-state glass">
          <div className="empty-state-icon">🏠</div>
          <p>No WFH requests found for this filter.</p>
        </div>
      ) : (
        <div className="table-container glass">
          <table>
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Requested Date</th>
                <th>Reason</th>
                <th>Submitted On</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req, i) => (
                <tr key={req.id || i} className="animate-fade-in">
                  <td style={{ fontWeight: 600 }}>{req.userName}</td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                      {req.department || 'N/A'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                    📅 {req.requestDate}
                  </td>
                  <td style={{ maxWidth: '240px', color: 'var(--text-secondary)' }}>
                    {req.reason || <em style={{ color: 'var(--text-tertiary)' }}>No reason provided</em>}
                  </td>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>
                    {req.createdAt?.seconds
                      ? new Date(req.createdAt.seconds * 1000).toLocaleDateString()
                      : '—'}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        req.status === 'APPROVED'
                          ? 'badge-success'
                          : req.status === 'REJECTED'
                          ? 'badge-danger'
                          : 'badge-warning'
                      }`}
                    >
                      {req.status === 'APPROVED'
                        ? '✅ Approved'
                        : req.status === 'REJECTED'
                        ? '❌ Rejected'
                        : '⏳ Pending'}
                    </span>
                  </td>
                  <td>
                    {req.status === 'PENDING' ? (
                      <div className="flex gap-xs">
                        <button
                          className="btn btn-primary"
                          style={{
                            padding: '4px 10px',
                            fontSize: 'var(--font-xs)',
                            background: 'var(--accent-success)',
                            borderColor: 'var(--accent-success)',
                          }}
                          disabled={actionLoading === req.id}
                          onClick={() => handleStatusChange(req.id, 'APPROVED')}
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{
                            padding: '4px 10px',
                            fontSize: 'var(--font-xs)',
                            color: 'var(--accent-danger)',
                            borderColor: 'var(--accent-danger)',
                          }}
                          disabled={actionLoading === req.id}
                          onClick={() => handleStatusChange(req.id, 'REJECTED')}
                        >
                          <X size={14} /> Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                        {req.approvedByName ? `By ${req.approvedByName}` : 'Updated'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
