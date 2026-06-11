import { useState, useEffect } from 'react';
import { API_URL } from './config';

const DEPT_TYPES = ['Clinic', 'Non-Clinic'];

const nowStr = () =>
  new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const EMPTY_FORM = {
  code: '',
  name: '',
  type: DEPT_TYPES[0],
};

const TYPE_COLORS = {
  Clinic:     { bg: '#ecfdf5', text: '#065f46', border: '#6ee7b7' },
  'Non-Clinic': { bg: '#eff6ff', text: '#1d4ed8', border: '#93c5fd' },
};

export default function DepartmentsPanel() {
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/departments`)
      .then(res => res.json())
      .then(data => setDepartments(data))
      .catch(err => console.error("Failed to fetch departments", err));
  }, []);

  const [formMode, setFormMode]   = useState('hidden'); // 'hidden' | 'add' | 'edit'
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [search, setSearch]       = useState('');
  const [errors, setErrors]       = useState({});

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('medflow_currentSession') || '{}')?.loginId || 'System'; }
    catch { return 'System'; }
  })();

  // Persist function removed in favor of API calls

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setEditIndex(null);
    setErrors({});
    setFormMode('add');
  };

  const openEdit = (idx) => {
    setForm({ code: departments[idx].code, name: departments[idx].name, type: departments[idx].type });
    setEditIndex(idx);
    setErrors({});
    setFormMode('edit');
  };

  const closeForm = () => { setFormMode('hidden'); setErrors({}); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Department name is required';
    if (!form.code.trim()) e.code = 'Department code is required';
    if (departments.some((d, i) =>
      d.name.toLowerCase() === form.name.trim().toLowerCase() && i !== editIndex
    )) e.name = 'Department name already exists';
    if (departments.some((d, i) =>
      d.code.toLowerCase() === form.code.trim().toLowerCase() && i !== editIndex
    )) e.code = 'Department code already exists';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const ts = nowStr();
    try {
      if (formMode === 'add') {
        const payload = {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          type: form.type,
          createdBy: currentUser,
          createdOn: ts,
          updatedBy: '',
          updatedOn: '',
        };
        const res = await fetch(`${API_URL}/api/departments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Failed to add department");
        const saved = await res.json();
        setDepartments([saved, ...departments]);
      } else {
        const d = departments[editIndex];
        const payload = { ...d, code: form.code.trim().toUpperCase(), name: form.name.trim(), type: form.type, updatedBy: currentUser, updatedOn: ts };
        const res = await fetch(`${API_URL}/api/departments/${d._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Failed to update department");
        const updated = await res.json();
        setDepartments(departments.map((dept, i) => i === editIndex ? updated : dept));
      }
      closeForm();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (idx) => {
    const d = departments[idx];
    if (!window.confirm(`Delete department "${d.name}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/departments/${d._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete department");
      setDepartments(departments.filter((_, i) => i !== idx));
    } catch (err) {
      alert(err.message);
    }
  };

  const setField = (name) => (e) => setForm(f => ({ ...f, [name]: e.target.value }));

  const filtered = departments.filter(d =>
    [d.code, d.name, d.type].join(' ').toLowerCase().includes(search.toLowerCase())
  );

  /* ─── Shared Styles ─── */
  const labelSt = {
    display: 'block', fontSize: '0.72rem', fontWeight: 700,
    color: '#475569', marginBottom: 5,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  const inpSt = (name) => ({
    width: '100%', padding: '0.55rem 0.85rem',
    border: `1px solid ${errors[name] ? '#ef4444' : '#cbd5e1'}`,
    borderRadius: 9, fontSize: '0.85rem', outline: 'none',
    boxSizing: 'border-box', background: '#fff',
  });

  const readSt = {
    width: '100%', padding: '0.55rem 0.85rem',
    border: '1px solid #e2e8f0', borderRadius: 9,
    fontSize: '0.85rem', background: '#f8fafc',
    color: '#94a3b8', boxSizing: 'border-box', cursor: 'not-allowed',
  };

  const thSt = {
    background: '#f8fafc', padding: '10px 14px',
    borderBottom: '1px solid #e2e8f0', textAlign: 'left',
    fontWeight: 700, color: '#475569', fontSize: '0.72rem',
    textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
  };

  const tdSt = {
    padding: '12px 14px', borderBottom: '1px solid #f1f5f9',
    color: '#334155', verticalAlign: 'middle',
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }} className="animate-fade-in">

      {/* ── Page Header ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Departments</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '4px 0 0' }}>
          Manage hospital departments — clinic and non-clinic units.
        </p>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          id="dept-search"
          placeholder="🔍  Search by name, code or type…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 180, padding: '0.5rem 0.85rem',
            border: '1px solid #cbd5e1', borderRadius: 10,
            fontSize: '0.85rem', outline: 'none', background: '#f8fafc',
          }}
        />
        <span style={{ color: '#94a3b8', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
          {filtered.length} dept{filtered.length !== 1 ? 's' : ''}
        </span>
        <button
          id="add-dept-btn"
          onClick={formMode === 'add' ? closeForm : openAdd}
          style={{
            padding: '0.55rem 1.2rem',
            background: formMode === 'add'
              ? 'linear-gradient(135deg,#dc2626,#ef4444)'
              : 'linear-gradient(135deg,#0ea5e9,#6366f1)',
            color: '#fff', border: 'none', borderRadius: 10,
            fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 4px 12px rgba(14,165,233,0.22)',
          }}
        >
          {formMode === 'add' ? '✕ Cancel' : '+ Add Department'}
        </button>
      </div>

      {/* ── Inline Form (Add / Edit) ── */}
      {formMode !== 'hidden' && (
        <div style={{
          background: '#fff', border: '1px solid #bae6fd',
          borderRadius: 16, marginBottom: '1.5rem',
          boxShadow: '0 8px 24px rgba(14,165,233,0.10)',
          overflow: 'hidden',
        }}>
          {/* Form Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            background: 'linear-gradient(135deg,#0ea5e9,#6366f1)',
          }}>
            <span style={{ fontWeight: 800, color: '#fff', fontSize: '1rem' }}>
              {formMode === 'add' ? '🏥 Add New Department' : '✏️ Edit Department'}
            </span>
            <button
              onClick={closeForm}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: '1rem' }}
            >✕</button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>

              {/* Department Code */}
              <div>
                <label style={labelSt}>Department Code <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  id="field-dept-code"
                  value={form.code}
                  onChange={setField('code')}
                  placeholder="e.g. CARD-01"
                  style={inpSt('code')}
                />
                {errors.code && <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: 3 }}>⚠ {errors.code}</div>}
              </div>

              {/* Department Name */}
              <div>
                <label style={labelSt}>Department Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  id="field-dept-name"
                  value={form.name}
                  onChange={setField('name')}
                  placeholder="e.g. Cardiology"
                  style={inpSt('name')}
                />
                {errors.name && <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: 3 }}>⚠ {errors.name}</div>}
              </div>

              {/* Department Type */}
              <div>
                <label style={labelSt}>Department Type</label>
                <select
                  id="field-dept-type"
                  value={form.type}
                  onChange={setField('type')}
                  style={inpSt('')}
                >
                  {DEPT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* Created By */}
              <div>
                <label style={labelSt}>Created By</label>
                <input
                  value={formMode === 'edit' ? (departments[editIndex]?.createdBy || '—') : currentUser}
                  readOnly style={readSt}
                />
              </div>

              {/* Created On */}
              <div>
                <label style={labelSt}>Created On</label>
                <input
                  value={formMode === 'edit' ? (departments[editIndex]?.createdOn || '—') : '(auto on save)'}
                  readOnly style={{ ...readSt, fontStyle: 'italic' }}
                />
              </div>

              {/* Updated By */}
              <div>
                <label style={labelSt}>Updated By</label>
                <input
                  value={formMode === 'edit' ? currentUser : '—'}
                  readOnly style={readSt}
                />
              </div>

              {/* Updated On */}
              <div>
                <label style={labelSt}>Updated On</label>
                <input
                  value={formMode === 'edit' ? '(auto on save)' : '—'}
                  readOnly style={{ ...readSt, fontStyle: 'italic' }}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
              <button type="button" onClick={closeForm}
                style={{ padding: '0.55rem 1.1rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 9, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', color: '#475569' }}>
                Cancel
              </button>
              <button type="submit"
                style={{ padding: '0.55rem 1.35rem', background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(14,165,233,0.25)' }}>
                {formMode === 'add' ? '➕ Add Department' : '💾 Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Departments Table ── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                {['#', 'Dept Code', 'Department Name', 'Type', 'Created By', 'Created On', 'Updated By', 'Updated On', 'Actions'].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏥</div>
                    <div style={{ fontWeight: 700, color: '#475569', marginBottom: 4 }}>No departments found</div>
                    <div style={{ fontSize: '0.8rem' }}>Click <strong>+ Add Department</strong> above to get started.</div>
                  </td>
                </tr>
              ) : filtered.map((d, i) => {
                const realIdx = departments.indexOf(d);
                const tc = TYPE_COLORS[d.type] || TYPE_COLORS['Clinic'];
                return (
                  <tr key={d.code + i}>
                    {/* # */}
                    <td style={{ ...tdSt, color: '#94a3b8', fontWeight: 700 }}>{realIdx + 1}</td>

                    {/* Code */}
                    <td style={tdSt}>
                      <code style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 5, fontSize: '0.75rem', fontWeight: 700 }}>
                        {d.code}
                      </code>
                    </td>

                    {/* Name */}
                    <td style={tdSt}>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{d.name}</span>
                    </td>

                    {/* Type Badge */}
                    <td style={tdSt}>
                      <span style={{
                        background: tc.bg, color: tc.text,
                        border: `1px solid ${tc.border}`,
                        borderRadius: 20, padding: '3px 10px',
                        fontSize: '0.72rem', fontWeight: 700,
                      }}>
                        {d.type === 'Clinic' ? '🏥' : '🗂️'} {d.type}
                      </span>
                    </td>

                    {/* Created By */}
                    <td style={tdSt}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{d.createdBy || '—'}</span>
                    </td>

                    {/* Created On */}
                    <td style={tdSt}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{d.createdOn || '—'}</span>
                    </td>

                    {/* Updated By */}
                    <td style={tdSt}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{d.updatedBy || <span style={{ color: '#cbd5e1' }}>—</span>}</span>
                    </td>

                    {/* Updated On */}
                    <td style={tdSt}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{d.updatedOn || <span style={{ color: '#cbd5e1' }}>—</span>}</span>
                    </td>

                    {/* Actions */}
                    <td style={tdSt}>
                      <button onClick={() => openEdit(realIdx)}
                        style={{ padding: '4px 10px', background: 'rgba(14,165,233,0.08)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', marginRight: 4 }}>
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
