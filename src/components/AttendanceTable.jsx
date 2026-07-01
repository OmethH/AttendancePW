import { useState } from 'react';

export default function AttendanceTable({ records, showUser = true, pageSize = 10 }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');

  // Sort
  const sorted = [...records].sort((a, b) => {
    let valA, valB;
    if (sortField === 'timestamp') {
      valA = a.timestamp?.seconds || 0;
      valB = b.timestamp?.seconds || 0;
    } else {
      valA = (a[sortField] || '').toLowerCase();
      valB = (b[sortField] || '').toLowerCase();
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate
  const totalPages = Math.ceil(sorted.length / pageSize);
  const start = (currentPage - 1) * pageSize;
  const paginated = sorted.slice(start, start + pageSize);

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
  }

  function SortIcon({ field }) {
    if (sortField !== field) return <span style={{ opacity: 0.3 }}>↕</span>;
    return <span>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  if (records.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📭</div>
        <p>No attendance records found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="table-container glass">
        <table>
          <thead>
            <tr>
              {showUser && (
                <th
                  onClick={() => handleSort('userName')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Staff Name <SortIcon field="userName" />
                </th>
              )}
              <th
                onClick={() => handleSort('date')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                Date <SortIcon field="date" />
              </th>
              <th
                onClick={() => handleSort('type')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                Type <SortIcon field="type" />
              </th>
              <th
                onClick={() => handleSort('timestamp')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                Time <SortIcon field="timestamp" />
              </th>
              <th>Office</th>
              <th>GPS Location</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((record, i) => (
              <tr key={record.id || i} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                {showUser && (
                  <td style={{ fontWeight: 500 }}>{record.userName || 'N/A'}</td>
                )}
                <td>{record.date}</td>
                <td>
                  <span className={`badge ${record.type === 'check-in' ? 'badge-success' : 'badge-warning'}`}>
                    {record.type === 'check-in' ? '↓ Check In' : '↑ Check Out'}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>
                  {record.timestamp
                    ? new Date(record.timestamp.seconds * 1000).toLocaleTimeString()
                    : '—'}
                </td>
                <td>{record.office || 'Main Office'}</td>
                <td>
                  {record.location ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${record.location.latitude},${record.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 8px', fontSize: 'var(--font-xs)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      🌍 View on Map
                    </a>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>No GPS</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ‹
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let page;
            if (totalPages <= 7) {
              page = i + 1;
            } else if (currentPage <= 4) {
              page = i + 1;
            } else if (currentPage >= totalPages - 3) {
              page = totalPages - 6 + i;
            } else {
              page = currentPage - 3 + i;
            }
            return (
              <button
                key={page}
                className={currentPage === page ? 'active' : ''}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            );
          })}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            ›
          </button>
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>
        Showing {start + 1}–{Math.min(start + pageSize, records.length)} of {records.length} records
      </div>
    </div>
  );
}
