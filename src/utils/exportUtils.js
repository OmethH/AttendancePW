import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';

/**
 * Export attendance data to CSV and trigger download.
 * @param {Array} data - Array of attendance records
 * @param {string} filename - Output filename (without extension)
 */
export function exportToCSV(data, filename = 'attendance_report') {
  const csvData = data.map((record) => ({
    'Staff Name': record.userName || 'N/A',
    'Date': record.date || '',
    'Type': record.type || '',
    'Time': record.timestamp
      ? new Date(record.timestamp.seconds * 1000).toLocaleTimeString()
      : '',
    'Office Location': record.office || 'Main Office',
    'Latitude': record.location ? record.location.latitude : '',
    'Longitude': record.location ? record.location.longitude : '',
    'Daily Hours': record.dailyHours || '',
  }));

  const mainCsv = Papa.unparse(csvData);
  
  const summaryMap = {};
  data.forEach((record) => {
    const name = record.userName || 'N/A';
    if (!summaryMap[name]) {
      summaryMap[name] = record.hoursThisMonth || '0h 0m';
    }
  });

  const summaryData = Object.keys(summaryMap).map((name) => ({
    'Staff Name': name,
    'Hours This Month': summaryMap[name],
  }));

  const summaryCsv = Papa.unparse(summaryData);
  const finalCsv = `${mainCsv}\n\n\n=== MONTHLY HOURS SUMMARY ===\n\n${summaryCsv}`;

  const blob = new Blob([finalCsv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export attendance data to PDF and trigger download.
 * @param {Array} data - Array of attendance records
 * @param {string} filename - Output filename (without extension)
 * @param {object} filters - Applied filter info for the header
 */
export function exportToPDF(data, filename = 'attendance_report', filters = {}) {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.setTextColor(108, 92, 231);
  doc.text('AttendEase — Attendance Report', 14, 22);

  // Filter info
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  let yPos = 32;
  if (filters.dateRange) {
    doc.text(`Date Range: ${filters.dateRange}`, 14, yPos);
    yPos += 6;
  }
  if (filters.department) {
    doc.text(`Department: ${filters.department}`, 14, yPos);
    yPos += 6;
  }
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPos);
  yPos += 10;

  // Table
  const tableData = data.map((record) => [
    record.userName || 'N/A',
    record.date || '',
    record.type || '',
    record.timestamp
      ? new Date(record.timestamp.seconds * 1000).toLocaleTimeString()
      : '',
    record.office || 'Main Office',
    record.location ? `${record.location.latitude.toFixed(5)}, ${record.location.longitude.toFixed(5)}` : 'No GPS',
    record.dailyHours || ''
  ]);

  doc.autoTable({
    startY: yPos,
    head: [['Staff Name', 'Date', 'Type', 'Time', 'Office', 'Coordinates', 'Daily Hrs']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [108, 92, 231],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 255],
    },
  });

  doc.save(`${filename}.pdf`);
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
