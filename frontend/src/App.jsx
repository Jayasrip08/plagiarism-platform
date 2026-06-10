import { useState, useEffect, useCallback, useRef } from 'react'
import api, { getUserProfile, loginUser, registerUser, googleLoginUser } from './api'
import StudentPortal from './StudentPortal'
import CollegePortal from './CollegePortal'
import AdminPortal from './AdminPortal'

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLogin, setIsLogin] = useState(true);
  
  // Auth Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('b2c_student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [department, setDepartment] = useState('');
  const [departmentOption, setDepartmentOption] = useState('');
  const [authError, setAuthError] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [colleges, setColleges] = useState([]);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const [googleSdkLoaded, setGoogleSdkLoaded] = useState(false);
  const [showGoogleRoleModal, setShowGoogleRoleModal] = useState(false);
  const [googleRoleForSignup, setGoogleRoleForSignup] = useState('b2c_student');
  const [googleCollegeIdForSignup, setGoogleCollegeIdForSignup] = useState('');
  const [googleDepartmentForSignup, setGoogleDepartmentForSignup] = useState('');
  const [googleAdminSecretForSignup, setGoogleAdminSecretForSignup] = useState('');
  const googleRoleRef = useRef(googleRoleForSignup);
  const googleCollegeIdRef = useRef(googleCollegeIdForSignup);
  const googleDepartmentRef = useRef(googleDepartmentForSignup);
  const googleAdminSecretRef = useRef(googleAdminSecretForSignup);

  useEffect(() => {
    if (role !== 'b2b_student' && role !== 'college_admin') {
      setCollegeId('');
    }
    if (role !== 'b2b_student') {
      setDepartment('');
    }
    if (role !== 'super_admin') {
      setAdminSecret('');
    }
  }, [role]);

  useEffect(() => {
    // Check local storage for existing session
    const currentUser = getUserProfile();
    if (currentUser) {
      setUser(currentUser);
    }
    setLoading(false);

    // Fetch colleges list
    api.get('colleges/')
      .then((res) => {
        setColleges(res.data || []);
      })
      .catch((err) => {
        console.error("Failed to load colleges for registration", err);
      });
  }, []);

  const decodeGoogleJwt = (token) => {
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const json = decodeURIComponent(decoded.split('').map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`).join(''));
      return JSON.parse(json);
    } catch (error) {
      return null;
    }
  };

  const validateGmail = (value) => /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(value);
  const validateName = (value) => /^[A-Za-z]+$/.test(value);
  const validatePhone = (value) => /^\d{10}$/.test(value);
  const validatePassword = (value) => /^(?=.{8}$)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])[A-Z][A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{7}$/.test(value);

  const extractApiErrorMessage = (error) => {
    const data = error?.response?.data;
    if (!data) {
      return error?.message || 'Invalid credentials or registration error. Please check values.';
    }
    if (typeof data === 'string') {
      return data;
    }
    if (data.detail) {
      return data.detail;
    }
    if (data.error) {
      return data.error;
    }

    const messages = [];
    const addValue = (value) => {
      if (Array.isArray(value)) {
        messages.push(value.join(' '));
      } else if (typeof value === 'string') {
        messages.push(value);
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(addValue);
      }
    };

    addValue(data);
    return messages.filter(Boolean).join(' ') || 'Invalid credentials or registration error. Please check values.';
  };

  const handleGoogleCredentialResponse = useCallback(async (credentialResponse) => {
    setAuthError('');
    setSubmittingAuth(true);

    try {
      const payload = decodeGoogleJwt(credentialResponse.credential);
      if (!payload?.email) {
        throw new Error('Unable to read Google account email.');
      }

      const loggedInUser = await googleLoginUser({
        email: payload.email,
        name: payload.name || payload.given_name || '',
        mode: isLogin ? 'login' : 'register',
        role: isLogin ? undefined : googleRoleRef.current,
        college_id: !isLogin && (googleRoleRef.current === 'b2b_student' || googleRoleRef.current === 'college_admin') ? googleCollegeIdRef.current || undefined : undefined,
        department: !isLogin && googleRoleRef.current === 'b2b_student' ? googleDepartmentRef.current || undefined : undefined,
        admin_secret: !isLogin && googleRoleRef.current === 'super_admin' ? googleAdminSecretRef.current || undefined : undefined,
      });
      setUser(loggedInUser);
      setShowGoogleRoleModal(false);
    } catch (e) {
      console.error('Google login failed', e);
      const apiErr = extractApiErrorMessage(e);
      if (isLogin && (apiErr?.includes('No account found') || e.message?.includes('No account found'))) {
        setIsLogin(false);
        setShowGoogleRoleModal(true);
        setAuthError('No account found for this Google email. Please select a role to register.');
      } else {
        setAuthError(apiErr || e.message || 'Google OAuth login failed.');
      }
    } finally {
      setSubmittingAuth(false);
    }
  }, [isLogin]);

  useEffect(() => {
    if (!googleClientId) {
      return;
    }

    const initGoogleSdk = () => {
      if (!window.google?.accounts?.id) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
        ux_mode: 'popup',
        cancel_on_tap_outside: true,
      });
      setGoogleSdkLoaded(true);
    };

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (window.google?.accounts?.id) {
      initGoogleSdk();
      return;
    }

    if (existingScript) {
      existingScript.addEventListener('load', initGoogleSdk);
      existingScript.addEventListener('error', () => {
        console.error('Failed to load Google OAuth script.');
        setAuthError('Failed to load Google OAuth SDK. Reload the page and try again.');
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogleSdk;
    script.onerror = () => {
      console.error('Failed to load Google OAuth script.');
      setAuthError('Failed to load Google OAuth SDK. Reload the page and try again.');
    };
    document.body.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [googleClientId, handleGoogleCredentialResponse]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSubmittingAuth(true);

    try {
      if (isLogin) {
        const loggedInUser = await loginUser(username, password);
        setUser(loggedInUser);
      } else {
        if (!validateGmail(email)) {
          setAuthError('Please enter a valid Gmail address ending with @gmail.com.');
          setSubmittingAuth(false);
          return;
        }
        if (!validatePassword(password)) {
          setAuthError('Password must be exactly 8 characters, start with an uppercase letter, and include at least one special character.');
          setSubmittingAuth(false);
          return;
        }
        if (firstName && !validateName(firstName)) {
          setAuthError('First name may only contain letters.');
          setSubmittingAuth(false);
          return;
        }
        if (lastName && !validateName(lastName)) {
          setAuthError('Last name may only contain letters.');
          setSubmittingAuth(false);
          return;
        }
        if (phone && !validatePhone(phone)) {
          setAuthError('Phone number must be exactly 10 digits.');
          setSubmittingAuth(false);
          return;
        }

        const payload = {
          username,
          email,
          password,
          phone: phone ? `+91${phone}` : undefined,
          role,
          first_name: firstName,
          last_name: lastName,
        };

        if (role === 'college_admin' || role === 'b2b_student') {
          payload.college_id = collegeId || undefined;
        }
        if (role === 'b2b_student') {
          payload.department = department || undefined;
        }
        if (role === 'super_admin') {
          payload.admin_secret = adminSecret || undefined;
        }

        await registerUser(payload);
        alert("Registration successful! Please login with your credentials.");
        setIsLogin(true);
        setPassword('');
        setRole('b2c_student');
        setFirstName('');
        setLastName('');
        setCollegeId('');
        setAdminSecret('');
        setDepartment('');
      }
    } catch (e) {
      console.error("Authentication failed", e);
      setAuthError(extractApiErrorMessage(e));
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleGoogleLogin = () => {
    setAuthError('');
    if (!googleClientId) {
      setAuthError('Google OAuth is not configured. Set VITE_GOOGLE_CLIENT_ID in frontend/.env.');
      return;
    }

    if (!window.google?.accounts?.id) {
      setAuthError('Google OAuth SDK is still loading. Refresh the page and try again.');
      return;
    }

    if (isLogin) {
      // On login, just sign in with the Google account and redirect to the existing role portal.
      window.google.accounts.id.prompt();
    } else {
      // On registration, allow selecting a role first.
      setShowGoogleRoleModal(true);
    }
  };

  const handleGoogleRoleConfirm = () => {
    if (!window.google?.accounts?.id) {
      setAuthError('Google OAuth SDK is still loading.');
      return;
    }

    window.google.accounts.id.prompt();
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading PlagShield Platform...</p>
      </div>
    );
  }

  // Render Portal according to role
  if (user) {
    if (user.role === 'super_admin') {
      return <AdminPortal user={user} setUser={setUser} />;
    } else if (user.role === 'college_admin') {
      return <CollegePortal user={user} setUser={setUser} />;
    } else {
      return <StudentPortal user={user} setUser={setUser} />;
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-container">

        <div className="auth-card glass-card">
          
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '24px', fontWeight: '800', color: 'var(--primary)', marginBottom: '4px' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              PlagShield
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
              {isLogin
                ? 'Sign in to access your portal'
                : 'Create your account and select a role'
              }
            </p>
          </div>

          <div className="auth-tab-group">
            <button
              type="button"
              className={isLogin ? 'active' : ''}
              onClick={() => { setIsLogin(true); setAuthError(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={!isLogin ? 'active' : ''}
              onClick={() => { setIsLogin(false); setAuthError(''); }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            
            {authError && (
              <div className="auth-alert" style={{ padding: '10px 14px', margin: '4px 0' }}>
                {authError}
              </div>
            )}

            {isLogin ? (
              <>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">User ID or Email</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    required 
                    placeholder="Enter user ID or email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ height: '38px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Password</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    required 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ height: '38px' }}
                  />
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label">First Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="First name"
                      value={firstName}
                      required
                      onChange={(e) => setFirstName(e.target.value.replace(/[^A-Za-z]/g, ''))}
                      style={{ height: '38px' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label">Last Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Last name"
                      value={lastName}
                      required
                      onChange={(e) => setLastName(e.target.value.replace(/[^A-Za-z]/g, ''))}
                      style={{ height: '38px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label">User ID</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      required 
                      placeholder="Choose User ID"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      style={{ height: '38px' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      required 
                      placeholder="name@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ height: '38px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label">Password</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      required 
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ height: '38px' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label">Phone (WhatsApp)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '38px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>
                        +91
                      </span>
                      <input 
                        type="tel" 
                        className="form-control" 
                        required
                        placeholder="10-digit number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        style={{ flex: 1, minWidth: 0, height: '38px' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: (role === 'college_admin' || role === 'b2b_student') ? '1fr 1fr' : '1fr', gap: '8px' }}>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label">Role</label>
                    <select
                      className="form-control"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', height: '38px', fontSize: '13px' }}
                    >
                      <option value="b2c_student">B2C Student</option>
                      <option value="b2b_student">B2B Student</option>
                      <option value="college_admin">College Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>

                  {(role === 'college_admin' || role === 'b2b_student') && (
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label">College Name</label>
                      <select
                        className="form-control"
                        value={collegeId}
                        onChange={(e) => setCollegeId(e.target.value)}
                        required
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', height: '38px', fontSize: '13px' }}
                      >
                        <option value="">Select College</option>
                        {colleges.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.college_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {role === 'b2b_student' && (
                  <div style={{ display: 'grid', gridTemplateColumns: departmentOption === 'Others' ? '1fr 1fr' : '1fr', gap: '8px' }}>
                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label className="form-label">Department</label>
                      <select
                        className="form-control"
                        value={departmentOption}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDepartmentOption(value);
                          if (value === 'Others') {
                            setDepartment('');
                          } else {
                            setDepartment(value);
                          }
                        }}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', height: '38px', fontSize: '13px' }}
                      >
                        <option value="">Select Department (Optional)</option>
                        <option value="Computer Science">Computer Science</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Mechanical">Mechanical</option>
                        <option value="Business">Business</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                    {departmentOption === 'Others' && (
                      <div className="form-group" style={{ marginBottom: '0' }}>
                        <label className="form-label">Enter Department</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Your department (optional)"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          style={{ height: '38px' }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {role === 'super_admin' && (
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label">Admin Secret</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Enter admin secret"
                      required
                      value={adminSecret}
                      onChange={(e) => setAdminSecret(e.target.value)}
                      style={{ height: '38px' }}
                    />
                  </div>
                )}

                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0' }}>
                  Password requirements: 8 characters, starting with uppercase, containing at least one special character.
                </p>
              </>
            )}

            <button type="submit" className="btn btn-primary auth-btn-full" disabled={submittingAuth} style={{ height: '40px', fontSize: '14px', marginTop: '6px' }}>
              {submittingAuth ? (
                <div className="btn-loading">
                  <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                  Authenticating...
                </div>
              ) : (
                isLogin ? "Sign In to Portal" : "Create Account"
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          <button 
            type="button" 
            className="btn btn-secondary auth-btn-full oauth-btn" 
            onClick={handleGoogleLogin}
            disabled={submittingAuth || !googleClientId || !googleSdkLoaded}
            style={{ height: '40px', fontSize: '14px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V13.4h6.887c-.648 2.41-2.519 4.155-5.267 4.155-3.327 0-6.027-2.7-6.027-6.027s2.7-6.027 6.027-6.027c1.554 0 2.946.586 4.009 1.545l2.427-2.427C18.663 3.036 15.655 2 12.24 2 6.584 2 2 6.584 2 12.24s4.584 10.24 10.24 10.24c5.795 0 10.254-4.074 10.254-10.24 0-.695-.081-1.355-.223-1.955H12.24z"/>
            </svg>
            Continue with Google OAuth
          </button>
          {(!googleClientId || !googleSdkLoaded) && (
            <p className="auth-hint">
              {!googleClientId
                ? <>Google OAuth is unavailable until you set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>frontend/.env</code>.</>
                : 'Loading Google OAuth SDK...'
              }
            </p>
          )}

          <p className="auth-footer">
            {isLogin ? (
              <>New here? <button type="button" onClick={() => { setIsLogin(false); setAuthError(''); }}>Create an account</button></>
            ) : (
              <>Already registered? <button type="button" onClick={() => { setIsLogin(true); setAuthError(''); }}>Sign in instead</button></>
            )}
          </p>
        </div>

        {/* Google Role Selection Modal */}
        {showGoogleRoleModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '400px',
              width: '100%',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              <h2 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: '600' }}>
                Continue with Google
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Select the role for this Google sign-in. If an account already exists for this email, the existing profile will be used.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                    Select Role
                  </label>
                  <select
                    value={googleRoleForSignup}
                    onChange={(e) => {
                      setGoogleRoleForSignup(e.target.value);
                      googleRoleRef.current = e.target.value;
                      setGoogleCollegeIdForSignup('');
                      googleCollegeIdRef.current = '';
                      setGoogleDepartmentForSignup('');
                      googleDepartmentRef.current = '';
                      setGoogleAdminSecretForSignup('');
                      googleAdminSecretRef.current = '';
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="b2c_student">B2C Student</option>
                    <option value="b2b_student">B2B Student</option>
                    <option value="college_admin">College Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                {googleRoleForSignup === 'super_admin' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                      Admin Secret
                    </label>
                    <input
                      type="password"
                      value={googleAdminSecretForSignup}
                      onChange={(e) => {
                        setGoogleAdminSecretForSignup(e.target.value);
                        googleAdminSecretRef.current = e.target.value;
                      }}
                      placeholder="Enter admin secret"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                )}

                {(googleRoleForSignup === 'college_admin' || googleRoleForSignup === 'b2b_student') && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                      College Name
                    </label>
                    <select
                      value={googleCollegeIdForSignup}
                      onChange={(e) => {
                        setGoogleCollegeIdForSignup(e.target.value);
                        googleCollegeIdRef.current = e.target.value;
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">Select College</option>
                      {colleges.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.college_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {googleRoleForSignup === 'b2b_student' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                      Department
                    </label>
                    <input
                      type="text"
                      value={googleDepartmentForSignup}
                      onChange={(e) => {
                        setGoogleDepartmentForSignup(e.target.value);
                        googleDepartmentRef.current = e.target.value;
                      }}
                      placeholder="Your department (optional)"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                )}

                {authError && (
                  <div className="auth-alert" style={{ marginBottom: '10px' }}>
                    {authError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowGoogleRoleModal(false)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGoogleRoleConfirm}
                    disabled={submittingAuth || ((googleRoleForSignup === 'college_admin' || googleRoleForSignup === 'b2b_student') && !googleCollegeIdForSignup) || (googleRoleForSignup === 'super_admin' && !googleAdminSecretForSignup)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '14px',
                      opacity: (submittingAuth || ((googleRoleForSignup === 'college_admin' || googleRoleForSignup === 'b2b_student') && !googleCollegeIdForSignup) || (googleRoleForSignup === 'super_admin' && !googleAdminSecretForSignup)) ? 0.6 : 1
                    }}
                  >
                    {submittingAuth ? 'Authenticating...' : 'Continue with Google'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App
