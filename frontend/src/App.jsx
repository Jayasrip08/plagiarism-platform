import { useState, useEffect } from 'react'
import { getUserProfile, loginUser, registerUser, googleLoginUser } from './api'
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
  const [authError, setAuthError] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);

  useEffect(() => {
    // Check local storage for existing session
    const currentUser = getUserProfile();
    if (currentUser) {
      setUser(currentUser);
    }
    setLoading(false);
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSubmittingAuth(true);

    try {
      if (isLogin) {
        const loggedInUser = await loginUser(username, password);
        setUser(loggedInUser);
      } else {
        await registerUser(username, email, password, phone);
        alert("Registration successful! Please login with your credentials.");
        setIsLogin(true);
        setPassword('');
      }
    } catch (e) {
      console.error("Authentication failed", e);
      setAuthError(e.response?.data?.detail || e.response?.data?.error || "Invalid credentials or registration error. Please check values.");
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setSubmittingAuth(true);
    try {
      // Mock Google OAuth login
      const mockEmail = "google_researcher@gmail.com";
      const mockName = "Google Researcher";
      const loggedInUser = await googleLoginUser(mockEmail, mockName);
      setUser(loggedInUser);
      alert("Successfully logged in via Google OAuth mock!");
    } catch (e) {
      console.error("Google login failed", e);
      setAuthError("Google OAuth login failed.");
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Quick Login Assist for reviewers
  const handleQuickLogin = async (role) => {
    setAuthError('');
    setSubmittingAuth(true);
    try {
      let u = '', p = '';
      if (role === 'super') {
        u = 'admin'; p = 'admin123';
      } else if (role === 'college') {
        u = 'college_admin'; p = 'admin123';
      } else if (role === 'b2b_student') {
        u = 'b2b_student'; p = 'student123';
      } else if (role === 'b2c_student') {
        u = 'student_b2c'; p = 'student123';
      }
      
      const loggedInUser = await loginUser(u, p);
      setUser(loggedInUser);
      setUsername(u);
    } catch (e) {
      console.error("Quick login failed", e);
      setAuthError("Quick login failed. Make sure database is seeded.");
    } finally {
      setSubmittingAuth(false);
    }
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
      return <AdminPortal user={user} />;
    } else if (user.role === 'college_admin') {
      return <CollegePortal user={user} />;
    } else {
      return <StudentPortal user={user} />;
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(circle at top right, rgba(109, 40, 217, 0.1) 0%, rgba(10, 11, 16, 1) 70%)' }}>
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Logo and Header */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '40px', fontWeight: '800', background: 'linear-gradient(135deg, #fff 0%, var(--secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 8px' }}>
            PlagShield
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
            Enterprise Plagiarism Audits & Turnitin Verification
          </p>
        </div>

        {/* Main Auth Form Card */}
        <div className="glass-card">
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', paddingBottom: '8px' }}>
            <button 
              className="btn btn-secondary" 
              style={{ flex: 1, background: isLogin ? 'var(--bg-tertiary)' : 'none', border: 'none', color: isLogin ? '#fff' : 'var(--text-muted)' }}
              onClick={() => { setIsLogin(true); setAuthError(''); }}
            >
              Sign In
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ flex: 1, background: !isLogin ? 'var(--bg-tertiary)' : 'none', border: 'none', color: !isLogin ? '#fff' : 'var(--text-muted)' }}
              onClick={() => { setIsLogin(false); setAuthError(''); }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {authError && (
              <div style={{ color: 'var(--danger)', fontSize: '13px', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'left' }}>
                {authError}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '0' }}>
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="form-control" 
                required 
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {!isLogin && (
              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  required 
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '0' }}>
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-control" 
                required 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {!isLogin && (
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label">Phone Number (WhatsApp alerts)</label>
                <input 
                  type="tel" 
                  className="form-control" 
                  placeholder="e.g. +919876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={submittingAuth}>
              {submittingAuth ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                  Authenticating...
                </div>
              ) : (
                isLogin ? "Sign In to Portal" : "Create Account"
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: 'var(--text-dark)', fontSize: '12px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
            <span style={{ padding: '0 8px' }}>OR</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
          </div>

          {/* Google OAuth Login Button */}
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            onClick={handleGoogleLogin}
            disabled={submittingAuth}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V13.4h6.887c-.648 2.41-2.519 4.155-5.267 4.155-3.327 0-6.027-2.7-6.027-6.027s2.7-6.027 6.027-6.027c1.554 0 2.946.586 4.009 1.545l2.427-2.427C18.663 3.036 15.655 2 12.24 2 6.584 2 2 6.584 2 12.24s4.584 10.24 10.24 10.24c5.795 0 10.254-4.074 10.254-10.24 0-.695-.081-1.355-.223-1.955H12.24z"/>
            </svg>
            Continue with Google OAuth
          </button>
        </div>

        {/* Quick Login Assist Panel */}
        <div className="glass-card" style={{ padding: '16px', border: '1px dashed var(--border-color)' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Developer Quick Login
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button className="btn btn-secondary" style={{ padding: '6px', fontSize: '11px' }} onClick={() => handleQuickLogin('super')}>
              Super Admin
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px', fontSize: '11px' }} onClick={() => handleQuickLogin('college')}>
              College Admin
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px', fontSize: '11px' }} onClick={() => handleQuickLogin('b2b_student')}>
              B2B Student
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px', fontSize: '11px' }} onClick={() => handleQuickLogin('b2c_student')}>
              B2C Student
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App
