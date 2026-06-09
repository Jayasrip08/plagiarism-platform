import React, { useState, useEffect } from 'react';
import api from './api';

export default function ProfilePage({ user, onProfileUpdate }) {
  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    department: user?.department || '',
    password: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('accounts/profile/');
        setForm({
          username: res.data.username || '',
          email: res.data.email || '',
          first_name: res.data.first_name || '',
          last_name: res.data.last_name || '',
          phone: res.data.phone || '',
          department: res.data.department || '',
          password: '',
        });
      } catch (e) {
        console.error('Unable to load profile', e);
        setError('Unable to load profile information.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const validatePassword = (value) => /^(?=.{8}$)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])[A-Z][A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{7}$/.test(value);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    if (form.password && !validatePassword(form.password)) {
      setError('Password must be exactly 8 characters, start with an uppercase letter, and include at least one special character.');
      setSaving(false);
      return;
    }
    try {
      const payload = {
        username: form.username,
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        department: form.department,
      };
      if (form.password) {
        payload.password = form.password;
      }

      const updated = await api.put('accounts/profile/', payload);
      setForm((prev) => ({ ...prev, password: '' }));
      setMessage('Profile updated successfully.');
      window.localStorage.setItem('user', JSON.stringify(updated));
      if (onProfileUpdate) {
        onProfileUpdate(updated);
      }
    } catch (e) {
      console.error('Profile save failed', e);
      setError(e.response?.data?.error || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <div className="spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '720px', width: '100%' }}>
      <h2 style={{ marginBottom: '12px' }}>My Profile</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Edit your login identifier and password here.
      </p>
      {message && <div style={{ marginBottom: '16px', color: 'var(--success)' }}>{message}</div>}
      {error && <div style={{ marginBottom: '16px', color: 'var(--danger)' }}>{error}</div>}
      <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">User ID</label>
          <input
            type="text"
            className="form-control"
            value={form.username}
            onChange={handleChange('username')}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            type="email"
            className="form-control"
            value={form.email}
            onChange={handleChange('email')}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-control"
            value={form.password}
            maxLength={8}
            onChange={handleChange('password')}
            placeholder="Enter new password if you want to change it"
          />
          <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Password must be exactly 8 characters, start with an uppercase letter, and include at least one special character.
          </p>
        </div>
        <div className="form-group">
          <label className="form-label">First Name</label>
          <input
            type="text"
            className="form-control"
            value={form.first_name}
            onChange={handleChange('first_name')}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Last Name</label>
          <input
            type="text"
            className="form-control"
            value={form.last_name}
            onChange={handleChange('last_name')}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input
            type="tel"
            className="form-control"
            value={form.phone}
            onChange={handleChange('phone')}
          />
        </div>
        {form.department !== undefined && (
          <div className="form-group">
            <label className="form-label">Department</label>
            <input
              type="text"
              className="form-control"
              value={form.department}
              onChange={handleChange('department')}
            />
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
