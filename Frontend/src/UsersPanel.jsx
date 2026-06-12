import { useState, useRef, useEffect } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { API_URL } from './config';

const ROLES = ['Gatekeeper', 'Doctor', 'Admin', 'Nurse', 'Receptionist'];

const nowStr = () =>
  new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const EMPTY_FORM = {
  id: '', employeeName: '', designation: '', userType: '',
  username: '', password: '',
  role: ROLES[0], phone: '', email: '', photo: '',
};

export default function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [availableUserTypes, setAvailableUserTypes] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/users`)
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error("Failed to fetch users", err));

    fetch(`${API_URL}/api/user-types`)
      .then(res => res.json())
      .then(data => setAvailableUserTypes(data))
      .catch(err => console.error("Failed to fetch user types", err));
  }, []);



  // 'hidden' | 'add' | 'edit'
  const [formMode, setFormMode] = useState('hidden');
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [photoPreview, setPhotoPreview] = useState('');
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const fileRef = useRef();
  const formRef = useRef();

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('medflow_currentSession') || '{}')?.loginId || 'System'; }
    catch { return 'System'; }
  })();

  // Persist function removed in favor of API calls

  const openAdd = () => {
    setForm({ 
      ...EMPTY_FORM, 
      userType: availableUserTypes.length > 0 ? availableUserTypes[0].name : '',
     
    });
    setPhotoPreview('');
    setEditIndex(null);
    setErrors({});
    setFormMode('add');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const openEdit = (idx) => {
    const u = users[idx];
    setForm({ 
      ...EMPTY_FORM, 
      ...u,
      userType: u.userType || (availableUserTypes.length > 0 ? availableUserTypes[0].name : '')
 
    });
    setPhotoPreview(u.photo || '');
    setEditIndex(idx);
    setErrors({});
    setFormMode('edit');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const closeForm = () => { setFormMode('hidden'); setErrors({}); };

  const validate = () => {
    const e = {};
    if (!form.id.trim()) e.id = 'Required';
    else if (users.some((u, i) =>
      u.id.toLowerCase() === form.id.trim().toLowerCase() && i !== editIndex
    )) e.id = 'User ID already exists';
    if (!form.username.trim()) e.username = 'Required';
    if (!form.password.trim()) e.password = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.phone) {
      e.phone = 'Phone number is required';
    } else if (form.phone.length !== 10) {
      e.phone = '10 digits required';
    }
    if (users.some((u, i) =>
      u.username.toLowerCase() === form.username.trim().toLowerCase() && i !== editIndex
    )) e.username = 'Username already exists';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const syncGatekeeper = (username, password) => {
    try {
      const savedGatekeepers = JSON.parse(localStorage.getItem('medflow_gatekeeper_users') || '[{"username":"sadhana","password":"0633"}]');
      const index = savedGatekeepers.findIndex(g => g.username.toLowerCase() === username.toLowerCase());
      if (index === -1) {
        savedGatekeepers.push({ username, password });
      } else {
        savedGatekeepers[index].password = password;
      }
      localStorage.setItem('medflow_gatekeeper_users', JSON.stringify(savedGatekeepers));
    } catch (e) {
      console.error("Failed to sync gatekeeper", e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const timestamp = nowStr();
    try {
      if (formMode === 'add') {
        const payload = {
          ...form,
          username: form.username.trim(),
          photo: photoPreview,
          createdBy: currentUser,
          createdOn: timestamp,
          updatedBy: '', updatedOn: '',
        };
        const res = await fetch(`${API_URL}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Failed to add user");
        const saved = await res.json();
        setUsers([saved, ...users]);
        syncGatekeeper(form.username.trim(), form.password.trim());
      } else {
        const u = users[editIndex];
        const payload = { ...u, ...form, photo: photoPreview, updatedBy: currentUser, updatedOn: timestamp };
        const res = await fetch(`${API_URL}/api/users/${u._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Failed to update user");
        const updated = await res.json();
        setUsers(users.map((user, i) => i === editIndex ? updated : user));
        syncGatekeeper(form.username.trim(), form.password.trim());
      }
      closeForm();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (idx) => {
    const u = users[idx];
    if (!window.confirm(`Delete user "${u.username}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${u._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete user");
      setUsers(users.filter((_, i) => i !== idx));
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const setField = (name) => (e) => setForm(f => ({ ...f, [name]: e.target.value }));

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, ''); // Only keep numbers
    if (val.length <= 10) {
      setForm(f => ({ ...f, phone: val }));
    }
  };

  const filtered = users.filter(u =>
    [u.username, u.email, u.role, u.employeeName, u.designation, u.userType]
      .join(' ').toLowerCase().includes(search.toLowerCase())
  );

  /* ─── Styles ─── */
  const inp = (name) => ({
    width: '100%', padding: '0.55rem 0.85rem',
    border: `1px solid ${errors[name] ? '#ef4444' : '#cbd5e1'}`,
    borderRadius: 9, fontSize: '0.85rem', outline: 'none',
    boxSizing: 'border-box', background: '#fff',
    transition: 'border-color 0.15s',
  });

  const readonlyInp = {
    width: '100%', padding: '0.55rem 0.85rem',
    border: '1px solid #e2e8f0', borderRadius: 9,
    fontSize: '0.85rem', background: '#f8fafc',
    color: '#94a3b8', boxSizing: 'border-box', cursor: 'not-allowed',
  };

  const labelStyle = {
    display: 'block', fontSize: '0.72rem', fontWeight: 700,
    color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  const roleBadge = (role) => {
    const map = {
      Gatekeeper: ['#fef3c7', '#92400e'], Doctor: ['#ecfdf5', '#065f46'],
      Admin: ['#ede9fe', '#5b21b6'], Nurse: ['#fce7f3', '#9d174d'],
      Receptionist: ['#e0f2fe', '#0369a1'],
    };
    const [bg, color] = map[role] || ['#f1f5f9', '#475569'];
    return { background: bg, color, borderRadius: 20, padding: '2px 9px', fontSize: '0.7rem', fontWeight: 700 };
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }} className="animate-fade-in">

      {/* ── Page Header ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>User Management</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '4px 0 0' }}>
          Manage system users — gatekeepers, doctors, and administrative staff.
        </p>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          id="user-search"
          placeholder="🔍  Search by name, email,"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 180, padding: '0.5rem 0.85rem',
            border: '1px solid #cbd5e1', borderRadius: 10,
            fontSize: '0.85rem', outline: 'none', background: '#f8fafc',
          }}
        />
        <span style={{ color: '#94a3b8', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        </span>
        <button
          id="add-user-btn"
          onClick={formMode === 'add' ? closeForm : openAdd}
          style={{
            padding: '0.55rem 1.2rem',
            background: formMode === 'add'
              ? 'linear-gradient(135deg,#dc2626,#ef4444)'
              : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
            color: '#fff', border: 'none', borderRadius: 10,
            fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 4px 12px rgba(79,70,229,0.22)',
          }}
        >
          {formMode === 'add' ? '✕ Cancel' : '+ Add User'}
        </button>
      </div>

      {/* ── Inline Add / Edit Form ── */}
      {formMode !== 'hidden' && (
        <div
          ref={formRef}
          style={{
            background: '#fff', border: '1px solid #c7d2fe',
            borderRadius: 16, marginBottom: '1.5rem',
            boxShadow: '0 8px 24px rgba(79,70,229,0.10)',
            overflow: 'hidden',
          }}
        >
          {/* Form Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.5rem', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          }}>
            <span style={{ fontWeight: 800, color: '#fff', fontSize: '1rem' }}>
              {formMode === 'add' ? '➕ Add New User' : '✏️ Edit User'}
            </span>
            <button
              onClick={closeForm}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: '1rem' }}
            >✕</button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>

            {/* Photo Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
              {photoPreview
                ? <img src={photoPreview} alt="preview" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid #4f46e5' }} />
                : (
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#e0e7ff,#ede9fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', border: '3px solid #c7d2fe' }}>
                    📷
                  </div>
                )
              }
              <div>
                <label style={labelStyle}>Profile Photo</label>
                <button
                  type="button"
                  onClick={() => fileRef.current.click()}
                  style={{ padding: '0.4rem 0.9rem', border: '1px dashed #a5b4fc', background: '#f5f3ff', borderRadius: 8, color: '#4f46e5', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  📂 Upload Photo
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
                {photoPreview && (
                  <button type="button" onClick={() => setPhotoPreview('')}
                    style={{ marginLeft: 8, background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem' }}>
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Fields Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>

              {/* ID */}
              <div>
                <label style={labelStyle}>Employee ID <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  id="field-userid"
                  value={form.id}
                  onChange={setField('id')}
                  style={inp('id')}
                  placeholder="e.g. USR-01"
                />
                {errors.id && <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: 3 }}>⚠ {errors.id}</div>}
              </div>

              {/* Employee Name */}
              <div>
                <label style={labelStyle}>Employee Name</label>
                <input id="field-emp-name" value={form.employeeName} onChange={setField('employeeName')} style={inp('employeeName')} placeholder="e.g. Dr. John Doe" />
              </div>

              {/* Designation */}
              <div>
                <label style={labelStyle}>Designation</label>
                <input id="field-designation" value={form.designation} onChange={setField('designation')} style={inp('designation')} placeholder="e.g. Senior Consultant" />
              </div>

              {/* User Type */}
              <div>
                <label style={labelStyle}>User Type</label>
                <select id="field-usertype" value={form.userType} onChange={setField('userType')} style={inp('')}>
                  {availableUserTypes.length === 0 && <option value="">No types found</option>}
                  {availableUserTypes.map(t => <option key={t.code} value={t.name}>{t.name}</option>)}
                </select>
              </div>

     

              {/* Username */}
              <div>
                <label style={labelStyle}>Username <span style={{ color: '#ef4444' }}>*</span></label>
                <input id="field-username" value={form.username} onChange={setField('username')} style={inp('username')} placeholder="e.g. john_doe" />
                {errors.username && <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: 3 }}>⚠ {errors.username}</div>}
              </div>

              {/* Password */}
              <div>
                <label style={labelStyle}>Password <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input id="field-password" type={showPassword ? "text" : "password"} value={form.password} onChange={setField('password')} style={{ ...inp('password'), paddingRight: '40px' }} placeholder="Enter password" />
                  <div 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#64748b' }}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </div>
                </div>
                {errors.password && <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: 3 }}>⚠ {errors.password}</div>}
              </div>



              {/* Phone */}
              <div>
                <label style={labelStyle}>Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
                <input id="field-phone" type="tel" value={form.phone} onChange={handlePhoneChange} style={inp('phone')} placeholder="10-digit number" />
                {errors.phone && <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: 3 }}>⚠ {errors.phone}</div>}
              </div>

              {/* Email */}
              <div style={{ gridColumn: 'span 2' }}>
                
                <label style={labelStyle}>Email ID <span style={{ color: '#ef4444' }}>*</span></label>
                <input id="field-email" type="email" value={form.email} onChange={setField('email')} style={inp('email')} placeholder="user@example.com" />
                {errors.email && <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: 3 }}>⚠ {errors.email}</div>}
              </div>

              {/* Created By */}
              <div>
                <label style={labelStyle}>Created By</label>
                <input value={formMode === 'edit' ? (users[editIndex]?.createdBy || '—') : currentUser} readOnly style={readonlyInp} />
              </div>

              {/* Created On */}
              <div>
                <label style={labelStyle}>Created On</label>
                <input value={formMode === 'edit' ? (users[editIndex]?.createdOn || '—') : '(auto on save)'} readOnly style={{ ...readonlyInp, fontStyle: 'italic' }} />
              </div>

              {/* Updated By */}
              <div>
                <label style={labelStyle}>Updated By</label>
                <input value={formMode === 'edit' ? currentUser : '—'} readOnly style={readonlyInp} />
              </div>

              {/* Updated On */}
              <div>
                <label style={labelStyle}>Updated On</label>
                <input value={formMode === 'edit' ? '(auto on save)' : '—'} readOnly style={{ ...readonlyInp, fontStyle: 'italic' }} />
              </div>
            </div>

            {/* Form Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
              <button type="button" onClick={closeForm}
                style={{ padding: '0.55rem 1.1rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 9, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', color: '#475569' }}>
                Cancel
              </button>
              <button type="submit"
                style={{ padding: '0.55rem 1.35rem', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79,70,229,0.25)' }}>
                {formMode === 'add' ? '➕ Add User' : '💾 Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Users Table ── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                {['Photo', 'ID', 'Emp. Name', 'Designation', 'User Type', 'Username', 'Phone', 'Email', 'Created', 'Updated', 'Actions'].map(h => (
                  <th key={h} style={{
                    background: '#f8fafc', padding: '10px 14px',
                    borderBottom: '1px solid #e2e8f0', textAlign: 'left',
                    fontWeight: 700, color: '#475569', fontSize: '0.72rem',
                    textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>👤</div>
                    <div style={{ fontWeight: 700, color: '#475569', marginBottom: 4 }}>No users found</div>
                    <div style={{ fontSize: '0.8rem' }}>Click <strong>+ Add User</strong> above to get started.</div>
                  </td>
                </tr>
              ) : filtered.map((u, i) => {
                const realIdx = users.indexOf(u);
                const td = { padding: '12px 14px', borderBottom: '1px solid #f1f5f9', color: '#334155', verticalAlign: 'middle' };
                return (
                  <tr key={u.id || i}>
                    <td style={td}>
                      {u.photo
                        ? <img src={u.photo} alt={u.username} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
                        : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.8rem', border: '2px solid #e2e8f0' }}>
                          {u.username?.[0]?.toUpperCase() || '?'}
                        </div>
                      }
                    </td>
                    <td style={td}>
                      <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 5, fontSize: '0.72rem', color: '#4f46e5' }}>{u.id}</code>
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{u.employeeName || '—'}</div>
                    </td>
                    <td style={td}>{u.designation || '—'}</td>
                    <td style={td}>
                      {u.userType ? (
                        <span style={{ background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600, border: '1px solid #bbf7d0' }}>
                          {u.userType}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: '#475569' }}>{u.username}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{'•'.repeat(Math.min(u.password?.length || 4, 8))}</div>
                    </td>
                    
                    <td style={td}>{u.phone || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                    <td style={td}>
                      <a href={`mailto:${u.email}`} style={{ color: '#4f46e5', textDecoration: 'none', fontSize: '0.8rem' }}>{u.email}</a>
                    </td>
                    <td style={td}>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.5 }}>
                        <div style={{ fontWeight: 600 }}>{u.createdBy}</div>
                        <div>{u.createdOn}</div>
                      </div>
                    </td>
                    <td style={td}>
                      {u.updatedBy
                        ? <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.5 }}>
                          <div style={{ fontWeight: 600 }}>{u.updatedBy}</div>
                          <div>{u.updatedOn}</div>
                        </div>
                        : <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>—</span>
                      }
                    </td>
                    <td style={td}>
                      <button onClick={() => openEdit(realIdx)}
                        style={{ padding: '4px 10px', background: 'rgba(79,70,229,0.08)', color: '#4f46e5', border: '1px solid rgba(79,70,229,0.18)', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', marginRight: 4 }}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(realIdx)}
                        style={{ padding: '4px 10px', background: 'rgba(220,38,38,0.07)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
