import React, { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { API_URL } from './config';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('medflow_authEmail') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Secondary User credentials state
  const [secondaryUsername, setSecondaryUsername] = useState('');
  const [secondaryPassword, setSecondaryPassword] = useState('');
  const [showSecondaryPassword, setShowSecondaryPassword] = useState(false);

  // Dynamic user users array persisted in localStorage (sadhana/0633 default)
  const [authorizedUsers, setAuthorizedUsers] = useState(() => {
    const saved = localStorage.getItem('medflow_authorized_users');
    return saved ? JSON.parse(saved) : [{ username: 'sadhana', password: '0633' }];
  });

  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newAuthUserName, setNewAuthUserName] = useState('');
  const [newAuthUserPass, setNewAuthUserPass] = useState('');
  const [newAuthUserType, setNewAuthUserType] = useState('User');

  const [loginError, setLoginError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loginStep, setLoginStep] = useState(1); // 1: Email/Password, 2: OTP, 3: User Credentials
  const [otp, setOtp] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [backendSessionId, setBackendSessionId] = useState(null);

  // OTP Timer Logic
  useEffect(() => {
    let interval;
    if (loginStep === 2 && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [loginStep, otpTimer]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setInfoMessage('');
    setIsAuthLoading(true);
    try {
      const storedPrimary = localStorage.getItem('medflow_primary_password');
      if (storedPrimary && email === 'gshmrd2627@gmail.com' && password === storedPrimary) {
        setLoginStep(2);
        setOtpTimer(300);
        setInfoMessage('🔑 [Demo Mode] OTP code generated: 9999.');
        setIsAuthLoading(false);
        return;
      }
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.success) {
        setLoginStep(2);
        setOtpTimer(300); // 5 mins
        if (data.otp) {
          setInfoMessage(`🔑 [Demo Mode] OTP code generated: ${data.otp}. (You can also check your email inbox if SMTP is active)`);
        } else {
          setInfoMessage('');
        }
      } else {
        setLoginError(data.message || 'Invalid email or password');
      }
    } catch (err) {
      setLoginError('Server error, unable to login');
    }
    setIsAuthLoading(false);
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsAuthLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await response.json();
      if (data.success) {
        setOtp('');
        if (data.sessionId) setBackendSessionId(data.sessionId);
        // Transition to Step 3: Secondary username & password user!
        setLoginStep(3);
      } else {
        setLoginError(data.message || 'Invalid OTP');
      }
    } catch (err) {
      setLoginError('Server error, unable to verify OTP');
    }
    setIsAuthLoading(false);
  };

  const handleSecondarySubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsAuthLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/users`);
      let authenticatedUser = null;
      
      if (response.ok) {
        const users = await response.json();
        // Check database users
        authenticatedUser = users.find(
          (user) => 
            user.username.trim().toLowerCase() === secondaryUsername.trim().toLowerCase() && 
            user.password.trim() === secondaryPassword.trim()
        );
      }

      // Fallback to local user users if not found in backend
      if (!authenticatedUser) {
        authenticatedUser = authorizedUsers.find(
          (user) => 
            user.username.trim().toLowerCase() === secondaryUsername.trim().toLowerCase() && 
            user.password.trim() === secondaryPassword.trim()
        );
      }

      if (authenticatedUser) {
        // Success! Create session and grant full view access
        const newSession = {
          loginId: authenticatedUser.username || authenticatedUser.employeeName,
          email: email,
          loginTime: new Date().toISOString(),
          sessionId: backendSessionId,
          userType: authenticatedUser.userType || 'Admin'
        };

        localStorage.setItem('medflow_isLoggedIn', 'true');
        localStorage.setItem('medflow_authEmail', email);
        localStorage.setItem('medflow_currentSession', JSON.stringify(newSession));
        
        setIsAuthLoading(false);
        if (onLoginSuccess) {
          onLoginSuccess(authenticatedUser.username || authenticatedUser.employeeName, newSession);
        }
      } else {
        setLoginError("Invalid User Name or Password.");
        setIsAuthLoading(false);
      }
    } catch (err) {
      setLoginError("Server error verifying user.");
      setIsAuthLoading(false);
    }
  };

  const handleCreateUserSubmit = (e) => {
    e.preventDefault();
    setLoginError('');
    
    const cleanName = newAuthUserName.trim();
    const cleanPass = newAuthUserPass.trim();

    if (!cleanName || !cleanPass) {
      setLoginError("User name and password are required.");
      return;
    }

    // Check for username duplication
    const exists = authorizedUsers.some(
      (user) => user.username.toLowerCase() === cleanName.toLowerCase()
    );

    if (exists) {
      setLoginError("This User Name is already authorized.");
      return;
    }

    // Append and save the new user account
    const updatedList = [...authorizedUsers, { username: cleanName, password: cleanPass, userType: newAuthUserType }];
    setAuthorizedUsers(updatedList);
    localStorage.setItem('medflow_authorized_users', JSON.stringify(updatedList));

    alert(`User "${cleanName}" authorized successfully! You can now log in using these credentials.`);
    
    // Return back to Step 3 user login panel
    setNewAuthUserName('');
    setNewAuthUserPass('');
    setNewAuthUserType('User');
    setIsCreatingUser(false);
  };

  const handleResendOtp = async () => {
    setLoginError('');
    setInfoMessage('');
    setIsAuthLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.success) {
        setOtpTimer(300);
        if (data.otp) {
          setInfoMessage(`🔑 [Demo Mode] OTP code generated: ${data.otp}. (You can also check your email inbox if SMTP is active)`);
          alert(`Verification OTP generated! For immediate login, use code: ${data.otp}`);
        } else {
          setInfoMessage('');
          alert('Verification OTP resent successfully!');
        }
      } else {
        setLoginError(data.message || 'Failed to resend OTP');
      }
    } catch (err) {
      setLoginError('Server error, unable to resend OTP');
    }
    setIsAuthLoading(false);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getObfuscatedEmail = (emailStr) => {
    if (!emailStr || !emailStr.includes('@')) return emailStr;
    const [localPart, domain] = emailStr.split('@');
    const visiblePart = localPart.length > 4 ? localPart.slice(-4) : localPart;
    return `**********${visiblePart}@${domain}`;
  };

  return (
    <Container fluid className="login-container d-flex align-items-center justify-content-center min-vh-100 p-0">
      <Row className="w-100 justify-content-center m-0">
        <Col xs={11} sm={8} md={6} lg={4} className="login-card">
          <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#1e293b' }}>
            {loginStep === 1 && 'Login'}
            {loginStep === 2 && 'Email Verification'}
            {loginStep === 3 && (isCreatingUser ? 'Register New User' : 'User Verification')}
          </h2>
          {loginError && <p style={{ color: '#ef4444', textAlign: 'center', marginBottom: '15px', fontWeight: '500' }}>{loginError}</p>}
          
          {/* Step 1: Login Form (Email & Password) */}
          {loginStep === 1 && (
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#64748b', fontWeight: '500' }}>Email</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  placeholder="Enter email id"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#64748b', fontWeight: '500' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '10px', paddingRight: '40px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                  />
                  <div 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#64748b' }}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </div>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={isAuthLoading} 
                style={{ background: '#4f46e5', color: 'white', padding: '12px', borderRadius: '6px', border: 'none', cursor: isAuthLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', marginTop: '10px', fontSize: '16px', opacity: isAuthLoading ? 0.7 : 1 }}
              >
                {isAuthLoading ? 'Sending Login OTP...' : 'Login'}
              </button>
            </form>
          )}

          {/* Step 2: OTP Verification Form */}
          {loginStep === 2 && (
            <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'center' }}>
              <p style={{ color: '#475569', fontSize: '14px', marginBottom: '10px' }}>
                We've sent a 4-digit code to <strong>{getObfuscatedEmail(email)}</strong>
              </p>
              {infoMessage && (
                <div style={{ background: '#fef3c7', border: '1px solid #d97706', color: '#92400e', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: '500', textAlign: 'left', lineHeight: '1.4' }}>
                  {infoMessage}
                </div>
              )}
              <div>
                <input 
                  type="text" 
                  maxLength="4"
                  value={otp} 
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} 
                  required 
                  placeholder="0000"
                  style={{ width: '150px', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', textAlign: 'center', fontSize: '24px', letterSpacing: '4px' }} 
                />
              </div>
              <button 
                type="submit" 
                disabled={isAuthLoading} 
                style={{ background: '#10b981', color: 'white', padding: '12px', borderRadius: '6px', border: 'none', cursor: isAuthLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', marginTop: '10px', fontSize: '16px', opacity: isAuthLoading ? 0.7 : 1 }}
              >
                {isAuthLoading ? 'Verifying...' : 'Verify OTP Code'}
              </button>
              
              <div style={{ marginTop: '15px', fontSize: '14px' }}>
                {otpTimer > 0 ? (
                  <span style={{ color: '#64748b' }}>Code expires in {formatTime(otpTimer)}</span>
                ) : (
                  <div>
                    <span style={{ color: '#ef4444' }}>Code expired. </span>
                    <button type="button" onClick={handleResendOtp} disabled={isAuthLoading} style={{ background: 'none', border: 'none', color: '#4f46e5', textDecoration: 'underline', cursor: isAuthLoading ? 'not-allowed' : 'pointer', padding: 0 }}>
                      {isAuthLoading ? 'Resending...' : 'Resend OTP'}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', textAlign: 'left', lineHeight: '1.4' }}>
                <strong>Bypass Note:</strong> If email is not received (e.g. Render blocks SMTP), you can use the sandbox bypass code <strong>9999</strong>.
              </div>
            </form>
          )}

          {/* Step 3: Secondary User (sadhana / 0633) */}
          {loginStep === 3 && !isCreatingUser && (
            <form onSubmit={handleSecondarySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <p style={{ color: '#475569', fontSize: '14px', marginBottom: '10px', textAlign: 'center', fontWeight: '500' }}>
                Enter authorization details to view application.
              </p>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#64748b', fontWeight: '500' }}>User Name</label>
                <input 
                  type="text" 
                  value={secondaryUsername} 
                  onChange={(e) => setSecondaryUsername(e.target.value)} 
                  required 
                  placeholder="Enter user name"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#64748b', fontWeight: '500' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showSecondaryPassword ? "text" : "password"} 
                    value={secondaryPassword} 
                    onChange={(e) => setSecondaryPassword(e.target.value)} 
                    required 
                    placeholder="••••"
                    style={{ width: '100%', padding: '10px', paddingRight: '40px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                  />
                  <div 
                    onClick={() => setShowSecondaryPassword(!showSecondaryPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#64748b' }}
                  >
                    {showSecondaryPassword ? <FaEyeSlash /> : <FaEye />}
                  </div>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={isAuthLoading} 
                style={{ background: '#4f46e5', color: 'white', padding: '12px', borderRadius: '6px', border: 'none', cursor: isAuthLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', marginTop: '10px', fontSize: '16px', opacity: isAuthLoading ? 0.7 : 1 }}
              >
                Verify & View Application
              </button>

              <div style={{ marginTop: '10px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingUser(true);
                    setLoginError('');
                  }}
                  style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '14px', fontWeight: '600', textDecoration: 'underline' }}
                >
                  + Add New User
                </button>
              </div>
            </form>
          )}

          {/* Step 3 - Sub-view: Add New User */}
          {loginStep === 3 && isCreatingUser && (
            <form onSubmit={handleCreateUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <p style={{ color: '#475569', fontSize: '14px', marginBottom: '10px', textAlign: 'center', fontWeight: '500' }}>
                👤 Create a new authorized User account.
              </p>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#64748b', fontWeight: '500' }}>New User Name</label>
                <input 
                  type="text" 
                  value={newAuthUserName} 
                  onChange={(e) => setNewAuthUserName(e.target.value)} 
                  required 
                  placeholder="Choose username"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#64748b', fontWeight: '500' }}>New Password</label>
                <input 
                  type="password" 
                  value={newAuthUserPass} 
                  onChange={(e) => setNewAuthUserPass(e.target.value)} 
                  required 
                  placeholder="Choose password"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#64748b', fontWeight: '500' }}>User Type</label>
                <select
                  value={newAuthUserType}
                  onChange={(e) => setNewAuthUserType(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                >
                  <option value="Admin">Admin (Full Access)</option>
                  <option value="User">User (Restricted)</option>
                </select>
              </div>
              
              <button 
                type="submit" 
                style={{ background: '#10b981', color: 'white', padding: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px', fontSize: '16px' }}
              >
                Register & Save
              </button>

              <div style={{ marginTop: '10px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingUser(false);
                    setLoginError('');
                  }}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', fontWeight: '600', textDecoration: 'underline' }}
                >
                  Cancel & Return
                </button>
              </div>
            </form>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default Login;
