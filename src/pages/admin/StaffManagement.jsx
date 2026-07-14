import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import app, { db } from '../../firebase';

export default function StaffManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') || 'all';

  const [staff, setStaff] = useState([]);
  const [filter, setFilter] = useState(statusParam);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [offices, setOffices] = useState([]);
  const [editingStaff, setEditingStaff] = useState(null);

  useEffect(() => {
    const status = searchParams.get('status') || 'all';
    setFilter(status);
  }, [searchParams]);

  useEffect(() => {
    fetchStaff();
    fetchOffices();
  }, []);

  async function fetchOffices() {
    try {
      const snap = await getDocs(query(collection(db, 'offices'), orderBy('name', 'asc')));
      setOffices(snap.docs.map((d) => d.data().name));
    } catch (error) {
      console.error('Error fetching offices:', error);
    }
  }

  async function fetchStaff() {
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'staff'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setStaff(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(uid) {
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'approved' });
      setStaff((prev) =>
        prev.map((s) => (s.uid === uid ? { ...s, status: 'approved' } : s))
      );
      showToast('Staff member approved successfully!', 'success');
    } catch (error) {
      console.error('Error approving staff:', error);
      showToast('Failed to approve staff member.', 'error');
    }
  }

  async function handleReject(uid) {
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'rejected' });
      setStaff((prev) =>
        prev.map((s) => (s.uid === uid ? { ...s, status: 'rejected' } : s))
      );
      showToast('Staff member rejected.', 'error');
    } catch (error) {
      console.error('Error rejecting staff:', error);
      showToast('Failed to reject staff member.', 'error');
    }
  }

  async function handleDelete(uid, name) {
    if (!window.confirm(`Are you sure you want to remove ${name}? This action cannot be undone.`)) {
      return;
    }
    try {
      // Delete user from Firebase Authentication first if credentials exist in Firestore
      const member = staff.find((s) => s.uid === uid);
      if (member && member.email && member.password) {
        try {
          const tempApp = initializeApp(app.options, 'tempDeleteApp');
          const tempAuth = getAuth(tempApp);
          const userCredential = await signInWithEmailAndPassword(tempAuth, member.email, member.password);
          await deleteUser(userCredential.user);
          await deleteApp(tempApp);
          console.log('Successfully deleted user from Firebase Auth');
        } catch (authError) {
          console.error('Failed to delete user from Firebase Auth:', authError);
        }
      }

      await deleteDoc(doc(db, 'users', uid));
      setStaff((prev) => prev.filter((s) => s.uid !== uid));
      showToast('Staff member removed.', 'info');
    } catch (error) {
      console.error('Error deleting staff:', error);
      showToast('Failed to remove staff member.', 'error');
    }
  }

  function handleStartEdit(member) {
    setEditingStaff({
      uid: member.uid,
      displayName: member.displayName || '',
      department: member.department || '',
      officeLocation: member.officeLocation || '',
      role: member.role || 'staff',
      status: member.status || 'pending',
    });
  }

  function handleEditChange(e) {
    const { name, value } = e.target;
    setEditingStaff((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      const { uid, displayName, department, officeLocation, role, status } = editingStaff;
      await updateDoc(doc(db, 'users', uid), {
        displayName,
        department,
        officeLocation,
        role,
        status,
      });

      setStaff((prev) =>
        prev.map((s) => (s.uid === uid ? { ...s, displayName, department, officeLocation, role, status } : s))
      );
      setEditingStaff(null);
      showToast('Staff member updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating staff member:', error);
      showToast('Failed to update staff member.', 'error');
    }
  }

  function showToast(message, type) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const filtered = staff.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.displayName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.department?.toLowerCase().includes(q) ||
        s.officeLocation?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusCounts = {
    all: staff.length,
    approved: staff.filter((s) => s.status === 'approved').length,
    pending: staff.filter((s) => s.status === 'pending').length,
    rejected: staff.filter((s) => s.status === 'rejected').length,
  };

  return (
    <div className="animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}

      <div className="page-header">
        <h1>Staff Management</h1>
        <p>Manage staff accounts and approval requests</p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-sm"
        style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}
      >
        {['all', 'pending', 'approved', 'rejected'].map((f) => (
          <button
            key={f}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setSearchParams({ status: f })}
            id={`filter-${f}-btn`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span
              style={{
                marginLeft: '6px',
                background: filter === f ? 'rgba(255,255,255,0.2)' : 'var(--surface-3)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-xs)',
              }}
            >
              {statusCounts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 'var(--space-lg)', maxWidth: '400px' }}>
        <input
          type="text"
          className="input"
          placeholder="Search by name, email, or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          id="staff-search-input"
        />
      </div>

      {/* Staff Table */}
      {loading ? (
        <div className="flex justify-center p-xl">
          <div style={{ animation: 'spin 0.8s linear infinite', fontSize: '2rem' }}>⟳</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state glass">
          <div className="empty-state-icon">👤</div>
          <p>No staff members found</p>
        </div>
      ) : (
        <div className="table-container glass">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Office Location</th>
                <th>Status</th>
                <th>Joined</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member, i) => (
                <tr
                  key={member.uid}
                  className="animate-fade-in"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <td>
                    <div className="flex items-center gap-sm">
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--gradient-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 'var(--font-xs)',
                          fontWeight: 700,
                          color: '#fff',
                          flexShrink: 0,
                        }}
                      >
                        {member.displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span style={{ fontWeight: 500 }}>{member.displayName}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{member.email}</td>
                  <td>
                    <span className="badge badge-neutral">{member.department || '—'}</span>
                  </td>
                  <td>
                    {member.officeLocation ? (
                      <span className="badge badge-neutral" style={{ opacity: 0.9 }}>
                        📍 {member.officeLocation}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        member.status === 'approved'
                          ? 'badge-success'
                          : member.status === 'pending'
                          ? 'badge-warning'
                          : 'badge-danger'
                      }`}
                    >
                      {member.status === 'approved' && '✓ '}
                      {member.status === 'pending' && '⏳ '}
                      {member.status === 'rejected' && '✕ '}
                      {member.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>
                    {member.createdAt
                      ? new Date(member.createdAt.seconds * 1000).toLocaleDateString()
                      : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex items-center justify-end gap-xs" style={{ justifyContent: 'flex-end' }}>
                      {member.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleApprove(member.uid)}
                            id={`approve-${member.uid}`}
                          >
                            ✓ Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleReject(member.uid)}
                            id={`reject-${member.uid}`}
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}
                      {member.status === 'rejected' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleApprove(member.uid)}
                        >
                          ✓ Approve
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleStartEdit(member)}
                        title="Edit staff details"
                        style={{ color: 'var(--text-secondary)' }}
                        id={`edit-${member.uid}`}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(member.uid, member.displayName)}
                        title="Remove staff member"
                        style={{ color: 'var(--accent-danger)' }}
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div
          style={{
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setEditingStaff(null)}
        >
          <div
            className="glass-strong animate-scale-in"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: 'var(--space-xl)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-md)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>✏️ Edit Staff Details</h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setEditingStaff(null)}
                style={{ fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label htmlFor="edit-name">Full Name</label>
                <input
                  id="edit-name"
                  type="text"
                  name="displayName"
                  className="input"
                  value={editingStaff.displayName}
                  onChange={handleEditChange}
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="edit-department">Department</label>
                <select
                  id="edit-department"
                  name="department"
                  className="input"
                  value={editingStaff.department}
                  onChange={handleEditChange}
                  required
                >
                  <option value="">Select department</option>
                  <option value="Finance">Finance</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="HR">Human Resources</option>
                  <option value="Operations">Operations</option>
                  <option value="IT">IT</option>
                  <option value="Business">Business</option>
                  <option value="Trainer">Trainer</option>
                </select>
              </div>

              <div className="input-group">
                <label htmlFor="edit-office">Office Location</label>
                <select
                  id="edit-office"
                  name="officeLocation"
                  className="input"
                  value={editingStaff.officeLocation}
                  onChange={handleEditChange}
                >
                  <option value="">None (Not Checked In)</option>
                  {offices.map((office) => (
                    <option key={office} value={office}>
                      {office}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label htmlFor="edit-role">Role</label>
                <select
                  id="edit-role"
                  name="role"
                  className="input"
                  value={editingStaff.role}
                  onChange={handleEditChange}
                  required
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="input-group">
                <label htmlFor="edit-status">Status</label>
                <select
                  id="edit-status"
                  name="status"
                  className="input"
                  value={editingStaff.status}
                  onChange={handleEditChange}
                  required
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="flex gap-sm justify-end" style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingStaff(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
