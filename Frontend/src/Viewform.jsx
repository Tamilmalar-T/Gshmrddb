import { useState, useEffect } from 'react';
import { Row, Col } from 'react-bootstrap';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Viewform.css';

function Viewform({ records, onDeleteRecord, onEditRecord, onExportClick }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null); // Patient detail card modal
  const [filterCategory, setFilterCategory] = useState('Gender');
  const [filterValue, setFilterValue] = useState('All');
  const [isEditing, setIsEditing] = useState(false);
  const [newFiles, setNewFiles] = useState([]);
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const formatDateToDDMMYYYY = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  const formatDateTimeToDDMMYYYY = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      let hours = date.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const hoursStr = String(hours).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm}`;
    } catch (e) {
      return 'N/A';
    }
  };

  const AGE_RANGES = [
    { label: 'All Ages', value: 'All' },
    { label: '0 – 1', value: '0-1' },
    { label: '0 – 5', value: '0-5' },
    { label: '6 – 18', value: '6-18' },
    { label: '18 above', value: '18+' },
    { label: '60 above', value: '60+' },
   
  ];

  const allTypes = ['All', ...Array.from(new Set(records.map(r => r.recordType).filter(Boolean)))];

  // Fixed colors for known types; fallback palette for any other
  const NAMED_TYPE_COLORS = {
    'MLC Patient': { bg: '#ede9fe', color: '#ed0909ff', border: '#a78bfa' },  // violet
    'Birth': { bg: '#fef9c3', color: '#713f12', border: '#ca8a04' },  // dark yellow
    'Death': { bg: '#fff7ed', color: '#9a3412', border: '#f97316' },  // orange
    'Medical Advice': { bg: '#dcfce7', color: '#14532d', border: '#16a34a' },  // dark green
  };
  const FALLBACK_PALETTE = [
    { bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd' },  // blue
    { bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4' },  // pink
    { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' },  // sky
    { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },  // red
    { bg: '#f0fdf4', color: '#166534', border: '#86efac' },  // lime
  ];
  const fallbackMap = {};
  let fallbackIdx = 0;
  allTypes.filter(t => t !== 'All' && !NAMED_TYPE_COLORS[t]).forEach(t => {
    fallbackMap[t] = FALLBACK_PALETTE[fallbackIdx++ % FALLBACK_PALETTE.length];
  });
  const getTypeStyle = (type) =>
    NAMED_TYPE_COLORS[type] || fallbackMap[type] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };

  // Filter records based on search and dynamic category
  const filteredRecords = records.filter((rec) => {
    const matchesSearch =
      (rec.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.ipNo || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    let matchesCategory = true;
    if (filterValue !== 'All') {
      if (filterCategory === 'Gender') {
        matchesCategory = rec.gender === filterValue;
      } else if (filterCategory === 'Type') {
        matchesCategory = rec.recordType === filterValue;
      } else if (filterCategory === 'Age') {
        const [min, max] = filterValue.split('-').map(Number);
        const a = Number(rec.age);
        matchesCategory = a >= min && a <= max;
      }
    }
    
    return matchesSearch && matchesCategory;
  });


  const handleExportPDF = () => {
    if (filteredRecords.length === 0) {
      alert('No logs found to export.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(18);
    doc.text('GURU SHREE', 14, 15);
    doc.setFontSize(12);
    doc.text('Clinical Patient Records Database Report', 14, 22);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}  |  Records: ${groupedRecords.length}`, 14, 28);

    autoTable(doc, {
      startY: 33,
      head: [['IP No', 'Patient Name', 'Age', 'Date', 'Type', 'Gender', 'Created By']],
      body: filteredRecords.map((r) => [
        r.ipNo || '', r.name || '', r.age || '', formatDateToDDMMYYYY(r.date), r.recordType || '', r.gender || '', r.createdBy || 'System',
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    doc.save(`patient_records_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      alert('No logs found to export.');
      return;
    }
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8" /><style>table { border-collapse: collapse; } th, td { border: 1px solid #cbd5e1; padding: 8px; }</style></head>
      <body>
        <h3>Guru Shree MRD - Patient Submissions Log</h3>
        <table>
          <thead><tr><th>IP Number</th><th>Patient Name</th><th>Age</th><th>Date</th><th>Type</th><th>Gender</th><th>Created By</th></tr></thead>
          <tbody>
            ${filteredRecords.map(r => `<tr><td>${r.ipNo || ''}</td><td>${r.name || ''}</td><td>${r.age || ''}</td><td>${r.date || ''}</td><td>${r.recordType || ''}</td><td>${r.gender || ''}</td><td>${r.createdBy || 'System'}</td></tr>`).join('')}
          </tbody>
        </table>
      </body></html>
    `;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `patient_records_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAction = (e) => {
    const action = e.target.value;
    if (action === 'pdf') handleExportPDF();
    if (action === 'excel') handleExportExcel();
    if (action === 'print') window.print();
    e.target.value = ''; // reset dropdown
  };

  const groupedRecordsMap = new Map();
  filteredRecords.forEach(record => {
    const key = `${record.ipNo}_${record.name}_${record.date}_${record.recordType}`;
    if (!groupedRecordsMap.has(key)) {
      groupedRecordsMap.set(key, {
        ...record,
        files: [record],
      });
    } else {
      const group = groupedRecordsMap.get(key);
      group.files.push(record);

      const currentLatest = new Date(group.updatedAt || group.createdAt).getTime();
      const recordLatest = new Date(record.updatedAt || record.createdAt).getTime();
      if (recordLatest > currentLatest) {
        group.updatedAt = record.updatedAt || record.createdAt;
      }
    }
  });
  const groupedRecords = Array.from(groupedRecordsMap.values());

  // Show only 20 items by default. If searching or filtering, show all matching items.
  const displayedRecords = (searchTerm.trim() || filterValue !== 'All')
    ? groupedRecords
    : groupedRecords.slice(0, 20);

  // Action helper to view files
  const handleViewFile = (record) => {
    if (record.fileUrl && record.fileUrl.startsWith('http')) {
      let finalUrl = record.fileUrl;
      // If it is a Google Drive url, we can change uc?id= to open in Google Drive's viewer
      if (finalUrl.includes('drive.google.com/uc?id=')) {
        const match = finalUrl.match(/id=([^&]+)/);
        if (match && match[1]) {
          finalUrl = `https://drive.google.com/file/d/${match[1]}/view`;
        }
      }
      window.open(finalUrl, '_blank');
      return;
    }

    if (!record.fileData || record.fileData.includes('...')) {
      alert("Note: This is a placeholder record file. Newly uploaded files are fully viewable!");
      return;
    }

    try {
      const mime = record.fileData.split(';')[0].split(':')[1];
      const base64Data = record.fileData.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (e) {
      console.error("Failed to parse base64 file data for viewing", e);
      alert("Could not open file preview.");
    }
  };

  // Action helper to download files locally (since we converted to base64)
  const handleDownloadFile = async (record) => {
    if (record.fileUrl && record.fileUrl.startsWith('http')) {
      let finalUrl = record.fileUrl;
      // Force Google Drive links to download instead of opening in a viewer
      if (finalUrl.includes('drive.google.com/uc?id=')) {
        if (!finalUrl.includes('export=download')) {
          finalUrl = finalUrl.replace('uc?id=', 'uc?export=download&id=');
        }
        window.open(finalUrl, '_blank');
        return;
      }

      try {
        // Fetch to handle cross-origin download properly
        const response = await fetch(finalUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = record.fileName || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error("Failed to download via fetch, falling back to new window/tab", error);
        window.open(finalUrl, '_blank');
      }
      return;
    }
    if (!record.fileData || record.fileData.includes('...')) {
      alert("Note: This is a placeholder record file. Newly uploaded files are fully downloadable!");
      return;
    }
    try {
      const mime = record.fileData.split(';')[0].split(':')[1];
      const base64Data = record.fileData.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = record.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Failed to download base64 file", e);
      alert("Could not download file.");
    }
  };

  const handleSaveEdit = async () => {
    if (newFiles.length === 0 && filesToDelete.length === 0) {
      alert("No changes made. Please add new files or remove existing ones.");
      return;
    }

    setIsUploading(true);
    let success = true;

    try {
      if (newFiles.length > 0) {
        const filesArray = Array.from(newFiles);
        const deletingAll = filesToDelete.length === selectedRecord.files.length;

        const baseFile = selectedRecord.files[0];
        const baseId = baseFile.id || baseFile._id;

        let editId = baseId;
        let keepOrig = true;

        if (deletingAll) {
          keepOrig = false;
        } else {
          const keptFile = selectedRecord.files.find(f => !filesToDelete.includes(f.id || f._id));
          editId = keptFile.id || keptFile._id;
        }

        const editSuccess = await onEditRecord(editId, filesArray, keepOrig);
        if (!editSuccess) {
          success = false;
        } else {
          const idsToDelete = deletingAll ? filesToDelete.filter(id => id !== baseId) : filesToDelete;
          for (const id of idsToDelete) {
            await onDeleteRecord(id);
          }
        }

      } else {
        for (const id of filesToDelete) {
          await onDeleteRecord(id);
        }
      }
    } catch (e) {
      console.error(e);
      success = false;
      alert(`Error saving changes: ${e.message || 'Unknown error'}`);
    }

    setIsUploading(false);
    if (success) {
      alert("Attachment(s) updated successfully!");
      handleCloseModal();
    }
  };

  const handleCloseModal = () => {
    setSelectedRecord(null);
    setIsEditing(false);
    setNewFiles([]);
    setFilesToDelete([]);
    setKeepOriginal(false);
  };
  return (
    <div className="animate-fade-in">
      <div className="view-card-header">
        <div>
          <h2>Patient Submissions Log</h2>
          <p>Real-time database of intake records. Search, manage, and verify submissions.</p>
        </div>
      </div>

      {/* Control Panel: Search & Filters */}
      <div className="controls-panel">
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search by patient name or IP Number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>&times;</button>
          )}
        </div>

        <div className="filter-dropdown">
          <label htmlFor="filter-category" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Filter By:</label>
          <select
            id="filter-category"
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setFilterValue('All');
            }}
            className="custom-select"
            style={{ width: '120px' }}
          >
            <option value="Gender">Gender</option>
            <option value="Age">Age</option>
            <option value="Type">Type</option>
          </select>

          <select
            id="filter-value"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="custom-select"
            style={{ minWidth: '140px' }}
          >
            {filterCategory === 'Gender' && (
              <>
                <option value="All">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </>
            )}
            {filterCategory === 'Age' && (
              AGE_RANGES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))
            )}
            {filterCategory === 'Type' && (
              allTypes.map(t => (
                <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>
              ))
            )}
          </select>
        </div>

        <div className="filter-dropdown">
          <label htmlFor="export-dropdown">Export:</label>
          <select
            id="export-dropdown"
            className="custom-select"
            style={{ background: '#f8fafc', borderColor: '#cbd5e1', fontWeight: 'bold' }}
            onChange={handleExportAction}
            defaultValue=""
          >
            <option value="" disabled>Select Format...</option>
            <option value="pdf">📄 PDF Document</option>
            <option value="excel">📊 Excel Spreadsheet</option>
            <option value="print">🖨️ Print Records</option>
          </select>
        </div>
      </div>
      {/* Main Records Presentation */}
      {groupedRecords.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-5.586a1 1 0 00-.707.293l-1.414 1.414a1 1 0 01-.707.293H8.707A1 1 0 018 17.707L6.586 16.293A1 1 0 005.879 16H4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3>No Records Found</h3>
          <p>
            {records.length === 0
              ? "The clinical logging system is currently empty. Get started by filing an intake form!"
              : "No logs matched your current filters or search query."}
          </p>
        </div>
      ) : (
        <>
          <div className="table-responsive-wrapper desktop-only">
            <table className="submissions-table">
              <thead>
                <tr>
                  <th>IP No</th>
                  <th>Patient Name</th>
                  <th>Age</th>
                  <th> Date</th>
                  <th>type</th>
                  <th>Gender</th>

                  <th>Created By / On</th>
                  <th>Updated By / On</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedRecords.map((group) => (
                  <tr key={group.id || group._id} className="record-row" style={groupedRecords.filter(r => r.ipNo === group.ipNo).length > 1 ? { borderLeft: '4px solid #ef4444' } : {}}>

                    {/* IP column */}
                    <td>
                      <code className="ip-badge">{group.ipNo}</code>
                      {groupedRecords.filter(r => r.ipNo === group.ipNo).length > 1 && (
                        <span style={{
                          color: '#ef4444',
                          fontSize: '10px',
                          fontWeight: '700',
                          display: 'block',
                          marginTop: '4px',
                          background: '#fee2e2',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          width: 'fit-content'
                        }}>
                          Already Exists
                        </span>
                      )}
                    </td>

                    {/* Name column */}
                    <td className="font-semibold">
                      <div className="text-primary-cell">
                        {/* <div className="avatar-placeholder">
                        {group.name.charAt(0).toUpperCase()}
                      </div> */}
                        {group.name}
                      </div>
                    </td>


                    {/* Age column */}
                    <td>{group.age} </td>

                    {/* Date column */}
                    <td>{formatDateToDDMMYYYY(group.date)}</td>

                    {/* Type column */}
                    <td>
                      {(() => {
                        const ts = getTypeStyle(group.recordType);
                        return (
                          <span style={{
                            background: ts.bg,
                            color: ts.color,
                            border: `1px solid ${ts.border}`,
                            borderRadius: 20,
                            padding: '3px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}>
                            {group.recordType || 'N/A'}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Gender column */}
                    <td>
                      <span className={`gender-tag ${(group.gender || '').toLowerCase()}`}>
                        {group.gender}
                      </span>
                    </td>



                    {/* Created By / On column */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '13px', color: '#4f46e5', fontWeight: 'bold' }}>
                          {group.createdBy || 'System'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {group.createdAt ? formatDateTimeToDDMMYYYY(group.createdAt) : 'N/A'}
                        </span>
                      </div>
                    </td>

                    {/* Updated By / On column */}
                    <td>
                      {group.updatedBy ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 'bold' }}>
                            {group.updatedBy}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {group.updatedAt ? formatDateTimeToDDMMYYYY(group.updatedAt) : ''}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '13px', color: '#cbd5e1' }}>—</span>
                      )}
                    </td>

                    {/* Actions column */}
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="table-actions">
                        <button
                          className="action-icon-btn view-btn"
                          onClick={() => setSelectedRecord(group)}
                          title="View Full Profile Card"
                        >
                          👁️
                        </button>
                        <button
                          className="action-icon-btn edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecord(group);
                            setIsEditing(true);
                          }}
                          title="Edit Record"
                        >
                          ✏️
                        </button>
                        <button
                          className="action-icon-btn delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete ${group.files.length} record(s) for this patient?`)) {
                              group.files.forEach(f => {
                                onDeleteRecord(f.id || f._id);
                              });
                            }
                          }}
                          title="Delete Record"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile-only Premium Card Grid */}
          <div className="mobile-cards-wrapper mobile-only">
            {displayedRecords.map((group) => (
              <div key={group.id || group._id} className="mobile-record-card" style={groupedRecords.filter(r => r.ipNo === group.ipNo).length > 1 ? { borderLeft: '4px solid #ef4444' } : {}}>
                <div className="card-header-row">
                  <div className="patient-avatar-name">
                    <div className="avatar-placeholder">
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="patient-name-ip">
                      <span className="patient-name">{group.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <code className="ip-badge">{group.ipNo}</code>
                        {groupedRecords.filter(r => r.ipNo === group.ipNo).length > 1 && (
                          <span style={{
                            color: '#ef4444',
                            fontSize: '9px',
                            fontWeight: '700',
                            background: '#fee2e2',
                            padding: '1px 5px',
                            borderRadius: '3px'
                          }}>
                            Already Exists
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`gender-tag ${(group.gender || '').toLowerCase()}`}>
                    {group.gender}
                  </span>
                </div>

                <div className="card-body-details">
                  <div className="detail-item">
                    <span className="detail-label">Age</span>
                    <span className="detail-value">{group.age} yrs</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Date</span>
                    <span className="detail-value">{formatDateToDDMMYYYY(group.date)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">type</span>
                    <span className="detail-value text-badge">{group.recordType || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Created By</span>
                    <span className="detail-value" style={{ color: '#4f46e5', fontWeight: 'bold', fontSize: '13px' }}>{group.createdBy || 'System'}</span>
                  </div>
                  {group.updatedBy && (
                    <div className="detail-item">
                      <span className="detail-label">Updated By</span>
                      <span className="detail-value" style={{ color: '#10b981', fontWeight: 'bold', fontSize: '13px' }}>{group.updatedBy}</span>
                    </div>
                  )}
                </div>

                <div className="card-files-section" onClick={(e) => e.stopPropagation()}>
                  <span className="section-label">Attachments ({group.files.length}):</span>
                  <div className="files-container">
                    {group.files.map((fileRecord, index) => (
                      <button
                        key={index}
                        className="file-link-btn"
                        onClick={() => handleDownloadFile(fileRecord)}
                        title={`Download ${fileRecord.fileName} (${fileRecord.fileSize})`}
                      >
                        <svg className="file-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="file-name-truncate">{fileRecord.fileName}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card-actions-row" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="mobile-action-btn view-btn"
                    onClick={() => setSelectedRecord(group)}
                  >
                    👁️ View Profile
                  </button>

                  <button
                    className="mobile-action-btn delete-btn"
                    onClick={() => {
                      if (window.confirm(`Delete ${group.files.length} record(s) for this patient?`)) {
                        group.files.forEach(f => {
                          onDeleteRecord(f.id || f._id);
                        });
                      }
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Patient Detail Modal */}
      {selectedRecord && (
        <div className="modal-backdrop animate-fade-in" onClick={handleCloseModal}>
          <div className="patient-card-modal animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCloseModal}>&times;</button>

            <div className="patient-card-header">
              <div className="avatar-large">
                {selectedRecord.name.charAt(0).toUpperCase()}
              </div>
              <div className="patient-header-details">
                <h3>{selectedRecord.name}</h3>

              </div>
            </div>

            <Row className="patient-card-grid g-2 mb-2">
              <Col xs={12} sm={6} md={4} className="grid-item">
                <span className="grid-label">IP No</span>
                <code className="grid-value ip-code">{selectedRecord.ipNo}</code>
                {groupedRecords.filter(r => r.ipNo === selectedRecord.ipNo).length > 1 && (
                  <span style={{
                    color: '#ef4444',
                    fontSize: '10px',
                    fontWeight: '700',
                    background: '#fee2e2',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: 'inline-block',
                    marginTop: '4px'
                  }}>
                    Already Exists
                  </span>
                )}
              </Col>
              <Col xs={12} sm={6} md={4} className="grid-item">
                <span className="grid-label">Age</span>
                <span className="grid-value">{selectedRecord.age} Years Old</span>
              </Col>
              <Col xs={12} sm={6} md={4} className="grid-item">
                <span className="grid-label">Discharge</span>
                <span className="grid-value">{formatDateToDDMMYYYY(selectedRecord.date)}</span>
              </Col>
              <Col xs={12} sm={6} md={4} className="grid-item">
                <span className="grid-label">Gender</span>
                <span className={`gender-tag ${(selectedRecord.gender || '').toLowerCase()} large`}>
                  {selectedRecord.gender}
                </span>
              </Col>
              <Col xs={12} sm={6} md={4} className="grid-item">
                <span className="grid-label">type</span>
                <span className="grid-value" style={{ textTransform: 'capitalize' }}>
                  {selectedRecord.recordType || 'Uncategorized'}
                </span>
              </Col>
              <Col xs={12} sm={6} md={4} className="grid-item">
                <span className="grid-label">Created By / On</span>
                <span className="grid-value" style={{ color: '#4f46e5', fontWeight: 'bold' }}>
                  {selectedRecord.createdBy || 'System'}{' '}
                  {selectedRecord.createdAt && (
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal', display: 'block' }}>
                      ({formatDateTimeToDDMMYYYY(selectedRecord.createdAt)})
                    </span>
                  )}
                </span>
              </Col>
              <Col xs={12} sm={6} md={4} className="grid-item">
                <span className="grid-label">Last Updated By / On</span>
                <span className="grid-value" style={{ color: selectedRecord.updatedBy ? '#10b981' : '#cbd5e1', fontWeight: selectedRecord.updatedBy ? 'bold' : 'normal' }}>
                  {selectedRecord.updatedBy ? (
                    <>
                      {selectedRecord.updatedBy}{' '}
                      {selectedRecord.updatedAt && (
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal', display: 'block' }}>
                          ({formatDateTimeToDDMMYYYY(selectedRecord.updatedAt)})
                        </span>
                      )}
                    </>
                  ) : '—'}
                </span>
              </Col>
            </Row>

            {/* Diagnostic Document Preview Section */}
            <div className="diagnostic-document-section">
              <h4>{isEditing ? 'Replace Diagnostic Document' : `Diagnostic Documents (${selectedRecord.files.length})`}</h4>

              {!isEditing ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                  {selectedRecord.files.map((fileRecord, index) => (
                    <div key={index} className="document-preview-box" style={{ marginBottom: 0, height: '100%' }}>
                      <div className="document-preview-header">
                        <div className="doc-icon">
                          {(fileRecord.fileName || '').includes('.pdf') ? '📄' : '🖼️'}
                        </div>
                        <div className="doc-meta">
                          <span className="doc-name">{fileRecord.fileName || 'Unnamed File'}</span>
                          <span className="doc-size">{fileRecord.fileSize}</span>
                        </div>
                        <div className="doc-actions-group" style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="doc-action-btn view-btn-circle"
                            onClick={() => handleViewFile(fileRecord)}
                            title="View document file"
                          >
                            👁️
                          </button>
                          <button
                            className="doc-action-btn download-btn-circle"
                            onClick={() => handleDownloadFile(fileRecord)}
                            title="Download document file"
                          >
                            📥
                          </button>
                        </div>
                      </div>

                      {/* If image and data URL exists, show small inline preview */}
                      {(fileRecord.fileUrl && fileRecord.fileUrl.match(/\.(jpeg|jpg|gif|png)$/i)) || (fileRecord.fileData &&
                        !fileRecord.fileData.includes('...') &&
                        fileRecord.fileData.startsWith('data:image/')) ? (
                        <div className="image-preview-wrapper" style={{ marginTop: '10px', height: '150px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '8px' }}>
                          <img
                            src={fileRecord.fileUrl || fileRecord.fileData}
                            alt="Uploaded Medical File Preview"
                            className="inline-doc-img"
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="edit-attachment-box" style={{ padding: '15px', border: '2px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}>
                  <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '10px', fontWeight: '600' }}>
                    Existing Files:
                  </p>
                  <ul style={{ paddingLeft: '0', marginTop: '5px', listStyleType: 'none', margin: '5px 0 15px 0' }}>
                    {selectedRecord.files.map((f, i) => {
                      const fileId = f.id || f._id;
                      const isDeleted = filesToDelete.includes(fileId);
                      if (isDeleted) return null;

                      return (
                        <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', padding: '8px 12px', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{(f.fileName || '').includes('.pdf') ? '📄' : '🖼️'}</span>
                            <span style={{ color: '#334155', fontSize: '14px', fontWeight: '500' }}>{f.fileName || 'Unnamed File'}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setFilesToDelete(prev => [...prev, fileId]);
                            }}
                            style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                            title="Delete this existing file"
                          >
                            &times;
                          </button>
                        </li>
                      );
                    })}
                    {selectedRecord.files.filter(f => !filesToDelete.includes(f.id || f._id)).length === 0 && (
                      <li style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic', padding: '8px 0' }}>All existing files marked for deletion.</li>
                    )}
                  </ul>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px', marginTop: '15px' }}>
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '10px', fontWeight: '600' }}>
                      Add New Files:
                    </p>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        const selected = Array.from(e.target.files);
                        setNewFiles(prev => [...prev, ...selected]);
                        e.target.value = null;
                      }}
                      style={{ width: '100%', padding: '8px', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                    />
                    {newFiles.length > 0 && (
                      <div style={{ marginTop: '10px', fontSize: '14px', color: '#16a34a' }}>
                        Selected {newFiles.length} file(s):
                        <ul style={{ paddingLeft: '20px', marginTop: '5px', listStyleType: 'none', margin: '5px 0 0 0' }}>
                          {Array.from(newFiles).map((file, i) => (
                            <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', padding: '4px', background: '#eef2ff', borderRadius: '4px' }}>
                              <span style={{ color: '#334155' }}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                              <button
                                onClick={() => setNewFiles(prev => prev.filter((_, index) => index !== i))}
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
                                title="Remove this file"
                              >
                                &times;
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              {!isEditing ? (
                <>
               
                  <button className="btn-close-modal" onClick={handleCloseModal} style={{ background: '#e2e8f0', color: '#475569', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                    Dismiss Record View
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn-cancel-modal"
                    onClick={() => {
                      setIsEditing(false);
                      setNewFiles([]);
                      setFilesToDelete([]);
                    }}
                    disabled={isUploading}
                    style={{
                      background: '#e2e8f0',
                      color: '#475569',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: 'bold',
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                  <button className="btn-save-modal" onClick={handleSaveEdit} disabled={isUploading} style={{ background: '#10b981', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.7 : 1, fontSize: '14px' }}>
                    {isUploading ? 'Saving...' : 'Save Uploads'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Area hidden from screen view, used only for @media print */}
      <div id="printable-records-area" style={{ display: 'none' }}>
        <div className="print-report-header">
          <div>
            <h1>Guru Shree MRD</h1>
            <p>Clinical Patient Records Database Report</p>
          </div>
          <div className="print-meta-info">
            Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()} | Total Records: {filteredRecords.length}
          </div>
        </div>
        <table className="print-records-table">
          <thead>
            <tr>
              <th>IP Number</th>
              <th>Patient Name</th>
              <th>Age</th>
              <th>Date</th>
              <th>Type</th>
              <th>Gender</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((r, idx) => (
              <tr key={idx}>
                <td>{r.ipNo || ''}</td>
                <td>{r.name || ''}</td>
                <td>{r.age ? `${r.age} Yrs` : ''}</td>
                <td>{formatDateToDDMMYYYY(r.date)}</td>
                <td>{r.recordType || ''}</td>
                <td>{r.gender || ''}</td>
                <td>{r.createdBy || 'System'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="print-footer">
          Guru Shree Medical Records Department
        </div>
      </div>
    </div>
  );
}

export default Viewform;
