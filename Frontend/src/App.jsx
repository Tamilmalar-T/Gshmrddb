import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import FileUpload from './FileUpload';
import Viewform from './Viewform';
import Requestform from './Dept.jsx/Requestform';
// import Barcode from './Barcode';
import Login from './Login';
import DeptLogin from './DeptLogin';
import SessionDetails from './SessionDetails';
import CredentialsPage from './CredentialsPage';
import UsersPanel from './UsersPanel';
import DepartmentsPanel from './DepartmentsPanel';
import UserTypesPanel from './UserTypesPanel';
import { createPortal } from 'react-dom';
import './App.css';
import './Dept.jsx/Requestform.css';
import { API_URL } from './config';

function App() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'view' | 'export' | 'users' | 'departments'
  const [showSidebar, setShowSidebar] = useState(false);
  const [records, setRecords] = useState([]);
  const [isOffline, setIsOffline] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('medflow_isLoggedIn') === 'true';
  });

  const [isDeptLoggedIn, setIsDeptLoggedIn] = useState(() => {
    return localStorage.getItem('medflow_deptIsLoggedIn') === 'true';
  });
  const [deptSession, setDeptSession] = useState(() => {
    const stored = localStorage.getItem('medflow_deptSession');
    return stored ? JSON.parse(stored) : null;
  });

  const handleDeptLoginSuccess = (session) => {
    setIsDeptLoggedIn(true);
    setDeptSession(session);
    localStorage.setItem('medflow_deptIsLoggedIn', 'true');
    localStorage.setItem('medflow_deptSession', JSON.stringify(session));
  };

  const handleDeptLogout = () => {
    setIsDeptLoggedIn(false);
    setDeptSession(null);
    localStorage.removeItem('medflow_deptIsLoggedIn');
    localStorage.removeItem('medflow_deptSession');
  };

  const [requests, setRequests] = useState(() => {
    const stored = localStorage.getItem('medflow_requests');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem('medflow_requests', JSON.stringify(requests));
  }, [requests]);

  // Synchronize requests across browser tabs in real-time
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'medflow_requests') {
        try {
          setRequests(JSON.parse(e.newValue || '[]'));
        } catch (err) {
          console.error("Error parsing synchronized requests", err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const [currentSession, setCurrentSession] = useState(() => {
    const stored = localStorage.getItem('medflow_currentSession');
    return stored ? JSON.parse(stored) : null;
  });
  const [sessionHistory, setSessionHistory] = useState(() => {
    const stored = localStorage.getItem('medflow_sessions');
    return stored ? JSON.parse(stored) : [];
  });
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [activeDuration, setActiveDuration] = useState('');

  // Live timer for current session
  useEffect(() => {
    let interval;
    if (showSessionDetails && currentSession) {
      const updateDuration = () => {
        const now = new Date();
        const loginTime = new Date(currentSession.loginTime);
        const diffMs = now - loginTime;
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        setActiveDuration(`${hours}h ${minutes}m ${seconds}s`);
      };
      updateDuration();
      interval = setInterval(updateDuration, 1000);
    }
    return () => clearInterval(interval);
  }, [showSessionDetails, currentSession]);



  // Fetch records from backend on mount
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const response = await fetch(`${API_URL}/api/patients`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        setRecords(data);
        setIsOffline(false);
        localStorage.setItem('medflow_submissions', JSON.stringify(data));
      } catch (error) {
        console.error("Failed to fetch from MongoDB, falling back to local storage", error);
        setIsOffline(true);
        const stored = localStorage.getItem('medflow_submissions');
        if (stored) {
          setRecords(JSON.parse(stored));
        }
      }
    };
    fetchRecords();
  }, []);

  // Update records handler (adds to UI state immediately, backend handles actual saving)
  const addRecord = (newRecords) => {
    const recordsToAdd = Array.isArray(newRecords) ? newRecords : [newRecords];
    const updated = [...recordsToAdd, ...records];
    setRecords(updated);
    if (isOffline) {
      localStorage.setItem('medflow_submissions', JSON.stringify(updated));
    }
  };

  // Delete records handler (deletes from DB and UI state)
  const deleteRecord = async (id) => {
    try {
      if (!isOffline && id && id.length === 24) {
        await fetch(`${API_URL}/api/patients/${id}`, { method: 'DELETE' });
      }

      const deletedRecord = records.find(r => (r.id || r._id) === id);
      const updated = records.map(r => {
        if ((r.id || r._id) === id) return null;
        if (deletedRecord && r.ipNo === deletedRecord.ipNo && r.date === deletedRecord.date) {
          return { ...r, updatedAt: new Date().toISOString() };
        }
        return r;
      }).filter(Boolean);

      setRecords(updated);
      localStorage.setItem('medflow_submissions', JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to delete record from DB", error);
    }
  };

  // Edit record handler (updates file attachment)
  const editRecord = async (id, filesArray, keepOriginal) => {
    try {
      if (!isOffline && id && id.length === 24) {
        const formData = new FormData();
        filesArray.forEach(file => {
          formData.append("files", file);
        });
        formData.append("keepOriginal", keepOriginal);

        // Append active gatekeeper clinician who is making this edit
        const activeUser = currentSession ? currentSession.loginId : 'System';
        formData.append("updatedBy", activeUser);

        const response = await fetch(`${API_URL}/api/patients/${id}/files`, {
          method: 'PUT',
          body: formData,
        });
        const data = await response.json();
        if (data.success) {
          let updatedState = [...records];

          // Replace the original record (matched by ID) and prepend any newly created files
          updatedState = updatedState.map(r => (r.id || r._id) === id ? data.records[0] : r);
          const newRecords = data.records.slice(1);
          updatedState = [...newRecords, ...updatedState];

          setRecords(updatedState);
          localStorage.setItem('medflow_submissions', JSON.stringify(updatedState));
          return true;
        } else {
          console.error("Failed to update record on server", data.message, data.error);
          // If the record wasn't found (404), the DB and localStorage are out of sync — re-fetch to correct it
          if (response.status === 404) {
            alert(`This record no longer exists in the database.\n\nThe page will now refresh to sync with the latest data.`);
            try {
              const freshResp = await fetch(`${API_URL}/api/patients`);
              if (freshResp.ok) {
                const freshData = await freshResp.json();
                setRecords(freshData);
                localStorage.setItem('medflow_submissions', JSON.stringify(freshData));
              }
            } catch (syncErr) {
              console.error("Failed to re-sync records after 404", syncErr);
            }
          } else {
            alert(`Error updating record: ${data.error || data.message || "Unknown error"}`);
          }
          return false;
        }
      } else {
        alert("Updating files is only supported when connected to the server.");
        return false;
      }
    } catch (error) {
      console.error("Error updating record", error);
      throw error;
    }
  };

  // Stats calculation
  const totalSubmissions = new Set(records.map(r => r.ipNo)).size;

  const recentActivity = records.length > 0 ? records[0].name : 'No submissions yet';

  const handleLogout = (isAuto = false) => {
    if (currentSession) {
      const logoutTime = new Date();
      const loginTime = new Date(currentSession.loginTime);
      let diffMs = logoutTime - loginTime;

      // If this is an automatic idle logout, subtract the 5 minutes of inactive time
      if (isAuto) {
        const idleTimeMs = 5 * 60 * 1000;
        diffMs = Math.max(0, diffMs - idleTimeMs);
      }

      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      const durationStr = `${hours}h ${minutes}m ${seconds}s`;

      const completedSession = {
        ...currentSession,
        logoutTime: logoutTime.toISOString(),
        duration: durationStr
      };

      const updatedHistory = [completedSession, ...sessionHistory];
      setSessionHistory(updatedHistory);
      localStorage.setItem('medflow_sessions', JSON.stringify(updatedHistory));
      setCurrentSession(null);
    }

    setIsLoggedIn(false);


    localStorage.removeItem('medflow_isLoggedIn');
    localStorage.removeItem('medflow_authEmail');
    localStorage.removeItem('medflow_currentSession');
  };

  // Auto-logout after 15 minutes of inactivity
  const latestLogout = useRef(handleLogout);
  const latestDeptLogout = useRef(handleDeptLogout);
  useEffect(() => {
    latestLogout.current = handleLogout;
    latestDeptLogout.current = handleDeptLogout;
  }, [handleLogout, handleDeptLogout]);

  useEffect(() => {
    let timeoutId;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      if (isLoggedIn || isDeptLoggedIn) {
        timeoutId = setTimeout(() => {
          alert("You have been logged out automatically due to 15 minutes of inactivity.");
          if (isLoggedIn) latestLogout.current(true);
          if (isDeptLoggedIn) latestDeptLogout.current();
        }, 15 * 60 * 1000); // 15 minutes
      }
    };

    if (isLoggedIn || isDeptLoggedIn) {
      resetTimer();
      const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'];
      events.forEach(e => window.addEventListener(e, resetTimer));
      return () => {
        clearTimeout(timeoutId);
        events.forEach(e => window.removeEventListener(e, resetTimer));
      };
    }
  }, [isLoggedIn, isDeptLoggedIn]);



  if (!isLoggedIn) {
    return (
      <Routes>
        <Route path="/accounts" element={<CredentialsPage />} />
        <Route path="/*" element={<Login onLoginSuccess={(email, session) => {
          setIsLoggedIn(true);
          setCurrentSession(session);
          setActiveTab('form');
        }} />} />
      </Routes>
    );
  }

  if (showSessionDetails) {
    return (
      <SessionDetails
        currentSession={currentSession}
        sessionHistory={sessionHistory}
        activeDuration={activeDuration}
        onClose={() => setShowSessionDetails(false)}
      />
    );
  }

  return (
    <>
      <Routes>
        <Route
          path="/dept"
          element={
            !isDeptLoggedIn ? (
              <DeptLogin onLoginSuccess={handleDeptLoginSuccess} />
            ) : (
              <div className="app-container full-width">
                {/* Premium Doctor Header */}
                <header className="main-header dept-header" style={{ borderBottom: '2px solid #818cf8', background: 'rgba(30, 41, 59, 0.02)', padding: '15px 30px' }}>
                  <div className="header-brand">
                    <div className="brand-logo" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'white', fontWeight: 'bold' }}>
                      🩺
                    </div>
                    <div className="brand-text">
                      <div className="brand-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Guru Shree MRD</span>

                      </div>
                    </div>
                  </div>

                  <div className="header-auth" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ color: '#475569', fontSize: '14px', fontWeight: '600', background: '#f8fafc', padding: '6px 12px', borderRadius: '15px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      🏥 Dept: <span style={{ color: '#6366f1', fontWeight: 'bold' }}>{deptSession?.dept}</span> | 👤 Dr. <span style={{ color: '#a855f7', fontWeight: 'bold' }}>{deptSession?.doctorName}</span>
                    </span>



                    <button
                      onClick={handleDeptLogout}
                      style={{
                        padding: '8px 16px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)'
                      }}
                    >
                      Logout
                    </button>
                  </div>
                </header>

                <main className="main-content" style={{ marginTop: '20px' }}>
                  <Requestform
                    requests={requests}
                    setRequests={setRequests}
                    doctorName={deptSession?.doctorName}
                    department={deptSession?.dept}
                  />
                </main>
              </div>
            )
          }
        />

        <Route
          path="/*"
          element={
            !isLoggedIn ? (
              <Login onLoginSuccess={(username, session) => {
                setIsLoggedIn(true);
                setCurrentSession(session);
              }} />
            ) : (
              <div className="app-container full-width">
                {/* Premium Header - Always Visible */}
                <header className="main-header">
                  <div className="header-brand-container">
                    <div className="header-brand">
                      <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #4f46e5, #8b5cf6)', color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        🩺
                      </div>
                      <div className="brand-text">
                        <div className="brand-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', whiteSpace: 'nowrap' }}>Guru Shree MRD</span>
                        </div>
                      </div>
                    </div>

                    {/* Hamburger menu button */}
                    <button
                      className="hamburger-btn"
                      onClick={() => setShowSidebar(true)}
                      title="Open menu"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                        <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
                        <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
                        <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                  <nav className="header-nav">




                  </nav>

                  <div className="header-auth">
                    {/* <button
                      className="view-accounts-btn"
                      onClick={() => navigate('/accounts')}
                    >
                    View Account
                    </button> */}
                    {currentSession && (
                      <span className="user-session-badge">
                        <span className="user-session-name">👤<span>{currentSession.loginId}</span></span>
                        <div className="brand-text">
                          <div className="brand-title-row">
                            {isOffline ? (
                              <span className="status-badge offline" title="Offline Mode - Saving details to local sandbox">
                                <span className="dot animate-pulse-slow"></span> LOCAL MODE
                              </span>
                            ) : (
                              <span className="status-badge online" title="Online Mode - Connected to MongoDB">
                                <span className="dot"></span>
                              </span>
                            )}
                          </div>
                        </div>
                      </span>
                    )}

                    <div
                      className="user-avatar-btn"
                      title="User Profile"
                      onClick={() => setShowDropdown(!showDropdown)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>

                      {showDropdown && (
                        <div
                          className="profile-dropdown"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: '0',
                            marginTop: '5px',
                            background: 'white',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            minWidth: '150px',
                            overflow: 'hidden',
                            zIndex: 100,
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                        >
                          <button
                            onClick={() => {
                              setShowSessionDetails(true);
                              setShowDropdown(false);
                            }}
                            style={{ padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid #f1f5f9', textAlign: 'left', cursor: 'pointer', fontWeight: '500', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                            Details
                          </button>
                          <button
                            onClick={handleLogout}
                            style={{ padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: 'bold', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                            Logout
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                </header>

                {/* Stats Summary Bar */}
                <section className="stats-bar">
                  <div className="stat-card">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 110-8 4 4 0 010 8zm14 14v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{totalSubmissions}</span>
                      <span className="stat-label">Total Patients</span>
                    </div>
                  </div>


                  <div className="stat-card">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="stat-info">
                      <span className="stat-value text-truncate" title={recentActivity}>{recentActivity}</span>
                      <span className="stat-label">Last Submission</span>
                    </div>


                  </div>
                  <button
                    className={`nav-btn ${activeTab === 'form' ? 'active' : ''}`}
                    onClick={() => setActiveTab('form')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="nav-text">New Entry</span>
                  </button>

                  <button
                    className={`nav-btn ${activeTab === 'view' ? 'active' : ''}`}
                    onClick={() => setActiveTab('view')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="nav-text">Document Uploded List</span>
                    {totalSubmissions > 0 && <span className="badge">{totalSubmissions}</span>}
                  </button>
                  {/* <button
                    className={`nav-btn ${activeTab === 'export' ? 'active' : ''}`}
                    onClick={() => setActiveTab('export')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="22" height="22">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span className="nav-text">Bar code</span>
                  </button> */}
                  <button
                    className={`nav-btn mobile-only-btn ${showNotifications ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('form');
                      setShowNotifications(!showNotifications);
                    }}
                    title="Notifications"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="22" height="22">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <span className="nav-text">Notifications</span>
                    {requests.filter(r => r.status === 'pending').length > 0 && (
                      <span className="badge" style={{ background: '#ef4444' }}>
                        {requests.filter(r => r.status === 'pending').length}
                      </span>
                    )}
                  </button>
                </section>

                {/* Main Content Area */}
                <main className="main-content">
                  {activeTab === 'form' ? (
                    <FileUpload
                      onRecordSubmit={addRecord}
                      onViewSubmissions={() => setActiveTab('view')}
                      requests={requests}
                      setRequests={setRequests}
                      existingRecords={records}
                      showNotifications={showNotifications}
                      setShowNotifications={setShowNotifications}
                    />
                  ) : activeTab === 'view' ? (
                    <Viewform
                      records={records}
                      onDeleteRecord={deleteRecord}
                      onEditRecord={editRecord}
                      onExportClick={() => setActiveTab('export')}
                    />
                  ) : activeTab === 'export' ? (
                    <Barcode
                      records={records}
                      onBackClick={() => setActiveTab('view')}
                    />
                  ) : activeTab === 'users' ? (
                    <UsersPanel />
                  ) : activeTab === 'departments' ? (
                    <DepartmentsPanel />
                  ) : activeTab === 'user-types' ? (
                    <UserTypesPanel />
                  ) : (
                    <Requestform
                      requests={requests}
                      setRequests={setRequests}
                      doctorName={currentSession?.loginId || 'Admin'}
                      department="Administration"
                    />
                  )}
                </main>
              </div>
            )
          }
        />
        <Route path="/accounts" element={<CredentialsPage />} />
      </Routes>

      {showSidebar && createPortal(
        <>
          {/* Overlay */}
          <div
            onClick={() => setShowSidebar(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(15,23,42,0.45)',
              backdropFilter: 'blur(3px)',
              zIndex: 9998,
            }}
          />

          {/* Sidebar panel — slides from LEFT */}
          <aside
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', top: 0, left: 0,
              width: 240, height: '100vh',
              background: '#fff',
              boxShadow: '8px 0 32px rgba(15,23,42,0.14)',
              zIndex: 9999,
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem 0.9rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>Menu</span>
              <button onClick={() => setShowSidebar(false)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Label */}
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', padding: '0.9rem 1.25rem 0.4rem' }}>Administration</div>

            {/* Nav */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 0.75rem' }}>
              {[
                { tab: 'users', icon: '👤', label: 'User Management' },
                { tab: 'departments', icon: '🏥', label: 'Departments' },
                { tab: 'user-types', icon: '👥', label: 'User Types' },
              ].map(({ tab, icon, label }) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setShowSidebar(false);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.65rem 0.75rem', borderRadius: 10, border: 'none',
                    background: activeTab === tab ? 'rgba(79,70,229,0.08)' : 'transparent',
                    color: activeTab === tab ? '#4f46e5' : '#334155',
                    fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                    textAlign: 'left', width: '100%',
                  }}
                >
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: activeTab === tab ? 'rgba(79,70,229,0.1)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
                  {label}
                </button>
              ))}
            </nav>
          </aside>
        </>,
        document.body
      )}
    </>
  );
}

export default App;