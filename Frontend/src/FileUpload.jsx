import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Row, Col } from 'react-bootstrap';
import './FileUpload.css';
import { API_URL } from './config';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function FileUpload({ onRecordSubmit, onViewSubmissions, requests = [], setRequests, existingRecords = [], showNotifications, setShowNotifications }) {
  const [formData, setFormData] = useState({
    ipNo: '',
    name: '',
    age: '',
    date: new Date().toISOString().split('T')[0],
    gender: '',
    recordType: '',
  });

  const [chatInputs, setChatInputs] = useState({});
  const [expandedChatId, setExpandedChatId] = useState(null);

  // Excel import state
  const [importedRows, setImportedRows] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [duplicateIds, setDuplicateIds] = useState(new Set());
  const [lookupDone, setLookupDone] = useState(false);
  const [removedIds, setRemovedIds] = useState(new Set());

  // Ref for the hidden Excel input field
  const excelInputRef = useRef(null);

  // Automatically mark doctor messages in expanded chat as read by admin
  useEffect(() => {
    if (expandedChatId && setRequests) {
      const activeReq = requests.find(r => r.id === expandedChatId);
      if (activeReq) {
        const hasUnread = (activeReq.messages || []).some(
          m => m.senderType === 'doctor' && m.readByAdmin !== true
        );
        if (hasUnread) {
          setRequests(prev =>
            prev.map(r => {
              if (r.id === expandedChatId) {
                return {
                  ...r,
                  messages: (r.messages || []).map(m =>
                    m.senderType === 'doctor'
                      ? { ...m, readByAdmin: true }
                      : m
                  )
                };
              }
              return r;
            })
          );
        }
      }
    }
  }, [expandedChatId, requests, setRequests]);

  const [uploadingChats, setUploadingChats] = useState({});

  const handleChatFileUpload = async (reqId, file) => {
    if (!file) return;
    setUploadingChats(prev => ({ ...prev, [reqId]: true }));
    try {
      const data = new FormData();
      data.append('file', file);

      const response = await axios.post(`${API_URL}/api/chat/upload`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        const { fileUrl, fileName, fileSize } = response.data;

        setRequests(prev => prev.map(r => {
          if (r.id === reqId) {
            const initialMsgs = r.messages || [
              {
                id: 'msg_init',
                sender: r.doctorName || 'Doctor',
                senderType: 'doctor',
                text: `Hi Admin, I need the ${r.recordType} record for patient ${r.name}. Reason: ${r.reason}`,
                timestamp: r.timestamp,
                readByAdmin: false
              }
            ];
            return {
              ...r,
              messages: [
                ...initialMsgs,
                {
                  id: 'msg_file_' + Date.now(),
                  sender: 'Admin',
                  senderType: 'admin',
                  text: `📁 Attached File: ${fileName}`,
                  fileUrl,
                  fileName,
                  fileSize,
                  timestamp: new Date().toISOString(),
                  readByDoctor: false
                }
              ]
            };
          }
          return r;
        }));
      }
    } catch (err) {
      console.error('Chat file upload failed:', err);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploadingChats(prev => ({ ...prev, [reqId]: false }));
    }
  };

  const handleRequestDecision = (reqId, decision) => {
    if (setRequests) {
      setRequests(prev => prev.map(r => {
        if (r.id === reqId) {
          const decisionText = decision === 'accepted'
            ? `✓ Request APPROVED. Preparing records.`
            : `✕ Request DECLINED. Please check requirements.`;
          const initialMsgs = r.messages || [
            {
              id: 'msg_init',
              sender: r.doctorName || 'Doctor',
              senderType: 'doctor',
              text: `Hi Admin, I need the ${r.recordType} record for patient ${r.name}. Reason: ${r.reason}`,
              timestamp: r.timestamp,
              readByAdmin: false
            }
          ];
          return {
            ...r,
            status: decision,
            notified: false,
            messages: [
              ...initialMsgs,
              {
                id: 'msg_decision_' + Date.now(),
                sender: 'System Admin',
                senderType: 'admin',
                text: decisionText,
                timestamp: new Date().toISOString(),
                isSystem: true,
                readByDoctor: false
              }
            ]
          };
        }
        return r;
      }));
    }
  };

  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const [errors, setErrors] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');

  // Calculate completion percentage
  const calculateCompleteness = () => {
    let score = 0;
    if (formData.ipNo) score += 1;
    if (formData.name) score += 1;
    if (formData.age) score += 1;
    if (formData.date) score += 1;
    if (formData.gender) score += 1;
    if (formData.recordType) score += 1;
    if (files.length > 0) score += 1;
    return Math.round((score / 7) * 100);
  };
  const completeness = calculateCompleteness();

  // Basic Validation
  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Patient name is required';
    if (!formData.ipNo.trim()) {
      newErrors.ipNo = 'IP Number is required';
    } else {
      // Check for duplicate IP against the backend records loaded in state
      const isDuplicate = existingRecords?.some(r => String(r.ipNo).trim() === formData.ipNo.trim());
      if (isDuplicate) {
        newErrors.ipNo = 'Already exist IP num';
      }
    }
    if (!formData.age) newErrors.age = 'Age is required';
    if (!formData.gender) newErrors.gender = 'Please select patient gender';
    if (!formData.recordType) newErrors.recordType = 'Please select a record category';
    if (files.length === 0) {
      setFileError('At least one medical report file is required');
      newErrors.files = true;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const mapExcelRowToFormData = (row) => {
    const keys = Object.keys(row);
    const data = {
      ipNo: '',
      name: '',
      age: '',
      date: new Date().toISOString().split('T')[0],
      gender: '',
      recordType: '',
    };

    const findValue = (possibleKeys) => {
      const matchedKey = keys.find(k =>
        possibleKeys.some(pk => k.toLowerCase().replace(/[^a-z0-9]/g, '') === pk.toLowerCase().replace(/[^a-z0-9]/g, ''))
      );
      return matchedKey ? row[matchedKey] : null;
    };

    const nameVal = findValue(['name', 'patientname', 'patient', 'fullname', 'nameofpatient', 'pname']);
    if (nameVal !== null) data.name = String(nameVal).trim();

    const ipVal = findValue(['ipno', 'ipnumber', 'ipaddress', 'ip', 'serial', 'id']);
    if (ipVal !== null) data.ipNo = String(ipVal).trim();

    const ageVal = findValue(['age', 'years']);
    if (ageVal !== null) data.age = String(ageVal).trim();

    const genderVal = findValue(['gender', 'sex']);
    if (genderVal !== null) {
      let g = String(genderVal).trim().toLowerCase();
      if (g.startsWith('m')) data.gender = 'Male';
      else if (g.startsWith('f')) data.gender = 'Female';
      else data.gender = 'Other';
    }

    const dateVal = findValue(['date', 'admissiondate', 'dateofadmission', 'admissiondate', 'dateofadmission', 'ddate']);
    if (dateVal !== null) {
      if (dateVal instanceof Date) {
        data.date = dateVal.toISOString().split('T')[0];
      } else if (typeof dateVal === 'number') {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const parsedDate = new Date(excelEpoch.getTime() + dateVal * 24 * 60 * 60 * 1000);
        data.date = parsedDate.toISOString().split('T')[0];
      } else {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          data.date = d.toISOString().split('T')[0];
        } else {
          data.date = String(dateVal).trim();
        }
      }
    }

    const typeVal = findValue(['recordtype', 'typeofdocument', 'category', 'type', 'doctype', 'documenttype']);
    if (typeVal !== null) {
      let t = String(typeVal).trim().toLowerCase();
      if (t.includes('mlc')) data.recordType = 'MLC Patient';
      else if (t.includes('advice') || t.includes('medical')) data.recordType = 'Medical Advice';
      else if (t.includes('birth')) data.recordType = 'Birth';
      else if (t.includes('death')) data.recordType = 'Death';
      else data.recordType = '';
    }

    return data;
  };

  const parsePDFTextToFormData = (text) => {
    const data = {
      ipNo: '',
      name: '',
      age: '',
      date: new Date().toISOString().split('T')[0],
      gender: '',
      recordType: '',
    };

    const normalizedText = text.replace(/\s+/g, ' ');

    // Match IP No (e.g., "IP No: 12345", "IP: 12345")
    const ipMatch = normalizedText.match(/(?:ip\s*no|ip\s*number|ip|serial|id)[. :\-\t]*([a-zA-Z0-9-]+)/i);
    if (ipMatch) data.ipNo = ipMatch[1];

    // Match Patient Name (e.g., "Patient Name: John Doe", "Name: Jane Doe")
    const nameMatch = normalizedText.match(/(?:patient\s*name|name\s*of\s*patient|name)[. :\-\t]+([A-Za-z. ]+?)(?=\s*(?:age|sex|gender|date|ip|mr|dr|#|$))/i);
    if (nameMatch) data.name = nameMatch[1].trim();

    // Match Age
    const ageMatch = normalizedText.match(/(?:age|years)[. :\-\t]*(\d+)/i);
    if (ageMatch) data.age = ageMatch[1];

    // Match Gender
    const genderMatch = normalizedText.match(/(?:gender|sex)[. :\-\t]*(male|female|m|f|other)/i);
    if (genderMatch) {
      const g = genderMatch[1].toLowerCase();
      if (g.startsWith('m')) data.gender = 'Male';
      else if (g.startsWith('f')) data.gender = 'Female';
      else data.gender = 'Other';
    }

    // Match Date (e.g., "Admission Date: 12-10-2023", "Date: 2023/10/12")
    const dateMatch = normalizedText.match(/(?:date|AAdmission\s*Date)[. :\-\t]*([\d]{1,4}[-/.\\][\d]{1,2}[-/.\\][\d]{1,4})/i);
    if (dateMatch) {
      const d = new Date(dateMatch[1]);
      if (!isNaN(d.getTime())) {
        data.date = d.toISOString().split('T')[0];
      }
    }

    // Match Record Type
    if (/mlc/i.test(normalizedText)) data.recordType = 'MLC Patient';
    else if (/advice|medical/i.test(normalizedText)) data.recordType = 'Medical Advice';
    else if (/birth/i.test(normalizedText)) data.recordType = 'Birth';
    else if (/death/i.test(normalizedText)) data.recordType = 'Death';

    return data;
  };

  const handleImportPDF = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const mapped = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Extract raw string items
        const rawItems = textContent.items.map(item => item.str.trim()).filter(s => s.length > 0);
        
        // 1. Check if this is an Exported Table from our own system
        const joinedText = rawItems.join(' ').toUpperCase();
        const isTableFormat = joinedText.includes('CLINICAL PATIENT RECORDS DATABASE REPORT') || 
                              (joinedText.includes('IP NO') && joinedText.includes('PATIENT NAME'));

        if (isTableFormat) {
          // Find where the actual data starts (after the headers)
          const headerIdx = rawItems.findIndex(str => str.toUpperCase() === 'CREATED BY' || str.toUpperCase() === 'GENDER');
          if (headerIdx !== -1) {
            let cursor = headerIdx + 1;
            // The exported table has 7 columns: IP NO, PATIENT NAME, AGE, GENDER, DISCHARGE DATE, DOCUMENT TYPE, CREATED BY
            while (cursor + 6 < rawItems.length) {
              // Attempt to parse a row. We check if the 3rd item (Age) is a number to verify alignment.
              if (!isNaN(parseInt(rawItems[cursor + 2]))) {
                const rowDate = rawItems[cursor + 4]; // Discharge date is at index 4
                // Convert DD/MM/YYYY to YYYY-MM-DD
                let formattedDate = rowDate;
                if (rowDate && rowDate.includes('/')) {
                  const parts = rowDate.split('/');
                  if (parts.length === 3) formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }

                mapped.push({
                  id: mapped.length,
                  original: { 'Source': `PDF Table Page ${i}` },
                  mapped: {
                    ipNo: rawItems[cursor],
                    name: rawItems[cursor + 1],
                    age: rawItems[cursor + 2],
                    gender: rawItems[cursor + 3],
                    date: formattedDate,
                    recordType: rawItems[cursor + 5]
                  }
                });
                cursor += 7; // move to next row
              } else {
                cursor++; // misalignment, advance by 1 to try to recover
              }
            }
          }
          continue; // Skip the Regex parser for this page
        }

        // 2. Unstructured Report parsing (Regex)
        const pageText = textContent.items.map(item => item.str).join(' ');
        const extractedData = parsePDFTextToFormData(pageText);
        
        // Only include if we found at least some meaningful data
        if (extractedData.name || extractedData.ipNo) {
          mapped.push({
            id: mapped.length,
            original: { 'Source': `PDF Page ${i}` },
            mapped: extractedData
          });
        }
      }
      
      if (mapped.length === 0) {
        alert("No valid patient data found in the PDF.");
        return;
      }

      // Always show modal for PDF to allow verification, or behave like excel
      setImportedRows(mapped);
      setImportFileName(file.name);
      setDuplicateIds(new Set());
      setRemovedIds(new Set());
      setLookupDone(false);
      setShowImportModal(true);
      
    } catch (err) {
      console.error("Failed to parse PDF:", err);
      alert("Failed to extract data from the PDF file. Please enter details manually.");
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      await handleImportPDF(file);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        if (!json || json.length === 0) {
          alert("The Excel sheet is empty or could not be parsed.");
          return;
        }

        const mapped = json.map((row, index) => ({
          id: index,
          original: row,
          mapped: mapExcelRowToFormData(row)
        }));

        if (mapped.length === 1) {
          setFormData(mapped[0].mapped);
        } else {
          setImportedRows(mapped);
          setImportFileName(file.name);
          setDuplicateIds(new Set());
          setRemovedIds(new Set());
          setLookupDone(false);
          setShowImportModal(true);
        }
      } catch (err) {
        console.error("Failed to parse Excel:", err);
        alert("Failed to parse the Excel file. Please ensure it's a valid .xlsx or .xls file.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Check imported rows against existing records to find duplicates by IP No
  // Duplicates are immediately auto-removed from the import list
  const handleLookupDuplicates = () => {
    const existingIpNos = new Set(
      existingRecords.map(r => (r.ipNo || '').toString().trim().toLowerCase())
    );
    const dupes = new Set();
    importedRows.forEach(row => {
      const ip = (row.mapped.ipNo || '').toString().trim().toLowerCase();
      if (ip && existingIpNos.has(ip)) {
        dupes.add(row.id);
      }
    });
    setDuplicateIds(dupes);
    // Auto-remove all duplicates so they cannot be imported
    setRemovedIds(prev => new Set([...prev, ...dupes]));
    setLookupDone(true);
  };

  // Remove a single row from the import list
  const handleRemoveRow = (rowId) => {
    setRemovedIds(prev => new Set([...prev, rowId]));
  };

  // Edit a field in a specific row
  const handleEditImportedRow = (rowId, field, value) => {
    setImportedRows(prev => prev.map(row => {
      if (row.id === rowId) {
        return { ...row, mapped: { ...row.mapped, [field]: value } };
      }
      return row;
    }));
  };

  const handleImportAll = async () => {
    const activeSession = JSON.parse(localStorage.getItem('medflow_currentSession') || '{}');
    const loggedInUser = activeSession.loginId || 'System';

    const rowsToImport = importedRows.filter(r => !removedIds.has(r.id));
    const patientsToImport = rowsToImport.map(r => ({
      ...r.mapped,
      createdBy: loggedInUser
    }));

    try {
      const response = await axios.post(`${API_URL}/api/patients/bulk`, {
        patients: patientsToImport
      });

      if (response.data.success) {
        if (onRecordSubmit && response.data.records) {
          onRecordSubmit(response.data.records);
        }
        const imported = response.data.imported ?? response.data.records.length;
        const skipped = response.data.skipped ?? 0;
        let msg = `✅ ${imported} patient(s) imported successfully!`;
        if (skipped > 0) {
          msg += `\n⚠️ ${skipped} record(s) were skipped — duplicate IP No already exists in the database.`;
        }
        alert(msg);
        setShowImportModal(false);
      }
    } catch (err) {
      console.error("Bulk import failed:", err);
      const errMsg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Unknown error';
      alert(`❌ Import failed — could not connect to MongoDB.\n\nError: ${errMsg}\n\nPlease ensure the backend server is running and try again.`);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const processFiles = (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    const maxSize = 5 * 1024 * 1024; // 5MB limit per file
    const validFiles = [];
    let hasError = false;

    Array.from(selectedFiles).forEach(f => {
      if (f.size > maxSize) {
        hasError = true;
      } else {
        validFiles.push(f);
      }
    });

    if (hasError) {
      setFileError('One or more files exceed the 5MB limit and were not added.');
    } else {
      setFileError('');
    }

    setFiles(prev => [...prev, ...validFiles]);
  };

  const formatBytes = (bytes) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };
  const handleFileChange = (e) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSuccessMessage('');
    setUploadedFileUrl('');

    // Retrieve logged-in clinician from local session storage
    const activeSession = JSON.parse(localStorage.getItem('medflow_currentSession') || '{}');
    const loggedInUser = activeSession.loginId || 'System';

    // Prepare form data for Multer
    const data = new FormData();
    files.forEach(f => {
      data.append('files', f);
    });


    // Append the rest of the metadata
    data.append('ipNo', formData.ipNo);
    data.append('name', formData.name);
    data.append('age', formData.age);
    data.append('date', formData.date);
    data.append('gender', formData.gender);
    data.append('recordType', formData.recordType);
    data.append('createdBy', loggedInUser);

    try {
      const response = await axios.post(`${API_URL}/upload`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setSuccessMessage(response.data.message);

        // Notify parent to add all new records to local state log
        if (onRecordSubmit && response.data.records) {
          onRecordSubmit(response.data.records);
        }

        // Reset form
        setFormData({ ipNo: '', name: '', age: '', date: new Date().toISOString().split('T')[0], gender: '', recordType: '' });
        setFiles([]);
      }
    } catch (error) {
      console.error('Upload Error:', error);
      setFileError('Failed to upload file to Google Drive. Check server logs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Row className="py-0 align-items-start" style={{ transition: 'all 0.3s ease' }}>
      <Col lg={showNotifications ? 7 : 12} className="request-form-card p-4">
        <div className="form-card-header" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="header-info" style={{ flex: '1 1 0px' }}>
            <h2>Patient Record Uplode</h2>
            <p>Please enter details accurately to sync with the digital diagnostic records.</p>
          </div>

          <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'center' }}>
            {/* Dynamic Notification Bell System */}
            <div className="notification-bell-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', zIndex: 99 }}>
              {/* Hidden Excel File Input */}
              <input
                type="file"
                ref={excelInputRef}
                style={{ display: 'none' }}
                accept=".xlsx, .xls, .pdf"
                onChange={handleImportFile}
              />

              {/* Excel Import Button */}
              <button
                type="button"
                className="import-trigger-btn"
                onClick={() => excelInputRef.current && excelInputRef.current.click()}
                style={{
                  background: 'transparent',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '10px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  backgroundColor: 'rgba(248, 250, 252, 0.8)',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.2s ease',
                  width: '48px',
                  height: '48px',
                  marginRight: '8px'
                }}
                title="Import Patient Details from Excel or PDF"
              >

                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="24" height="24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Desktop-only Notification Bell */}
              <button
                type="button"
                className="bell-trigger-btn desktop-only-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  background: 'transparent',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '10px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: showNotifications ? 'var(--primary)' : '#64748b',
                  backgroundColor: showNotifications ? 'var(--primary-glow, rgba(79, 70, 229, 0.08))' : 'rgba(248, 250, 252, 0.8)',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.2s ease',
                  width: '48px',
                  height: '48px'
                }}
                title="Access Pending Client Requests"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="24" height="24">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {requests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="bell-badge" style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#ef4444',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: '800',
                    borderRadius: '99px',
                    minWidth: '22px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid white',
                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
                  }}>
                    {requests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>

            </div>

            <div className="completeness-indicator" style={{ display: 'flex', alignItems: 'center' }}>
              <div className="progress-ring-container">
                <svg className="progress-ring" width="42" height="42">
                  <circle className="progress-ring__circle-bg" strokeWidth="3" fill="transparent" r="18" cx="21" cy="21" />
                  <circle
                    className="progress-ring__circle"
                    strokeWidth="3"
                    strokeDasharray={`${2 * Math.PI * 18}`}
                    strokeDashoffset={`${2 * Math.PI * 18 - (completeness / 100) * (2 * Math.PI * 18)}`}
                    strokeLinecap="round"
                    fill="transparent"
                    r="18"
                    cx="21"
                    cy="21"
                  />
                </svg>
                <span className="progress-percentage">{completeness}%</span>
              </div>
              <span className="completeness-label">Complete</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="intake-form">
          <Row className="g-2 align-items-end mb-4">
            <Col xs={12} sm={6} md={2} className={`form-group ${errors.ipNo ? 'has-error' : ''}`}>
              <label htmlFor="ipNo">IP No</label>
              <input type="text" id="ipNo" name="ipNo" placeholder="IP No" value={formData.ipNo} onChange={handleInputChange} className="custom-input" />
              {errors.ipNo && <span className="error-message">{errors.ipNo}</span>}
            </Col>
            <Col xs={12} sm={6} md={3} className={`form-group ${errors.name ? 'has-error' : ''}`}>
              <label htmlFor="name">Patient Name</label>
              <input type="text" id="name" name="name" placeholder="Patient Name" value={formData.name} onChange={handleInputChange} className="custom-input" />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </Col>

            <Col xs={12} sm={6} md={1} className={`form-group ${errors.age ? 'has-error' : ''}`}>
              <label htmlFor="age">Age</label>
              <input type="number" id="age" name="age" placeholder="Age" min="1" max="125" value={formData.age} onChange={handleInputChange} className="custom-input text-center" />
              {errors.age && <span className="error-message">{errors.age}</span>}
            </Col>

            <Col xs={12} sm={6} md={2} className={`form-group ${errors.gender ? 'has-error' : ''}`}>
              <label htmlFor="gender">Gender</label>
              <select id="gender" name="gender" value={formData.gender} onChange={handleInputChange} className="custom-input">
                <option value="" disabled>Select gender...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              {errors.gender && <span className="error-message">{errors.gender}</span>}
            </Col>

            <Col xs={12} sm={6} md={2} className={`form-group ${errors.date ? 'has-error' : ''}`}>
              <label htmlFor="date">Admission Date</label>
              <input type="date" id="date" name="date" value={formData.date} onChange={handleInputChange} className="custom-input" />
            </Col>

            <Col xs={12} sm={6} md={2} className={`form-group ${errors.recordType ? 'has-error' : ''}`}>
              <label htmlFor="recordType">Type of document</label>
              <select id="recordType" name="recordType" value={formData.recordType} onChange={handleInputChange} className="custom-input">
                <option value="" disabled>Select a type...</option>
                <option value="MLC Patient">MLC Patient</option>
                <option value="Medical Advice">Medical Advice</option>
                <option value="Birth">Birth</option>
                <option value="Death">Death</option>
              </select>
              {errors.recordType && <span className="error-message">{errors.recordType}</span>}
            </Col>
          </Row>

          <div className={`form-group ${fileError ? 'has-error' : ''}`}>
            <label>Upload Diagnostic / Medical Reports</label>
            <div
              className={`file-dropzone ${isDragging ? 'dragging' : ''} ${files.length > 0 ? 'has-file' : ''}`}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            >
              <div className="dropzone-placeholder" style={{ display: files.length > 0 ? 'none' : 'flex' }}>
                <div className="upload-cloud-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="dropzone-text">
                  <p className="main-drop-text">Drag & drop files here, or <span className="browse-link">browse</span></p>
                  <p className="sub-drop-text">PDF, Images (JPG/PNG) up to 5MB each</p>
                </div>
                <input type="file" id="file-upload" className="hidden-file-input" onChange={handleFileChange} accept=".pdf,image/*" multiple />
                <label htmlFor="file-upload" className="dropzone-overlay-label" />
              </div>

              {files.length > 0 && (
                <div className="files-list">
                  {files.map((f, index) => (
                    <div key={index} className="dropzone-file-preview">
                      <div className="file-preview-details">
                        <div className="file-info-text">
                          <span className="file-name">{f.name}</span>
                          <span className="file-size">{formatBytes(f.size)}</span>
                        </div>
                      </div>
                      <button type="button" className="remove-file-btn" onClick={(e) => { e.preventDefault(); removeFile(index); }}>✕</button>
                    </div>
                  ))}
                  <div className="add-more-wrapper">
                    <input type="file" id="file-upload-more" className="hidden-file-input" onChange={handleFileChange} accept=".pdf,image/*" multiple />
                    <label htmlFor="file-upload-more" className="browse-link" style={{ marginTop: '1rem', display: 'inline-block', position: 'relative', zIndex: 10 }}>+ Add More Files</label>
                  </div>
                </div>
              )}
            </div>
            {fileError && <span className="error-message">{fileError}</span>}
          </div>

          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Uploading to Drive...' : 'Save'}
          </button>
        </form>

        {successMessage && (
          <div className="success-alert">
            {successMessage}
            {uploadedFileUrl && <a href={uploadedFileUrl} target="_blank" rel="noopener noreferrer">View File</a>}
          </div>
        )}
      </Col>

      {/* Right Column: Doctor Record Requests Feed */}
      {showNotifications && (
        <Col lg={5} className="request-history-card p-0" style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="history-header">
            <h3>Doctor Record Requests Feed</h3>
            <span className="history-count-badge">{requests.length} Requests</span>
          </div>

          <div className="history-list-wrapper" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {requests.length === 0 ? (
              <div className="empty-history-state">
                <div className="empty-icon-ring">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <p>No clinical requests received</p>
                <span>Incoming doctor requests will appear here with live chat and action controls.</span>
              </div>
            ) : (
              <div className="history-items-container">
                {requests.map((req) => (
                  <div key={req.id} className={`history-item-row ${req.status}`} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', width: '100%' }}>
                      <div className="item-main-details">
                        <div className="item-title-row">
                          <span className="item-patient-name">{req.name}</span>
                          <span className={`priority-pill ${req.priority.toLowerCase()}`}>
                            {req.priority}
                          </span>
                        </div>
                        <div className="item-meta-row">
                          <span><strong>IP:</strong> {req.ipNo}</span>
                          <span className="meta-divider">•</span>
                          <span><strong>Type:</strong> {req.recordType}</span>
                        </div>
                        <div className="item-meta-row" style={{ marginTop: '4px', fontSize: '0.78rem', color: '#6366f1', display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span>👤<strong>Requested By:</strong> {req.doctorName ? (req.doctorName.startsWith('Dr') ? req.doctorName : 'Dr. ' + req.doctorName) : 'Unknown Doctor'} ({req.department || 'Clinical'})</span>
                        </div>
                        <p className="item-reason-preview">"{req.reason}"</p>
                        <span className="item-time">
                          {new Date(req.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          - {new Date(req.timestamp).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="item-status-column" style={{ flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                        <div className={`status-badge-premium ${req.status}`}>
                          {req.status === 'pending' && (
                            <>
                              <span className="pulsing-amber-dot"></span>
                              Pending
                            </>
                          )}
                          {req.status === 'accepted' && (
                            <>
                              <span className="check-icon-mini">✓</span>
                              Approved
                            </>
                          )}
                          {req.status === 'declined' && (
                            <>
                              <span className="cross-icon-mini">✕</span>
                              Declined
                            </>
                          )}
                        </div>

                        {req.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleRequestDecision(req.id, 'accepted')}
                              style={{
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                              title="Approve Request"
                            >
                              ✓ Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestDecision(req.id, 'declined')}
                              style={{
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                              title="Decline Request"
                            >
                              ✕ Decline
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Chat System */}
                    <div style={{ marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setExpandedChatId(expandedChatId === req.id ? null : req.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#4f46e5',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: expandedChatId === req.id ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                          transition: 'all 0.2s'
                        }}
                      >
                        {(() => {
                          const unreadCount = (req.messages || [
                            { senderType: 'doctor', readByAdmin: false }
                          ]).filter(m => m.senderType === 'doctor' && m.readByAdmin !== true).length;
                          return `💬 Chat & Messages (${unreadCount})`;
                        })()}
                      </button>

                      {expandedChatId === req.id && (
                        <div style={{
                          marginTop: '8px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          <div style={{
                            maxHeight: '180px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            padding: '6px',
                            background: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #f1f5f9'
                          }}>
                            {(req.messages || [
                              {
                                id: 'msg_init',
                                sender: req.doctorName ? (req.doctorName.startsWith('Dr') ? req.doctorName : 'Dr. ' + req.doctorName) : 'Doctor',
                                senderType: 'doctor',
                                text: `Hi Admin, I need the ${req.recordType} record for patient ${req.name}. Reason: ${req.reason}`,
                                timestamp: req.timestamp,
                                readByAdmin: false
                              }
                            ]).map((msg) => {
                              const isMe = msg.senderType === 'admin';
                              return (
                                <div key={msg.id} style={{
                                  alignSelf: msg.isSystem ? 'center' : (isMe ? 'flex-end' : 'flex-start'),
                                  maxWidth: '85%',
                                  background: msg.isSystem ? '#e2e8f0' : (isMe ? '#4f46e5' : '#f1f5f9'),
                                  color: msg.isSystem ? '#475569' : (isMe ? '#ffffff' : '#0f172a'),
                                  padding: '6px 10px',
                                  borderRadius: '12px',
                                  borderTopRightRadius: !msg.isSystem && isMe ? '2px' : '10px',
                                  borderTopLeftRadius: !msg.isSystem && !isMe ? '2px' : '10px',
                                  fontSize: '0.78rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  border: msg.isSystem ? '1px dashed #cbd5e1' : 'none'
                                }}>
                                  {!msg.isSystem && (
                                    <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.8 }}>
                                      {msg.sender}
                                    </span>
                                  )}
                                  {msg.fileUrl ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', padding: '8px', background: isMe ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: '8px', border: '1px solid ' + (isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)') }}>
                                      <span style={{ wordBreak: 'break-all', fontWeight: '600' }}>📁 {msg.fileName || 'Attached File'}</span>
                                      <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{msg.fileSize}</span>
                                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'flex-start', marginTop: '4px', padding: '4px 8px', background: isMe ? '#ffffff' : '#4f46e5', color: isMe ? '#4f46e5' : '#ffffff', border: 'none', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block' }}>
                                        View Attachment
                                      </a>
                                    </div>
                                  ) : (
                                    <span style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                                  )}
                                  <span style={{ fontSize: '0.6rem', alignSelf: 'flex-end', opacity: 0.6, marginTop: '2px' }}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <form onSubmit={(e) => {
                            e.preventDefault();
                            const text = chatInputs[req.id] || '';
                            if (!text.trim()) return;

                            setRequests(prev => prev.map(r => {
                              if (r.id === req.id) {
                                const initialMsgs = r.messages || [
                                  {
                                    id: 'msg_init',
                                    sender: r.doctorName || 'Doctor',
                                    senderType: 'doctor',
                                    text: `Hi Admin, I need the ${r.recordType} record for patient ${r.name}. Reason: ${r.reason}`,
                                    timestamp: r.timestamp,
                                    readByAdmin: false
                                  }
                                ];
                                return {
                                  ...r,
                                  messages: [
                                    ...initialMsgs,
                                    {
                                      id: 'msg_' + Date.now(),
                                      sender: 'Admin',
                                      senderType: 'admin',
                                      text: text.trim(),
                                      timestamp: new Date().toISOString(),
                                      readByDoctor: false
                                    }
                                  ]
                                };
                              }
                              return r;
                            }));

                            setChatInputs(prev => ({ ...prev, [req.id]: '' }));
                          }} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '6px', borderRadius: '8px', background: '#e2e8f0', color: '#475569', transition: 'all 0.2s', minWidth: '32px', height: '32px', boxSizing: 'border-box' }} title="Upload File">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                              </svg>
                              <input
                                type="file"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleChatFileUpload(req.id, e.target.files[0]);
                                  }
                                }}
                                style={{ display: 'none' }}
                                disabled={uploadingChats[req.id]}
                              />
                            </label>
                            <input
                              type="text"
                              placeholder={uploadingChats[req.id] ? "Uploading attachment..." : "Type message..."}
                              value={chatInputs[req.id] || ''}
                              onChange={(e) => setChatInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                              disabled={uploadingChats[req.id]}
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                fontSize: '0.78rem',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                outline: 'none'
                              }}
                            />
                            <button
                              type="submit"
                              disabled={uploadingChats[req.id]}
                              style={{
                                background: '#4f46e5',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '0.78rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                opacity: uploadingChats[req.id] ? 0.7 : 1
                              }}
                            >
                              {uploadingChats[req.id] ? '...' : 'Send'}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Col>
      )}

      {/* Excel Row Selection Modal Overlay */}
      {showImportModal && (() => {
        const visibleRows = importedRows.filter(r => !removedIds.has(r.id));
        const importCount = visibleRows.length;
        return (
          <div className="success-overlay" style={{ zIndex: 1000 }}>
            <div className="success-modal" style={{ maxWidth: '860px', padding: '2rem', display: 'block', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>Select Patient to Import</h3>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>File: {importFileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    transition: 'color 0.2s',
                    lineHeight: 1
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Duplicate legend */}
              {lookupDone && duplicateIds.size > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '1rem',
                  padding: '10px 14px',
                  background: '#fff5f5',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  color: '#b91c1c',
                  fontWeight: '600'
                }}>
                  <span style={{ fontSize: '1rem' }}>🗑️</span>
                  Deleted all duplicated items ({duplicateIds.size} record{duplicateIds.size !== 1 ? 's' : ''} removed). Only new records remain.
                </div>
              )}
              {lookupDone && duplicateIds.size === 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '1rem',
                  padding: '10px 14px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  color: '#166534',
                  fontWeight: '600'
                }}>
                  <span style={{ fontSize: '1rem' }}>✅</span>
                  No duplicates found. All records are new.
                </div>
              )}

              <div style={{ maxHeight: '380px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                <table className="table table-hover align-middle" style={{ margin: 0, width: '100%' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#ffffff', zIndex: 1, boxShadow: 'inset 0 -1px 0 #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>IP No</th>
                      <th style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Patient Name</th>
                      <th style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Age</th>
                      <th style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Gender</th>
                      <th style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Admission Date</th>
                      <th style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Document Type</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const isDupe = lookupDone && duplicateIds.has(row.id);
                      return (
                        <tr
                          key={row.id}
                          style={{
                            cursor: 'default',
                            transition: 'background-color 0.15s',
                            backgroundColor: isDupe ? '#fff5f5' : 'transparent',
                            borderLeft: isDupe ? '4px solid #ef4444' : '4px solid transparent',
                          }}
                        >
                          <td style={{ padding: '8px', fontSize: '0.9rem', fontWeight: '600', color: isDupe ? '#b91c1c' : '#0f172a' }}>
                            <input 
                              type="text" 
                              value={row.mapped.ipNo || ''} 
                              onChange={(e) => handleEditImportedRow(row.id, 'ipNo', e.target.value)}
                              style={{ width: '80px', padding: '4px', border: '1px solid transparent', borderRadius: '4px', background: 'transparent', outline: 'none' }}
                              onFocus={(e) => e.target.style.border = '1px solid #cbd5e1'}
                              onBlur={(e) => e.target.style.border = '1px solid transparent'}
                            />
                            {isDupe && (
                              <span style={{ display: 'inline-block', marginLeft: '6px', padding: '1px 6px', background: '#fee2e2', color: '#dc2626', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800', verticalAlign: 'middle' }}>DUPLICATE</span>
                            )}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input 
                              type="text" 
                              value={row.mapped.name || ''} 
                              onChange={(e) => handleEditImportedRow(row.id, 'name', e.target.value)}
                              style={{ width: '100%', padding: '4px', border: '1px solid transparent', borderRadius: '4px', background: 'transparent', outline: 'none', color: isDupe ? '#b91c1c' : '#334155' }}
                              onFocus={(e) => e.target.style.border = '1px solid #cbd5e1'}
                              onBlur={(e) => e.target.style.border = '1px solid transparent'}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input 
                              type="text" 
                              value={row.mapped.age || ''} 
                              onChange={(e) => handleEditImportedRow(row.id, 'age', e.target.value)}
                              style={{ width: '50px', padding: '4px', border: '1px solid transparent', borderRadius: '4px', background: 'transparent', outline: 'none', color: isDupe ? '#b91c1c' : '#334155' }}
                              onFocus={(e) => e.target.style.border = '1px solid #cbd5e1'}
                              onBlur={(e) => e.target.style.border = '1px solid transparent'}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <select 
                              value={row.mapped.gender || ''} 
                              onChange={(e) => handleEditImportedRow(row.id, 'gender', e.target.value)}
                              style={{ padding: '4px', border: '1px solid transparent', borderRadius: '4px', background: 'transparent', outline: 'none', fontSize: '0.85rem' }}
                              onFocus={(e) => e.target.style.border = '1px solid #cbd5e1'}
                              onBlur={(e) => e.target.style.border = '1px solid transparent'}
                            >
                              <option value="">-</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input 
                              type="date" 
                              value={row.mapped.date || ''} 
                              onChange={(e) => handleEditImportedRow(row.id, 'date', e.target.value)}
                              style={{ padding: '4px', border: '1px solid transparent', borderRadius: '4px', background: 'transparent', outline: 'none', color: isDupe ? '#b91c1c' : '#334155', fontSize: '0.85rem' }}
                              onFocus={(e) => e.target.style.border = '1px solid #cbd5e1'}
                              onBlur={(e) => e.target.style.border = '1px solid transparent'}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <select 
                              value={row.mapped.recordType || ''} 
                              onChange={(e) => handleEditImportedRow(row.id, 'recordType', e.target.value)}
                              style={{ padding: '4px', border: '1px solid transparent', borderRadius: '4px', background: 'transparent', outline: 'none', fontSize: '0.85rem' }}
                              onFocus={(e) => e.target.style.border = '1px solid #cbd5e1'}
                              onBlur={(e) => e.target.style.border = '1px solid transparent'}
                            >
                              <option value="">-</option>
                              <option value="MLC Patient">MLC Patient</option>
                              <option value="Medical Advice">Medical Advice</option>
                              <option value="Birth">Birth</option>
                              <option value="Death">Death</option>
                            </select>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="primary-modal-btn"
                                onClick={(e) => { e.stopPropagation(); setFormData(row.mapped); setShowImportModal(false); }}
                                style={{ padding: '6px 12px', fontSize: '0.8rem', margin: 0, display: 'inline-block' }}
                              >
                                Select
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRemoveRow(row.id); }}
                                title="Remove this row from import"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  border: '1.5px solid #fca5a5',
                                  background: isDupe ? '#ef4444' : '#f1f5f9',
                                  color: isDupe ? '#ffffff' : '#94a3b8',
                                  fontSize: '0.8rem',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  transition: 'all 0.15s'
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {importCount === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontStyle: 'italic' }}>
                          All rows have been removed.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem', alignItems: 'center' }}>
                {/* Lookup Duplicates button */}
                <button
                  type="button"
                  onClick={handleLookupDuplicates}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.9rem',
                    margin: 0,
                    background: lookupDone ? '#f0fdf4' : '#fffbeb',
                    color: lookupDone ? '#166534' : '#92400e',
                    border: `1.5px solid ${lookupDone ? '#bbf7d0' : '#fde68a'}`,
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginRight: 'auto',
                    transition: 'all 0.2s'
                  }}
                  title="Check for duplicate IP Numbers against existing records"
                >
                  🔍 {lookupDone ? `Lookup Done (${duplicateIds.size} duplicate${duplicateIds.size !== 1 ? 's' : ''})` : 'Lookup Duplicates'}
                </button>

                <button
                  type="button"
                  className="secondary-modal-btn"
                  onClick={() => setShowImportModal(false)}
                  style={{ padding: '8px 16px', fontSize: '0.9rem', margin: 0 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-modal-btn"
                  onClick={handleImportAll}
                  disabled={importCount === 0}
                  style={{ padding: '8px 16px', fontSize: '0.9rem', margin: 0, opacity: importCount === 0 ? 0.5 : 1 }}
                >
                  Import All ({importCount} Record{importCount !== 1 ? 's' : ''})
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </Row>
  );
}

export default FileUpload;
