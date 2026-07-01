import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { buildStaticQRPayload } from '../../utils/qrTokenUtils';

export default function QRKiosk() {
  const navigate = useNavigate();
  const [offices, setOffices] = useState([]);
  const [selectedOffice, setSelectedOffice] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Office management state
  const [showManager, setShowManager] = useState(false);
  const [newOfficeName, setNewOfficeName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const containerRef = useRef(null);

  // Subscribe to offices list in Firestore
  useEffect(() => {
    const q = query(collection(db, 'offices'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const officeList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOffices(officeList);

      // Auto-populate default if empty
      if (officeList.length === 0 && !isSubmitting) {
        autoCreateDefaultOffice();
      } else if (officeList.length > 0 && !selectedOffice) {
        // Default to first office
        setSelectedOffice(officeList[0].name);
      }
    });

    return unsubscribe;
  }, [selectedOffice]);

  async function autoCreateDefaultOffice() {
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'offices'), {
        name: 'Main Office Premises',
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Error creating default office:', e);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Update QR payload when selection changes
  useEffect(() => {
    if (selectedOffice) {
      const payload = buildStaticQRPayload(selectedOffice);
      setQrPayload(payload);
    }
  }, [selectedOffice]);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Add new office
  async function handleAddOffice(e) {
    e.preventDefault();
    if (!newOfficeName.trim()) return;
    setIsSubmitting(true);

    try {
      // Check if duplicate
      if (offices.some((o) => o.name.toLowerCase() === newOfficeName.trim().toLowerCase())) {
        showToast('This office location already exists.', 'error');
        setIsSubmitting(false);
        return;
      }

      await addDoc(collection(db, 'offices'), {
        name: newOfficeName.trim(),
        createdAt: serverTimestamp(),
      });
      showToast('Office location added!', 'success');
      setSelectedOffice(newOfficeName.trim());
      setNewOfficeName('');
    } catch (error) {
      console.error('Error adding office:', error);
      showToast('Failed to add office.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Delete office
  async function handleDeleteOffice(id, name) {
    if (offices.length <= 1) {
      showToast('Must keep at least one office location.', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'offices', id));
      showToast('Office location removed.', 'info');
      if (selectedOffice === name) {
        setSelectedOffice(offices.find((o) => o.id !== id)?.name || '');
      }
    } catch (error) {
      console.error('Error deleting office:', error);
      showToast('Failed to remove office.', 'error');
    }
  }

  function showToast(message, type) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const timeStr = currentTime.toLocaleTimeString('en', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateStr = currentTime.toLocaleDateString('en', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="kiosk-container" ref={containerRef}>
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`} style={{ position: 'absolute', top: '20px', right: '20px' }}>
          {toast.message}
        </div>
      )}

      {/* Decorative patterns */}
      <div
        style={{
          position: 'fixed',
          top: '10%',
          left: '10%',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108,92,231,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
          animation: 'float 6s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: '10%',
          right: '10%',
          width: '250px',
          height: '250px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,206,201,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
          animation: 'float 8s ease-in-out infinite reverse',
        }}
      />

      {/* Controls Bar */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          display: 'flex',
          gap: '12px',
          zIndex: 10,
          background: 'rgba(10, 10, 26, 0.6)',
          padding: '8px 16px',
          borderRadius: 'var(--radius-md)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="input-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="kiosk-office-select" style={{ whiteSpace: 'nowrap', fontSize: 'var(--font-sm)' }}>Location:</label>
          <select
            id="kiosk-office-select"
            className="input"
            value={selectedOffice}
            onChange={(e) => setSelectedOffice(e.target.value)}
            style={{ padding: '6px 12px', fontSize: 'var(--font-xs)', width: '200px' }}
          >
            {offices.map((o) => (
              <option key={o.id} value={o.name}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowManager(!showManager)}
          id="manage-offices-btn"
        >
          ⚙️ Manage
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/admin')}
          id="kiosk-back-btn"
        >
          ← Back
        </button>
      </div>

      {/* Office Management Panel (Overlay Modal) */}
      {showManager && (
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
            zIndex: 1000,
          }}
          onClick={() => setShowManager(false)}
        >
          <div
            className="glass-strong animate-scale-in"
            style={{
              width: '100%',
              maxWidt: '440px',
              maxWidth: '440px',
              padding: 'var(--space-xl)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-md)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 style={{ fontSize: 'var(--font-lg)' }}>🏢 Office Locations</h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowManager(false)}
                style={{ fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            {/* Add form */}
            <form onSubmit={handleAddOffice} className="flex gap-sm">
              <input
                type="text"
                className="input"
                placeholder="e.g. Branch Office C"
                value={newOfficeName}
                onChange={(e) => setNewOfficeName(e.target.value)}
                maxLength={40}
                style={{ fontSize: 'var(--font-sm)', padding: '8px 12px' }}
                required
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>
                + Add
              </button>
            </form>

            {/* Office List */}
            <div
              style={{
                overflowY: 'auto',
                flex: 1,
                maxHeight: '40vh',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-sm)',
                background: 'var(--surface-1)',
              }}
            >
              {offices.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between"
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 'var(--font-sm)',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{o.name}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDeleteOffice(o.id, o.name)}
                    style={{ color: 'var(--accent-danger)' }}
                    title="Remove location"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Logo */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ fontSize: 'var(--font-3xl)', fontWeight: 800, letterSpacing: '-0.03em' }}>
          <span className="text-gradient">Attend</span>Ease
        </div>
        <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', marginTop: '4px' }}>
          Official Attendance Kiosk
        </div>
      </div>

      {/* Time */}
      <div className="kiosk-time">{timeStr}</div>
      <div className="kiosk-date">{dateStr}</div>

      {/* Selected Office Label */}
      <div
        style={{
          marginTop: 'var(--space-md)',
          padding: '6px 18px',
          background: 'rgba(108, 92, 231, 0.1)',
          border: '1px solid rgba(108, 92, 231, 0.2)',
          borderRadius: 'var(--radius-full)',
          fontSize: 'var(--font-sm)',
          fontWeight: 600,
          color: 'var(--accent-primary)',
        }}
      >
        📍 {selectedOffice || 'Loading Locations...'}
      </div>

      {/* QR Code */}
      <div className="kiosk-qr-wrapper animate-scale-in" key={qrPayload}>
        {qrPayload ? (
          <QRCodeSVG
            value={qrPayload}
            size={280}
            level="H"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#0a0a1a"
          />
        ) : (
          <div style={{ width: 280, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ animation: 'spin 0.8s linear infinite', fontSize: '2rem' }}>⟳</span>
          </div>
        )}
      </div>

      {/* Instruction */}
      <div className="kiosk-instruction" style={{ maxWidth: '450px', margin: 'var(--space-lg) auto 0' }}>
         Scan this QR code with your phone camera to check in or out. Your GPS location will be verified.
      </div>

      <div style={{ marginTop: 'var(--space-xl)', display: 'flex', gap: '24px', color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>
        <div>✓ Secure Geolocation Verification</div>
        <div>✓ {offices.length} Configured Locations</div>
      </div>
    </div>
  );
}
