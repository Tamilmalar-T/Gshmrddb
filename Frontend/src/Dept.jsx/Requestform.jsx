import { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Row, Col } from 'react-bootstrap';
import { API_URL } from '../config';
import './Requestform.css';

function Requestform({ requests, setRequests, doctorName, department }) {
  const [formData, setFormData] = useState({
    name: '',
    ipNo: '',
    recordType: '',
    priority: 'Medium',
    reason: '',
  });

  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [expandedChatId, setExpandedChatId] = useState(null);
  const [chatInputText, setChatInputText] = useState('');

  // Automatically mark admin/system messages in expanded chat as read by doctor
  useEffect(() => {
    if (expandedChatId && setRequests) {
      const activeReq = requests.find(r => r.id === expandedChatId);
      if (activeReq) {
        const hasUnread = (activeReq.messages || []).some(
          m => m.senderType === 'admin' && m.readByDoctor !== true
        );
        if (hasUnread) {
          setRequests(prev =>
            prev.map(r => {
              if (r.id === expandedChatId) {
                return {
                  ...r,
                  messages: (r.messages || []).map(m =>
                    m.senderType === 'admin'
                      ? { ...m, readByDoctor: true }
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
                text: `Hi Admin, I need the ${r.recordType} record for patient ${r.name} (IP: ${r.ipNo}). Reason: ${r.reason}`,
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
                  sender: doctorName ? (doctorName.startsWith('Dr') ? doctorName : 'Dr. ' + doctorName) : 'Doctor',
                  senderType: 'doctor',
                  text: `📁 Attached File: ${fileName}`,
                  fileUrl,
                  fileName,
                  fileSize,
                  timestamp: new Date().toISOString(),
                  readByAdmin: false
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

  const filteredRequests = requests.filter(req => {
    if (department && department !== 'Administration') {
      const currentDoc = (doctorName || '').toLowerCase().trim();
      const reqDoc = (req.doctorName || '').toLowerCase().trim();
      
      const cleanCurrentDoc = currentDoc.replace(/^dr\.?\s*/, '');
      const cleanReqDoc = reqDoc.replace(/^dr\.?\s*/, '');
      
      return cleanReqDoc === cleanCurrentDoc;
    }
    return true;
  });

  // Form validation
  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Patient name is required';
    if (!formData.ipNo.trim()) newErrors.ipNo = 'IP Number is required';
    if (!formData.recordType) newErrors.recordType = 'Please select a record category';
    if (!formData.reason.trim()) newErrors.reason = 'Please provide a reason for this request';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handlePrioritySelect = (prio) => {
    setFormData((prev) => ({ ...prev, priority: prio }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Create a new request object
    const newRequest = {
      id: 'req_' + Date.now(),
      name: formData.name.trim(),
      ipNo: formData.ipNo.trim(),
      recordType: formData.recordType,
      priority: formData.priority,
      reason: formData.reason.trim(),
      timestamp: new Date().toISOString(),
      status: 'pending', // 'pending' | 'accepted' | 'declined'
      notified: false,  // false means the user hasn't seen the final result popup yet
      doctorName: doctorName || 'Unknown Doctor',
      department: department || 'Clinical Department',
      messages: [
        {
          id: 'msg_init',
          sender: doctorName ? (doctorName.startsWith('Dr') ? doctorName : 'Dr. ' + doctorName) : 'Doctor',
          senderType: 'doctor',
          text: `Hi Admin, I need the ${formData.recordType} record for patient ${formData.name.trim()} (IP: ${formData.ipNo.trim()}). Reason: ${formData.reason.trim()}`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    setRequests((prev) => [newRequest, ...prev]);
    
    // Reset form fields
    setFormData({
      name: '',
      ipNo: '',
      recordType: '',
      priority: 'Medium',
      reason: '',
    });

    setSuccess(true);
    setTimeout(() => setSuccess(false), 4000);
  };

  // Acknowledge a status change (Accepted/Declined) to dismiss the top-level notification
  const handleAcknowledge = (reqId) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, notified: true } : r))
    );
  };

  // Extract requests that have been updated by Gatekeeper and need notification banners
  const unnotifiedResults = filteredRequests.filter(
    (r) => r.status !== 'pending' && !r.notified
  );

  return (
    <Container fluid className="request-page-container p-4">
      {/* 1. Real-Time Result Notifications Banners */}
      {unnotifiedResults.length > 0 && (
        <div className="status-alerts-container">
          {unnotifiedResults.map((req) => (
            <div
              key={req.id}
              className={`status-alert-card ${
                req.status === 'accepted' ? 'accepted-alert' : 'declined-alert'
              }`}
            >
              <div className="alert-icon-wrapper">
                {req.status === 'accepted' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </div>
              <div className="alert-content">
                <h4>
                  Request for {req.name} has been{' '}
                  <span className="status-highlight">{req.status.toUpperCase()}</span>
                </h4>
                <p>
                  <strong>IP No:</strong> {req.ipNo} | <strong>Category:</strong> {req.recordType} |{' '}
                  <strong>Priority:</strong> {req.priority}
                </p>
                <p className="alert-reason-text">"{req.reason}"</p>
              </div>
              <button
                type="button"
                className="dismiss-alert-btn"
                onClick={() => handleAcknowledge(req.id)}
                title="Acknowledge and Clear Notification"
              >
                Acknowledge
              </button>
            </div>
          ))}
        </div>
      )}

      <Row className="g-4">
        {/* 2. Glassmorphic Request Form Card */}
        <Col lg={6} className="request-form-card p-4">
          <div className="form-card-header">
            <div className="header-info">
              <h2>Patient Record Request Form</h2>
              <p>Sub Heading.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="intake-form">
            <Row className="g-3 mb-3">
              <Col xs={12} md={4} className={`form-group ${errors.ipNo ? 'has-error' : ''}`}>
                <label htmlFor="patient-ip">Patient IP No</label>
                <input
                  type="text"
                  id="patient-ip"
                  name="ipNo"
                  placeholder="e.g. 192.168.1.15"
                  value={formData.ipNo}
                  onChange={handleInputChange}
                  className="custom-input"
                />
                {errors.ipNo && <span className="error-message">{errors.ipNo}</span>}
              </Col>
              
              <Col xs={12} md={5} className={`form-group ${errors.name ? 'has-error' : ''}`}>
                <label htmlFor="patient-name">Patient Full Name</label>
                <input
                  type="text"
                  id="patient-name"
                  name="name"
                  placeholder="Enter patient full name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="custom-input"
                />
                {errors.name && <span className="error-message">{errors.name}</span>}
              </Col>

              <Col xs={12} md={3} className={`form-group ${errors.recordType ? 'has-error' : ''}`}>
                <label htmlFor="record-type">Requested Category</label>
                <select
                  id="record-type"
                  name="recordType"
                  value={formData.recordType}
                  onChange={handleInputChange}
                  className="custom-input"
                >
                  <option value="" disabled>Select a category...</option>
                  <option value="MSC Patient">MSC Patient</option>
                  <option value="Medical Advice">Medical Advice</option>
                  <option value="Birth">Birth</option>
                  <option value="Death">Death</option>
                </select>
                {errors.recordType && <span className="error-message">{errors.recordType}</span>}
              </Col>
            </Row>

            {/* Premium Priority Radio Group Selector */}
            <div className="form-group">
              <label>Urgency Priority</label>
              <div className="priority-selector-row">
                {['Low', 'Medium', 'High'].map((prio) => (
                  <button
                    key={prio}
                    type="button"
                    className={`priority-btn ${prio.toLowerCase()} ${
                      formData.priority === prio ? 'selected' : ''
                    }`}
                    onClick={() => handlePrioritySelect(prio)}
                  >
                    <span className="dot-indicator"></span>
                    {prio}
                  </button>
                ))}
              </div>
            </div>

            <div className={`form-group ${errors.reason ? 'has-error' : ''}`}>
              <label htmlFor="request-reason">Reason / Message for Request</label>
              <textarea
                id="request-reason"
                name="reason"
                rows="3"
                placeholder="Message"
                value={formData.reason}
                onChange={handleInputChange}
                className="custom-input custom-textarea"
              />
              {errors.reason && <span className="error-message">{errors.reason}</span>}
            </div>

            <button type="submit" className="submit-btn" style={{ background: 'var(--primary)' }}>
               Send Request
            </button>
          </form>

          {success && (
            <div className="success-alert" style={{ marginTop: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
              ✓ Request successfully submitted to administrative feed.
            </div>
          )}
        </Col>

        {/* 3. History Feed and Logs Panel */}
        <Col lg={6} className="request-history-card p-0">
          <div className="history-header">
            <h3>My Requested Submissions</h3>
            <span className="history-count-badge">{filteredRequests.length} Requests</span>
          </div>

          <div className="history-list-wrapper">
            {filteredRequests.length === 0 ? (
              <div className="empty-history-state">
                <div className="empty-icon-ring">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <p>No active requests in this session</p>
                <span>Submitted requests will appear here with their live status logs.</span>
              </div>
            ) : (
              <div className="history-items-container">
                {filteredRequests.map((req) => (
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
                          <span>👤 <strong>Requested By:</strong> {req.doctorName ? (req.doctorName.startsWith('Dr') ? req.doctorName : 'Dr. ' + req.doctorName) : 'Unknown Doctor'} ({req.department || 'Clinical'})</span>
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

                      <div className="item-status-column">
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
                          const unreadCount = (req.messages || []).filter(
                            m => m.senderType === 'admin' && m.readByDoctor !== true
                          ).length;
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
                                text: `Hi Admin, I need the ${req.recordType} record for patient ${req.name} (IP: ${req.ipNo}). Reason: ${req.reason}`,
                                timestamp: req.timestamp,
                                readByAdmin: false
                              }
                            ]).map((msg) => {
                              const isMe = msg.senderType === 'doctor';
                              return (
                                <div key={msg.id} style={{
                                  alignSelf: msg.isSystem ? 'center' : (isMe ? 'flex-end' : 'flex-start'),
                                  maxWidth: '85%',
                                  background: msg.isSystem ? '#f1f5f9' : (isMe ? '#4f46e5' : '#e2e8f0'),
                                  color: msg.isSystem ? '#64748b' : (isMe ? '#ffffff' : '#0f172a'),
                                  padding: '6px 10px',
                                  borderRadius: '12px',
                                  borderTopRightRadius: !msg.isSystem && isMe ? '2px' : '12px',
                                  borderTopLeftRadius: !msg.isSystem && !isMe ? '2px' : '12px',
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
                            if (!chatInputText.trim()) return;
                            
                            setRequests(prev => prev.map(r => {
                              if (r.id === req.id) {
                                const initialMsgs = r.messages || [
                                  {
                                    id: 'msg_init',
                                    sender: r.doctorName || 'Doctor',
                                    senderType: 'doctor',
                                    text: `Hi Admin, I need the ${r.recordType} record for patient ${r.name} (IP: ${r.ipNo}). Reason: ${r.reason}`,
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
                                      sender: doctorName ? (doctorName.startsWith('Dr') ? doctorName : 'Dr. ' + doctorName) : 'Doctor',
                                      senderType: 'doctor',
                                      text: chatInputText.trim(),
                                      timestamp: new Date().toISOString(),
                                      readByAdmin: false
                                    }
                                  ]
                                };
                              }
                              return r;
                            }));
                            setChatInputText('');
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
                              value={chatInputText}
                              onChange={(e) => setChatInputText(e.target.value)}
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
      </Row>
    </Container>
  );
}

export default Requestform;
