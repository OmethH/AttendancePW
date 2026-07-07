import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Settings, ArrowLeft, MapPin, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Office management state
  const [showManager, setShowManager] = useState(false);
  const [newOfficeName, setNewOfficeName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const getQRCodePngDataUrl = (officeName) => {
    return new Promise((resolve) => {
      const svg = document.getElementById(`qr-svg-${officeName}`) || document.getElementById('kiosk-qr-svg');
      if (!svg) {
        resolve(null);
        return;
      }
      
      const svgString = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 512, 512);
        ctx.drawImage(img, 0, 0, 512, 512);
        URL.revokeObjectURL(svgUrl);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        resolve(null);
      };
      img.src = svgUrl;
    });
  };

  const getTemplateDataUrl = () => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = '/qr-template.png';
    });
  };

  const downloadQR = async (officeName) => {
    if (!officeName) return;
    showToast('Generating PDF...', 'info');
    
    try {
      const qrDataUrl = await getQRCodePngDataUrl(officeName);
      if (!qrDataUrl) {
        showToast('Failed to generate QR code.', 'error');
        return;
      }
      
      const templateDataUrl = await getTemplateDataUrl();
      if (!templateDataUrl) {
        showToast('Failed to load flyer template.', 'error');
        return;
      }
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      // Add flyer template as full-page background
      doc.addImage(templateDataUrl, 'PNG', 0, 0, 210, 297);
      
      // Mask the original "LOCATION" text inside the capsule badge
      doc.setFillColor(15, 15, 20); // matching the template's dark color
      doc.roundedRect(73, 76.5, 64, 9, 4, 4, 'F');
      
      // Write the actual office name inside the capsule
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(216, 0, 0); // brand red (#D80000)
      doc.text(officeName.toUpperCase(), 105, 82.5, { align: 'center' });
      
      // Mask the "QR CODE" placeholder text in the center
      doc.setFillColor(10, 10, 15); // dark black/blue
      doc.roundedRect(48, 96, 114, 114, 8, 8, 'F');
      
      // Draw the QR code inside the black square, centered with a nice 4mm border
      doc.addImage(qrDataUrl, 'PNG', 52, 100, 106, 106);
      
      // Save PDF
      doc.save(`PowerWorld_QR_${officeName.replace(/\s+/g, '_')}.pdf`);
      showToast('PDF downloaded!', 'success');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToast('Error generating PDF.', 'error');
    }
  };

  const downloadKioskQR = () => {
    if (selectedOffice) {
      downloadQR(selectedOffice);
    }
  };

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
        <div className="kiosk-dropdown" ref={dropdownRef}>
          <button
            type="button"
            className={`kiosk-dropdown-trigger${dropdownOpen ? ' open' : ''}`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            id="kiosk-office-select"
          >
            <MapPin size={14} className="kiosk-select-icon" />
            <span className="kiosk-dropdown-value">{selectedOffice || 'Select location…'}</span>
            <ChevronDown size={14} className="kiosk-select-chevron" />
          </button>
          {dropdownOpen && (
            <ul className="kiosk-dropdown-list">
              {offices.map((o, i) => (
                <li
                  key={o.id}
                  className={`kiosk-dropdown-item${selectedOffice === o.name ? ' active' : ''}`}
                  style={{ animationDelay: `${i * 25}ms` }}
                  onClick={() => {
                    setSelectedOffice(o.name);
                    setDropdownOpen(false);
                  }}
                >
                  <MapPin size={12} />
                  <span>{o.name}</span>
                  {selectedOffice === o.name && <span className="kiosk-dropdown-check">✓</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowManager(!showManager)}
          id="manage-offices-btn"
        >
          <Settings size={16} />
          Manage
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/admin')}
          id="kiosk-back-btn"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      {/* Logo */}
      <div style={{ marginBottom: 'var(--space-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img
          src="/logo.png"
          alt="Power World Logo"
          style={{
            maxWidth: '220px',
            width: '100%',
            height: 'auto',
            objectFit: 'contain',
          }}
        />
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Official Attendance 
        </div>
      </div>

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
      <div className="kiosk-qr-wrapper animate-scale-in" key={qrPayload} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        {qrPayload ? (
          <>
            <QRCodeSVG
              id="kiosk-qr-svg"
              value={qrPayload}
              size={280}
              level="H"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#0a0a1a"
              style={{ width: '280px', height: '280px', display: 'block' }}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={downloadKioskQR}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', border: '1px solid var(--border-default)' }}
            >
              📥 Download QR Code
            </button>
          </>
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

      {/* Office Management Panel (Overlay Modal) - Rendered at bottom of DOM for clean stacking hierarchy */}
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
            zIndex: 9999,
          }}
          onClick={() => setShowManager(false)}
        >
          <div
            className="glass-strong animate-scale-in"
            style={{
              width: '100%',
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
                maxHeight: '50vh',
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
                    padding: '12px 10px',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 'var(--font-sm)',
                    gap: 'var(--space-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <div style={{ width: '76px', height: '76px', minWidth: '76px', background: '#fff', padding: '6px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', flexShrink: 0 }}>
                      <QRCodeSVG
                        id={`qr-svg-${o.name}`}
                        value={buildStaticQRPayload(o.name)}
                        size={64}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#0a0a1a"
                        style={{ width: '64px', height: '64px', display: 'block' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, display: 'block', color: 'var(--text-primary)', marginBottom: '4px' }}>{o.name}</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => downloadQR(o.name)}
                        style={{ color: 'var(--accent-secondary)', fontSize: 'var(--font-xs)', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'underline' }}
                      >
                        📥 Download QR
                      </button>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDeleteOffice(o.id, o.name)}
                    style={{ color: 'var(--accent-danger)', padding: '6px 12px' }}
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
    </div>
  );
}
