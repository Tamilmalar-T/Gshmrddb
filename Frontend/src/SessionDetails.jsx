import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

const SessionDetails = ({ currentSession, sessionHistory, activeDuration, onClose }) => {
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

  return (
    <Container fluid className="session-details-page p-4">
      
      {/* Full Page Header */}
      <header className="session-details-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button 
            onClick={onClose} 
            style={{ background: '#f1f5f9', color: '#475569', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: '50%', transition: 'all 0.2s' }} 
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#1e293b'; }} 
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }} 
            title="Back to Dashboard"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 style={{ color: '#0f172a', margin: 0, fontSize: '24px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>Session Details</h1>
        </div>
        
        {currentSession && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#eff6ff', padding: '8px 16px', borderRadius: '20px', border: '1px solid #bfdbfe', flexShrink: 0 }}>
            <span style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
            <span style={{ color: '#1d4ed8', fontSize: '14px', fontWeight: '600' }}>Active Now</span>
          </div>
        )}
      </header>
 
      {/* Main Content Area */}
      <main className="session-details-main">
        
        {/* Current Session Panel */}
        <section className="session-details-card">
          <h2 style={{ fontSize: '20px', color: '#1e293b', marginBottom: '25px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" width="24" height="24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Current Active Session
          </h2>
          
          {currentSession ? (
            <Row className="g-3">
              <Col xs={12} sm={6} md={4} lg className="session-field-box">
                <div style={{ color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '600' }}> Logged In (Email)</div>
                <div style={{ color: '#4f46e5', fontSize: '16px', fontWeight: '600', wordBreak: 'break-all' }}>{currentSession.email || localStorage.getItem('medflow_authEmail') || 'N/A'}</div>
              </Col>
              <Col xs={12} sm={6} md={4} lg className="session-field-box">
                <div style={{ color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '600' }}>Active(User)</div>
                <div style={{ color: '#8b5cf6', fontSize: '16px', fontWeight: '600', wordBreak: 'break-all' }}>{currentSession.loginId || 'N/A'}</div>
              </Col>
              <Col xs={12} sm={6} md={4} lg className="session-field-box">
                <div style={{ color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '600' }}>Login Time</div>
                <div style={{ color: '#0f172a', fontSize: '16px', fontWeight: '500' }}>{formatDateTimeToDDMMYYYY(currentSession.loginTime)}</div>
              </Col>
              <Col xs={12} sm={6} md={4} lg className="session-field-box">
                <div style={{ color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '600' }}>Status</div>
                <div style={{ color: '#10b981', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  In Progress...
                </div>
              </Col>
              <Col xs={12} sm={6} md={4} lg className="session-field-box active-highlight">
                <div style={{ color: '#3b82f6', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '600' }}>Duration so far</div>
                <div style={{ color: '#1d4ed8', fontSize: '24px', fontWeight: '700', fontFamily: 'monospace' }}>{activeDuration}</div>
              </Col>
            </Row>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>No active session tracked. Please log out and back in.</p>
            </div>
          )}
        </section>
 
        {/* Past Sessions Panel */}
        <section className="session-details-card">
          <h2 style={{ fontSize: '20px', color: '#1e293b', marginBottom: '25px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" width="24" height="24">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sessions History
          </h2>
          
          {(sessionHistory.length > 0 || currentSession) ? (
            <div className="session-details-table-wrapper">
              <table className="session-details-table">
                <thead>
                  <tr>
                    <th>Logged In (Email)</th>
                    <th>user</th>
                    <th>Login Time</th>
                    <th>Logout Time</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSession && (
                    <tr style={{ background: '#eff6ff', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}>
                      <td style={{ fontWeight: '600', color: '#4f46e5', wordBreak: 'break-all' }}>
                        {currentSession.email || localStorage.getItem('medflow_authEmail') || 'N/A'}
                      </td>
                      <td style={{ fontWeight: '600', color: '#8b5cf6', wordBreak: 'break-all' }}>
                        {currentSession.loginId || 'N/A'}
                      </td>
                      <td>{formatDateTimeToDDMMYYYY(currentSession.loginTime)}</td>
                      <td>
                        <span style={{ 
                          background: '#eff6ff', 
                          color: '#1d4ed8', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '12px', 
                          fontWeight: '600',
                          border: '1px solid #bfdbfe',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span style={{ width: '6px', height: '6px', background: '#3b82f6', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
                          Active Now
                        </span>
                      </td>
                      <td style={{ color: '#1d4ed8', fontWeight: '600', fontFamily: 'monospace', fontSize: '16px' }}>
                        {activeDuration || '0h 0m 0s'}
                      </td>
                    </tr>
                  )}
                  {sessionHistory.map((s, idx) => {
                    const loggedInEmail = s.email || (s.loginId && s.loginId.includes('@') ? s.loginId : 'gshmrd2627@gmail.com');
                    const loggedOutUser = s.email ? s.loginId : (s.loginId && !s.loginId.includes('@') ? s.loginId : 'sadhana');
                    return (
                      <tr key={idx} style={{ transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ fontWeight: '600', color: '#4f46e5', wordBreak: 'break-all' }}>{loggedInEmail}</td>
                        <td style={{ fontWeight: '600', color: '#8b5cf6', wordBreak: 'break-all' }}>{loggedOutUser}</td>
                        <td>{formatDateTimeToDDMMYYYY(s.loginTime)}</td>
                        <td>{formatDateTimeToDDMMYYYY(s.logoutTime)}</td>
                        <td style={{ color: '#0f172a', fontWeight: '600', fontFamily: 'monospace', fontSize: '16px' }}>{s.duration}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '50px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" width="48" height="48" style={{ marginBottom: '15px' }}>
                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>No session history available yet.</p>
            </div>
          )}
        </section>
      </main>
    </Container>
  );
};

export default SessionDetails;
