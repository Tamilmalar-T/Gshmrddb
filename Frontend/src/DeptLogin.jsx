import React, { useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import './DeptLogin.css';
import { API_URL } from './config';

const DeptLogin = ({ onLoginSuccess }) => {
  const [doctorName, setDoctorName] = useState('');
  const [dept, setDept] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  const [departments] = useState(() =>
    JSON.parse(localStorage.getItem('medflow_departments_v2') || '[]').map(d => d.name)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!doctorName.trim()) {
      setError('Please enter the doctor name.');
      setIsLoading(false);
      return;
    }
    if (!dept) {
      setError('Please select a department.');
      setIsLoading(false);
      return;
    }
    if (!isResetMode && !password) {
      setError('Please enter your password.');
      setIsLoading(false);
      return;
    }

    if (isResetMode) {
      if (!newPassword || !confirmPassword) {
        setError('Please enter and confirm your new password.');
        setIsLoading(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match.');
        setIsLoading(false);
        return;
      }
      try {
        const response = await fetch(`${API_URL}/api/auth/dept-reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doctorName, dept, newPassword })
        });
        const data = await response.json();
        if (response.ok && data.success) {
          const registeredDoctors = JSON.parse(localStorage.getItem('medflow_registered_doctors') || '[]');
          const index = registeredDoctors.findIndex(d => d.doctorName === doctorName && d.dept === dept);
          if (index >= 0) {
            registeredDoctors[index].password = newPassword;
            localStorage.setItem('medflow_registered_doctors', JSON.stringify(registeredDoctors));
          } else {
            registeredDoctors.push({ doctorName, dept, password: newPassword });
            localStorage.setItem('medflow_registered_doctors', JSON.stringify(registeredDoctors));
          }
          setSuccess('Password reset successfully. Please sign in with your new password.');
          setIsResetMode(false);
          setPassword('');
          setNewPassword('');
          setConfirmPassword('');
        } else {
          setError(data.message || 'Failed to reset password.');
        }
      } catch (err) {
        console.error('Dept reset error:', err);
        setError('Connection to auth server failed.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/dept-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorName, dept, password })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Dynamic doctor database registration
        const registeredDoctors = JSON.parse(localStorage.getItem('medflow_registered_doctors') || '[]');
        if (!registeredDoctors.some(d => d.doctorName === doctorName && d.dept === dept)) {
          registeredDoctors.push({ doctorName, dept, password });
          localStorage.setItem('medflow_registered_doctors', JSON.stringify(registeredDoctors));
        }

        if (onLoginSuccess) {
          onLoginSuccess(data);
        }
      } else {
        setError(data.message || 'Invalid doctor name, department, or password.');
      }
    } catch (err) {
      console.error('Dept login error:', err);
      setError('Connection to auth server failed. Make sure Backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container fluid className="dept-login-wrapper d-flex align-items-center justify-content-center min-vh-100 p-0">
      <div className="dept-login-bg-shapes">
        <div className="shape shape1"></div>
        <div className="shape shape2"></div>
      </div>
      
      <Row className="w-100 justify-content-center m-0" style={{ position: 'relative', zIndex: 2 }}>
        <Col xs={11} sm={8} md={6} lg={4} className="dept-login-card">
          <div className="dept-login-header">
            <div className="dept-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2>Doctor Login</h2>
            <p>Sign in as a doctor to submit patient record requests.</p>
          </div>

          {error && (
            <div className="dept-error-banner animate-shake">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="dept-error-banner" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="dept-login-form">
            <div className="input-group-premium">
              <label htmlFor="doctorName">Doctor Name</label>
              <div className="input-with-icon">
                <span className="input-icon">👤</span>
                <input
                  type="text"
                  id="doctorName"
                  placeholder="e.g. Dr. Arthur Pendelton"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group-premium">
              <label htmlFor="dept">Department / Specialization</label>
              <div className="input-with-icon">
                <span className="input-icon">🏥</span>
                <select
                  id="dept"
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  required
                  className={!dept ? 'placeholder-active' : ''}
                >
                  <option value="" disabled>Select your department...</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {!isResetMode ? (
              <div className="input-group-premium">
                <label htmlFor="password">Doctor Password</label>
                <div className="input-with-icon">
                  <span className="input-icon">🔑</span>
                  <input
                    type="password"
                    id="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!isResetMode}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <div className="help-text">
                    💡 Hint: Default password is <strong>123</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setIsResetMode(true); setError(''); setSuccess(''); }}
                    style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="input-group-premium">
                  <label htmlFor="newPassword">New Password</label>
                  <div className="input-with-icon">
                    <span className="input-icon">🔒</span>
                    <input
                      type="password"
                      id="newPassword"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required={isResetMode}
                    />
                  </div>
                </div>
                <div className="input-group-premium">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <div className="input-with-icon">
                    <span className="input-icon">🔒</span>
                    <input
                      type="password"
                      id="confirmPassword"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required={isResetMode}
                    />
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginTop: '-10px' }}>
                  <button
                    type="button"
                    onClick={() => { setIsResetMode(false); setError(''); setSuccess(''); }}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
                  >
                    Back to Login
                  </button>
                </div>
              </>
            )}

            <button
              type="submit"
              className={`dept-submit-btn ${isLoading ? 'loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="loader-spinner"></span>
              ) : (
                <>
                  <span>{isResetMode ? 'Reset Password' : 'Secure Clinical Sign In'}</span>
                  <span className="arrow-icon">→</span>
                </>
              )}
            </button>
          </form>
        </Col>
      </Row>
    </Container>
  );
};

export default DeptLogin;
