import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../../contexts/AuthContext';
import { recordAttendanceWithLocation } from '../../utils/qrTokenUtils';

export default function ScanQR() {
  const [result, setResult] = useState(null); // { success, type, message }
  const [scanning, setScanning] = useState(true);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [userCoords, setUserCoords] = useState(null);
  
  const [searchParams] = useSearchParams();
  const { currentUser, userProfile } = useAuth();
  const scannerRef = useRef(null);
  const navigate = useNavigate();

  // Check if we came from a static QR link (with ?office=xxx)
  useEffect(() => {
    const office = searchParams.get('office');
    if (office && currentUser && userProfile) {
      handleAttendanceProcess(office);
    }
  }, [searchParams, currentUser, userProfile]);

  // Initialize camera scanner
  useEffect(() => {
    const office = searchParams.get('office');
    if (!scanning || office) return;

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        qrbox: { width: 280, height: 280 },
        fps: 10,
        aspectRatio: 1,
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear();
        handleScannedUrl(decodedText);
      },
      (error) => {
        // Ignore scanning errors during continuous scans
      }
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [scanning]);

  function handleScannedUrl(url) {
    try {
      const parsed = new URL(url);
      const office = parsed.searchParams.get('office');
      if (office) {
        handleAttendanceProcess(office);
      } else {
        setResult({
          success: false,
          type: null,
          message: 'Invalid QR code. This does not appear to be a valid AttendEase checkpoint QR code.',
        });
        setScanning(false);
      }
    } catch {
      setResult({
        success: false,
        type: null,
        message: 'Invalid QR code format.',
      });
      setScanning(false);
    }
  }

  // Get location and process attendance
  async function handleAttendanceProcess(officeName) {
    setScanning(false);
    setLoadingLocation(true);
    setLocationError('');
    setResult(null);

    // Request GPS location
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      processAttendance(officeName, null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setUserCoords(coords);
        setLoadingLocation(false);
        await processAttendance(officeName, coords);
      },
      async (error) => {
        console.error('Error getting geolocation:', error);
        let errorMsg = 'GPS location permission denied or unavailable. Recording attendance without coordinates.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location access was denied. Please enable GPS permissions and try again.';
          setLoadingLocation(false);
          setLocationError(errorMsg);
          setResult({
            success: false,
            type: null,
            message: 'Location access is required to check in. Please enable GPS permissions in your browser settings.',
          });
        } else {
          setLoadingLocation(false);
          setLocationError(errorMsg);
          await processAttendance(officeName, null);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  async function processAttendance(officeName, coords) {
    const res = await recordAttendanceWithLocation(
      officeName,
      currentUser.uid,
      userProfile.displayName || currentUser.email,
      coords
    );
    setResult(res);
  }

  function handleScanAgain() {
    setResult(null);
    setUserCoords(null);
    setLocationError('');
    setScanning(true);
    navigate('/staff/scan', { replace: true });
  }

  return (
    <div className="scanner-container">
      {/* Background patterns */}
      <div
        style={{
          position: 'fixed',
          top: '20%',
          right: '-5%',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108,92,231,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ textAlignment: 'center', marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, marginBottom: '4px' }}>
            <span className="text-gradient">Office</span> Attendance Checkpoint
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
            Point your camera at the office QR code or grant location permissions
          </p>
        </div>

        {/* Scanner View */}
        {scanning && !searchParams.get('office') && (
          <div className="animate-scale-in">
            <div className="scanner-wrapper">
              <div id="qr-reader" style={{ width: '100%' }} />
            </div>
            <p
              style={{
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 'var(--font-xs)',
                marginTop: 'var(--space-md)',
              }}
            >
              Make sure the office QR code is within the scanning area
            </p>
          </div>
        )}

        {/* Requesting Location */}
        {loadingLocation && (
          <div className="scanner-result glass-strong animate-scale-in" style={{ textAlign: 'center' }}>
            <div style={{ animation: 'spin 0.8s linear infinite', fontSize: '3rem', marginBottom: '16px' }}>
              🌍
            </div>
            <h3 style={{ fontSize: 'var(--font-lg)', marginBottom: '8px' }}>Retrieving GPS Location...</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
              We are fetching your current office coordinates to verify your attendance.
            </p>
          </div>
        )}

        {/* Result view */}
        {result && (
          <div
            className={`scanner-result glass-strong animate-scale-in ${
              result.success ? 'success' : 'error'
            }`}
            style={{ textAlign: 'center' }}
          >
            <div className="scanner-result-icon">
              {result.success ? (result.type === 'check-in' ? '🟢' : '🟡') : '🔴'}
            </div>
            <h2
              style={{
                fontSize: 'var(--font-2xl)',
                marginBottom: 'var(--space-sm)',
                color: result.success ? 'var(--accent-success)' : 'var(--accent-danger)',
              }}
            >
              {result.success
                ? result.type === 'check-in'
                  ? 'Checked In!'
                  : 'Checked Out!'
                : 'Check Failed'}
            </h2>
            <p
              style={{
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-md)',
                fontSize: 'var(--font-base)',
                fontWeight: 500,
              }}
            >
              {result.message}
            </p>

            {userCoords && result.success && (
              <div
                style={{
                  padding: '12px',
                  background: 'var(--surface-1)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--font-xs)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-lg)',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  📍 Verified Coordinates:
                </div>
                <div>Latitude: {userCoords.latitude.toFixed(6)}</div>
                <div>Longitude: {userCoords.longitude.toFixed(6)}</div>
                <div>Accuracy: ±{Math.round(userCoords.accuracy)} meters</div>
              </div>
            )}

            {locationError && !userCoords && (
              <div
                style={{
                  fontSize: 'var(--font-xs)',
                  color: 'var(--accent-warning)',
                  marginBottom: 'var(--space-lg)',
                }}
              >
                ⚠️ {locationError}
              </div>
            )}

            <div
              style={{
                fontSize: 'var(--font-xs)',
                color: 'var(--text-tertiary)',
                marginBottom: 'var(--space-lg)',
              }}
            >
              {new Date().toLocaleString()}
            </div>

            <div className="flex gap-sm justify-center" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={handleScanAgain}
                id="scan-again-btn"
              >
                📷 Scan Again
              </button>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/staff')}
                id="go-dashboard-btn"
              >
                📊 My Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
