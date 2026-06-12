import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col } from 'react-bootstrap';

const CredentialsPage = () => {
  const navigate = useNavigate();

  // Stateful gatekeeper array synchronized with localStorage
  const [gatekeepers, setGatekeepers] = useState(() => {
    const list = JSON.parse(localStorage.getItem('medflow_gatekeeper_users') || '[]');
    // Ensure sadhana default exists
    if (!list.some(u => u.username === 'sadhana')) {
      list.push({ username: 'sadhana', password: '0633' });
      localStorage.setItem('medflow_gatekeeper_users', JSON.stringify(list));
    }
    return list;
  });

  // Stateful doctor array synchronized with localStorage
  const [doctors, setDoctors] = useState(() => {
    let list = JSON.parse(localStorage.getItem('medflow_registered_doctors') || '[]');
    if (list.length === 0) {
      list = [
        { doctorName: 'Dr. Sudha', dept: 'Cardiology', password: '123' },
        { doctorName: 'Dr. Arthur', dept: 'Pediatrics', password: '123' },
        { doctorName: 'Dr. sana', dept: 'Pediatrics', password: '123' }
      ];
      localStorage.setItem('medflow_registered_doctors', JSON.stringify(list));
    }
    return list;
  });

  // New Gatekeeper form inputs
  const [newGateUsername, setNewGateUsername] = useState('');
  const [newGatePassword, setNewGatePassword] = useState('');

  // New Doctor form inputs
  const [newDocName, setNewDocName] = useState('');
  const [newDocDept, setNewDocDept] = useState('Cardiology');
  const [newDocPass, setNewDocPass] = useState('123');

  // Add a new gatekeeper user
  const handleAddGatekeeper = (e) => {
    e.preventDefault();
    if (!newGateUsername.trim() || !newGatePassword.trim()) {
      alert('Please fill in both username and password fields.');
      return;
    }
    const usernameClean = newGateUsername.trim();
    const passwordClean = newGatePassword.trim();

    if (gatekeepers.some(u => u.username.toLowerCase() === usernameClean.toLowerCase())) {
      alert('This username already exists!');
      return;
    }

    const updated = [...gatekeepers, { username: usernameClean, password: passwordClean }];
    localStorage.setItem('medflow_gatekeeper_users', JSON.stringify(updated));
    setGatekeepers(updated);
    setNewGateUsername('');
    setNewGatePassword('');
  };

  // Delete a gatekeeper user (cannot delete saddhana)
  const handleDeleteGatekeeper = (username) => {
    if (username === 'sadhana') {
      alert('Cannot delete default gatekeeper!');
      return;
    }
    const updated = gatekeepers.filter(u => u.username !== username);
    localStorage.setItem('medflow_gatekeeper_users', JSON.stringify(updated));
    setGatekeepers(updated);
  };

  // Add a new clinical doctor
  const handleAddDoctor = (e) => {
    e.preventDefault();
    if (!newDocName.trim() || !newDocPass.trim()) {
      alert('Please fill in doctor name and password fields.');
      return;
    }
    const docNameClean = newDocName.trim();
    const docPassClean = newDocPass.trim();

    if (doctors.some(d => d.doctorName.toLowerCase() === docNameClean.toLowerCase() && d.dept === newDocDept)) {
      alert('This doctor is already registered in this department!');
      return;
    }

    const updated = [...doctors, { doctorName: docNameClean, dept: newDocDept, password: docPassClean }];
    localStorage.setItem('medflow_registered_doctors', JSON.stringify(updated));
    setDoctors(updated);
    setNewDocName('');
    setNewDocPass('123');
  };

  // Delete a clinical doctor from database
  const handleDeleteDoctor = (doctorName, dept) => {
    const updated = doctors.filter(d => !(d.doctorName === doctorName && d.dept === dept));
    localStorage.setItem('medflow_registered_doctors', JSON.stringify(updated));
    setDoctors(updated);
  };

  // Direct automatic logins for the developer sandbox
  const handleGatekeeperLoginDirect = (username, password) => {
    const newSession = {
      loginId: username,
      email: 'tamilmalar520d@gmail.com',
      loginTime: new Date().toISOString()
    };

    localStorage.setItem('medflow_isLoggedIn', 'true');
    localStorage.setItem('medflow_authEmail', 'tamilmalar520d@gmail.com');
    localStorage.setItem('medflow_currentSession', JSON.stringify(newSession));
    
    // Clear clinical department login state
    localStorage.removeItem('medflow_deptIsLoggedIn');
    localStorage.removeItem('medflow_deptSession');

    navigate('/');
    window.location.reload();
  };

  const handleDoctorLoginDirect = (doctorName, dept, password) => {
    // 1. Establish outer gatekeeper session
    const newSession = {
      loginId: doctorName,
      email: 'tamilmalar520d@gmail.com',
      loginTime: new Date().toISOString()
    };
    localStorage.setItem('medflow_isLoggedIn', 'true');
    localStorage.setItem('medflow_authEmail', 'tamilmalar520d@gmail.com');
    localStorage.setItem('medflow_currentSession', JSON.stringify(newSession));

    // 2. Establish active doctor department session
    const deptSession = {
      doctorName,
      dept,
      loginTime: new Date().toISOString()
    };
    localStorage.setItem('medflow_deptIsLoggedIn', 'true');
    localStorage.setItem('medflow_deptSession', JSON.stringify(deptSession));

    navigate('/dept');
    window.location.reload();
  };

  const additionalGatekeepers = gatekeepers.filter(u => u.username !== 'sadhana');

  return (
    <Container fluid className="p-0" style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 10% 20%, rgb(242, 246, 253) 0%, rgb(224, 233, 248) 90.1%)',
      fontFamily: '"Outfit", "Inter", sans-serif',
    }}>
      <Row className="m-0 justify-content-center">
        <Col xs={12} className="p-0" style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          borderRadius: '0',
          boxShadow: '0 20px 40px rgba(99, 102, 241, 0.08), 0 0 50px rgba(99, 102, 241, 0.04)',
          border: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
        {/* Top Header */}
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)',
          padding: '12px 30px',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div>
            <h2 style={{ margin: '0', fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Guru Shree MRD 
            </h2>
            <p style={{ margin: '2px 0 0', opacity: 0.95, fontSize: '0.75rem' }}>
              Sub heading
            </p>
          </div>
          
          <button 
            onClick={() => navigate(-1)}
            style={{
              padding: '6px 14px',
              background: 'white',
              color: '#4f46e5',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.25s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateX(-2px)';
              e.target.style.background = '#f8fafc';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateX(0)';
              e.target.style.background = 'white';
            }}
          >
            ← Back to Portal
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* SECTION 1: ADMIN & GATEKEEPER ACCOUNTS */}
          <div>
            <h3 style={{ margin: '0 0 15px 0', color: '#1e293b', fontSize: '1.2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🛡️ Admin & User Accounts
            </h3>
            
            <Row className="g-4">
              
              {/* Primary Admin Card */}
              <Col lg={6}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', background: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                    Primary Email Login
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>Vite/MongoDB</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', marginTop: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Email:</span>
                    <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{localStorage.getItem('medflow_authEmail') || 'tamilmalar520d@gmail.com'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Password:</span>
                    <strong style={{ fontFamily: 'monospace', color: '#4f46e5' }}>123</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>OTP Bypass Code:</span>
                    <strong style={{ fontFamily: 'monospace', color: '#10b981', fontSize: '1rem' }}>9999</strong>
                  </div>
                </div>
              </div>
              </Col>

              {/* Secondary Gatekeeper Card */}
              <Col lg={6}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                    Users log
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '800', background: '#ecfdf5', padding: '2px 6px', borderRadius: '4px' }}>REGISTER ACTIVE</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', marginTop: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Default User Name:</span>
                    <strong style={{ color: '#0f172a' }}>sadhana</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Default Password:</span>
                    <strong style={{ fontFamily: 'monospace', color: '#4f46e5' }}>0633</strong>
                  </div>
                  
                  {/* Dynamic Gatekeeper Accounts */}
                  <div style={{ marginTop: '5px' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginBottom: '6px', fontWeight: '700' }}>Registered staff database:</span>
                    
                    {/* Render Default sadhana first with no delete option */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px dotted #e2e8f0' }}>
                      <span style={{ color: '#0f172a' }}>👤 sadhana</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontFamily: 'monospace', color: '#4f46e5' }}>0633</strong>
                        <button 
                          onClick={() => handleGatekeeperLoginDirect('sadhana', '0633')}
                          style={{
                            padding: '3px 8px',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
                            transition: 'all 0.2s'
                          }}
                        >
                          🔑 Login
                        </button>
                      </div>
                    </div>

                    {/* Render additional added staff gatekeepers with delete option */}
                    {additionalGatekeepers.map((u, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px dotted #e2e8f0' }}>
                        <span style={{ color: '#0f172a' }}>👤 {u.username}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontFamily: 'monospace', color: '#4f46e5' }}>{u.password}</strong>
                          <button 
                            onClick={() => handleGatekeeperLoginDirect(u.username, u.password)}
                            style={{
                              padding: '3px 8px',
                              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
                              transition: 'all 0.2s'
                            }}
                          >
                            🔑 Login
                          </button>
                          <button 
                            onClick={() => handleDeleteGatekeeper(u.username)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', fontSize: '0.85rem' }}
                            title="Delete User"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add New Gatekeeper Form Inline */}
                  <form onSubmit={handleAddGatekeeper} style={{ marginTop: '12px', padding: '10px', background: '#f0fdf4', border: '1px dashed #bbf7d0', borderRadius: '12px' }}>
                    <span style={{ color: '#16a34a', fontWeight: '700', fontSize: '0.75rem', display: 'block', marginBottom: '8px' }}>➕ Register New Staff :</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input 
                        type="text" 
                        placeholder="User name" 
                        value={newGateUsername}
                        onChange={(e) => setNewGateUsername(e.target.value)}
                        style={{ flex: 1, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', background: 'white' }}
                      />
                      <input 
                        type="text" 
                        placeholder="Password" 
                        value={newGatePassword}
                        onChange={(e) => setNewGatePassword(e.target.value)}
                        style={{ flex: 1, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', background: 'white' }}
                      />
                      <button 
                        type="submit" 
                        style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        Add
                      </button>
                    </div>
                  </form>

                </div>
              </div>
              </Col>

            </Row>
          </div>

          {/* SECTION 2: CLINICAL SPECIALIZATIONS */}
          <div>
            <h3 style={{ margin: '0 0 15px 0', color: '#1e293b', fontSize: '1.2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Doctors Log
            </h3>
            
            <Row className="g-4">
              
              {/* Card 1: Clinical Doctor Mappings */}
              <Col xs={12}>
                <div style={{ background: '#fcf8ff', border: '1px solid #f3e8ff', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', background: '#f3e8ff', color: '#6b21a8', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                    CLINICAL SIGN IN MAPPINGS
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '800', background: '#ecfdf5', padding: '2px 6px', borderRadius: '4px' }}>REGISTER ACTIVE</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', marginTop: '5px' }}>
                  
                  {/* Row 1: Doctor Name */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e9d5ff', paddingBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Doctor Name Field:</span>
                    <strong style={{ color: '#7c3aed' }}>Dr. Sudha </strong>
                  </div>

                  {/* Row 2: Department */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e9d5ff', paddingBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Department Specialization Field:</span>
                    <strong style={{ color: '#7c3aed' }}>Cardiology </strong>
                  </div>

                  {/* Row 3: Password */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e9d5ff', paddingBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Keycard Password Field:</span>
                    <strong style={{ fontFamily: 'monospace', color: '#a855f7' }}>123</strong>
                  </div>

                  {/* Registered doctor database */}
                  <div style={{ marginTop: '12px' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginBottom: '6px', fontWeight: '700' }}>Registered doctor database:</span>
                    {doctors.map((u, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px dotted #e9d5ff' }}>
                        <span style={{ color: '#0f172a' }}>👤 {u.doctorName} <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({u.dept})</span></span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontFamily: 'monospace', color: '#4f46e5' }}>{u.password}</strong>
                          <button 
                            onClick={() => handleDoctorLoginDirect(u.doctorName, u.dept, u.password)}
                            style={{
                              padding: '3px 8px',
                              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(124, 58, 237, 0.2)',
                              transition: 'all 0.2s'
                            }}
                          >
                            🔑 Login
                          </button>
                            <button 
                            onClick={() => handleDeleteDoctor(u.doctorName, u.dept)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', fontSize: '0.85rem' }}
                            title="Delete Doctor"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add New Doctor Form Inline */}
                  <form onSubmit={handleAddDoctor} style={{ marginTop: '12px', padding: '10px', background: '#faf5ff', border: '1px dashed #e9d5ff', borderRadius: '12px' }}>
                    <span style={{ color: '#7c3aed', fontWeight: '700', fontSize: '0.75rem', display: 'block', marginBottom: '8px' }}>➕ Add New Clinical Doctor:</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <input 
                        type="text" 
                        placeholder="Dr. Name" 
                        value={newDocName}
                        onChange={(e) => setNewDocName(e.target.value)}
                        style={{ flex: 1.5, minWidth: '100px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', background: 'white' }}
                      />
                      <select 
                        value={newDocDept}
                        onChange={(e) => setNewDocDept(e.target.value)}
                        style={{ flex: 1.5, minWidth: '120px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', background: 'white' }}
                      >
                        <option value="Cardiology">Cardiology</option>
                        <option value="Pediatrics">Pediatrics</option>
                        <option value="General Medicine">General Medicine</option>
                        <option value="MSC Patient Care">MSC Patient Care</option>
                        <option value="Emergency Medicine">Emergency Medicine</option>
                        <option value="Obstetrics & Gynecology">Obstetrics & Gynecology</option>
                      </select>
                      <input 
                        type="text" 
                        placeholder="Keycard Pass" 
                        value={newDocPass}
                        onChange={(e) => setNewDocPass(e.target.value)}
                        style={{ flex: 1, minWidth: '80px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', background: 'white' }}
                      />
                      <button 
                        type="submit" 
                        style={{ padding: '6px 12px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        Add
                      </button>
                    </div>
                  </form>

                </div>
              </div>
              </Col>

            </Row>
          </div>

        </div>
        
        {/* Footer info bar */}
        <div style={{
          background: '#f1f5f9',
          padding: '15px 40px',
          color: '#64748b',
          fontSize: '0.75rem',
          textAlign: 'center',
          borderTop: '1px solid #e2e8f0',
          fontWeight: '500'
        }}>
          🛡️ MedFlow Security sandbox system. Do not expose production level key credentials on public deployments.
        </div>
      </Col>
    </Row>
  </Container>
  );
};

export default CredentialsPage;
