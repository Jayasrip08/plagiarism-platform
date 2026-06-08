import React, { useState, useEffect } from 'react';
import api, { logout } from './api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function CollegePortal({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Student List & Adds
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [newStudent, setNewStudent] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', department: '' });
  const [addingStudent, setAddingStudent] = useState(false);
  
  // CSV Upload State
  const [csvFile, setCsvFile] = useState(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [csvResult, setCsvResult] = useState(null);

  // Submissions Log & Filters
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [filters, setFilters] = useState({ department: '', min_similarity: '', max_similarity: '', start_date: '', end_date: '' });

  useEffect(() => {
    fetchDashboardStats();
    fetchStudents();
    fetchSubmissions();
  }, []);

  const fetchDashboardStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('colleges/dashboard/');
      setStats(res.data);
    } catch (e) {
      console.error("Failed to load dashboard metrics", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const res = await api.get('accounts/students/');
      setStudents(res.data);
    } catch (e) {
      console.error("Failed to fetch students list", e);
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      // Build query parameters
      const params = {};
      if (filters.department) params.department = filters.department;
      if (filters.min_similarity) params.min_similarity = filters.min_similarity;
      if (filters.max_similarity) params.max_similarity = filters.max_similarity;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const res = await api.get('orders/', { params });
      setSubmissions(res.data);
    } catch (e) {
      console.error("Failed to load submissions", e);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleSingleStudentSubmit = async (e) => {
    e.preventDefault();
    setAddingStudent(true);
    try {
      await api.post('accounts/students/create/', newStudent);
      alert(`Student '${newStudent.username}' registered successfully!`);
      setNewStudent({ username: '', email: '', password: '', first_name: '', last_name: '', department: '' });
      fetchStudents();
    } catch (e) {
      console.error("Failed to register student", e);
      alert(e.response?.data?.error || "Error adding student. Make sure username/email are unique.");
    } finally {
      setAddingStudent(false);
    }
  };

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) return;
    setUploadingCsv(true);
    setCsvResult(null);

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await api.post('colleges/upload-students/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setCsvResult(res.data);
      setCsvFile(null);
      fetchStudents();
    } catch (e) {
      console.error("Failed to process CSV file", e);
      alert("Error processing CSV. Check format columns.");
    } finally {
      setUploadingCsv(false);
    }
  };

  const triggerExport = () => {
    if (submissions.length === 0) {
      alert("No submissions matching filters to export.");
      return;
    }
    
    // Construct CSV text
    const headers = ['Order ID', 'Username', 'Email', 'Document Name', 'Date Submitted', 'Department', 'Word Count', 'Similarity Score', 'Status'];
    const rows = submissions.map(s => [
      s.id,
      s.user_details?.username,
      s.user_details?.email,
      s.document.split('/').pop(),
      new Date(s.created_at).toLocaleDateString(),
      s.department || 'General',
      s.word_count,
      s.similarity_score !== null ? `${s.similarity_score}%` : 'Pending',
      s.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `submissions_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchSubmissions();
  };

  const handleFilterClear = () => {
    setFilters({ department: '', min_similarity: '', max_similarity: '', start_date: '', end_date: '' });
    // Fetch directly using empty filters
    api.get('orders/').then(res => setSubmissions(res.data));
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
          College Admin
        </div>
        <div className="sidebar-nav">
          <button 
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard Overview
          </button>
          <button 
            className={`nav-link ${activeTab === 'submissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('submissions')}
          >
            Submissions Audit Log
          </button>
          <button 
            className={`nav-link ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            Student Roster
          </button>
        </div>
        <div style={{ marginTop: 'auto', padding: '16px 0' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            College Name:<br/>
            <strong style={{ color: 'var(--text-main)' }}>{user.college_name || "College"}</strong>
          </div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ padding: '40px', overflowY: 'auto', textAlign: 'left' }}>
        
        {/* TAB 1: OVERVIEW DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            <h2 style={{ fontSize: '30px', marginBottom: '6px' }}>College Admin Console</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
              Monitor student submissions, audit compliance records, and manage account credits.
            </p>

            {/* Stats Cards */}
            {loadingStats ? (
              <div className="spinner"></div>
            ) : stats && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                  
                  {/* Credits Card */}
                  <div className="glass-card" style={{ borderLeft: stats.low_credit_alert ? '4px solid var(--danger)' : '4px solid var(--success)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Credits Remaining
                    </div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
                      {stats.credits_remaining} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {stats.allocated_credits}</span>
                    </div>
                    {stats.low_credit_alert && (
                      <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '8px', fontWeight: '600' }}>
                        ⚠️ Low balance! Less than 20% remaining.
                      </div>
                    )}
                  </div>

                  {/* Monthly Submissions */}
                  <div className="glass-card">
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Submissions (This Month)
                    </div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
                      {stats.submissions_this_month}
                    </div>
                    <div style={{ color: 'var(--success)', fontSize: '12px', marginTop: '8px' }}>
                      Active compliance checks
                    </div>
                  </div>

                  {/* Registered Students */}
                  <div className="glass-card">
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Registered Students
                    </div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
                      {students.length}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>
                      Accounts using college credits
                    </div>
                  </div>
                </div>

                {/* Analytical Charts */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
                  
                  {/* Avg Similarity Score by Department */}
                  <div className="glass-card" style={{ minHeight: '350px' }}>
                    <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Average Similarity Score by Department</h3>
                    <div style={{ width: '100%', height: '260px' }}>
                      {stats.dept_stats.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                          No data available
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.dept_stats}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="department" stroke="var(--text-muted)" />
                            <YAxis stroke="var(--text-muted)" unit="%" />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }} />
                            <Legend />
                            <Bar dataKey="avg_similarity" name="Avg Similarity %" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Submission Volumes */}
                  <div className="glass-card" style={{ minHeight: '350px' }}>
                    <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Monthly Submissions Volumes</h3>
                    <div style={{ width: '100%', height: '260px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats.monthly_volume}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="month" stroke="var(--text-muted)" />
                          <YAxis stroke="var(--text-muted)" />
                          <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }} />
                          <Legend />
                          <Line type="monotone" dataKey="count" name="Submissions Count" stroke="var(--primary)" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SUBMISSIONS AUDIT LOG */}
        {activeTab === 'submissions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '26px' }}>Submissions Audit Log (NAAC Verification)</h2>
              <button className="btn btn-accent" style={{ color: 'var(--bg-primary)' }} onClick={triggerExport}>
                📥 Export CSV Report
              </button>
            </div>

            {/* Filter Form Panel */}
            <form onSubmit={handleFilterSubmit} className="glass-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Department</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. CS"
                  value={filters.department}
                  onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Min Similarity (%)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="0"
                  value={filters.min_similarity}
                  onChange={(e) => setFilters({ ...filters, min_similarity: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Max Similarity (%)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="100"
                  value={filters.max_similarity}
                  onChange={(e) => setFilters({ ...filters, max_similarity: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Start Date</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">End Date</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1', padding: '12px' }}>
                  Filter
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: '12px' }} onClick={handleFilterClear}>
                  Clear
                </button>
              </div>
            </form>

            {/* Submissions List Grid */}
            {loadingSubmissions ? (
              <div className="spinner"></div>
            ) : submissions.length === 0 ? (
              <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No student submissions found matching the selected filters.
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Student Account</th>
                      <th>Document Filename</th>
                      <th>Dept</th>
                      <th>Word Count</th>
                      <th>Date Submitted</th>
                      <th>Similarity Score</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((s) => (
                      <tr key={s.id}>
                        <td>#{s.id}</td>
                        <td>
                          <strong>{s.user_details?.first_name} {s.user_details?.last_name}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.user_details?.email}</div>
                        </td>
                        <td>{s.document.split('/').pop()}</td>
                        <td><span style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: '4px', fontSize: '12px' }}>{s.department || 'N/A'}</span></td>
                        <td>{s.word_count}</td>
                        <td>{new Date(s.created_at).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 'bold', color: s.similarity_score !== null ? (s.similarity_score > 25 ? 'var(--danger)' : 'var(--success)') : 'inherit' }}>
                          {s.similarity_score !== null ? `${s.similarity_score}%` : 'In Queue'}
                        </td>
                        <td>
                          <span className={`badge badge-${s.status.toLowerCase().replace(' ', '-')}`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: STUDENT ROSTER & REGISTRATION */}
        {activeTab === 'students' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '32px' }}>
            
            {/* Student Registration Panels */}
            <div>
              {/* Individual additions */}
              <div className="glass-card" style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Add Single Student</h3>
                <form onSubmit={handleSingleStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <input 
                      type="text" 
                      placeholder="Username" 
                      className="form-control" 
                      required 
                      value={newStudent.username}
                      onChange={(e) => setNewStudent({ ...newStudent, username: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <input 
                      type="email" 
                      placeholder="Email Address" 
                      className="form-control" 
                      required
                      value={newStudent.email}
                      onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <input 
                      type="password" 
                      placeholder="Password" 
                      className="form-control" 
                      required
                      value={newStudent.password}
                      onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="First Name" 
                      className="form-control" 
                      value={newStudent.first_name}
                      onChange={(e) => setNewStudent({ ...newStudent, first_name: e.target.value })}
                    />
                    <input 
                      type="text" 
                      placeholder="Last Name" 
                      className="form-control" 
                      value={newStudent.last_name}
                      onChange={(e) => setNewStudent({ ...newStudent, last_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <input 
                      type="text" 
                      placeholder="Department (e.g. CSE, EEE)" 
                      className="form-control" 
                      value={newStudent.department}
                      onChange={(e) => setNewStudent({ ...newStudent, department: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={addingStudent}>
                    {addingStudent ? "Adding..." : "Register Student"}
                  </button>
                </form>
              </div>

              {/* CSV Upload */}
              <div className="glass-card">
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>CSV Student Import</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Upload a CSV file containing: <code>username, email, first_name, last_name, department</code>
                </p>
                <form onSubmit={handleCsvUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="form-control"
                    required
                    onChange={(e) => setCsvFile(e.target.files[0])}
                  />
                  <button type="submit" className="btn btn-secondary" disabled={uploadingCsv || !csvFile}>
                    {uploadingCsv ? "Processing CSV..." : "Upload CSV File"}
                  </button>
                </form>

                {csvResult && (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '13px' }}>
                    <div style={{ color: 'var(--success)', fontWeight: 'bold', marginBottom: '8px' }}>
                      {csvResult.message}
                    </div>
                    {csvResult.created && csvResult.created.length > 0 && (
                      <div style={{ overflowY: 'auto', maxHeight: '160px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                        <p style={{ fontWeight: '600', marginBottom: '4px' }}>Logins list generated:</p>
                        {csvResult.created.map((item, index) => (
                          <div key={index} style={{ marginBottom: '6px', color: 'var(--text-muted)' }}>
                            User: <strong style={{ color: 'var(--text-main)' }}>{item.username}</strong> • Pass: <strong style={{ color: 'var(--secondary)' }}>{item.password}</strong> ({item.department})
                          </div>
                        ))}
                      </div>
                    )}
                    {csvResult.errors && csvResult.errors.length > 0 && (
                      <div style={{ color: 'var(--danger)', marginTop: '8px' }}>
                        <strong>Errors:</strong>
                        {csvResult.errors.map((err, i) => <div key={i}>{err}</div>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Students list */}
            <div>
              <div className="glass-card" style={{ minHeight: '400px' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Registered Students ({students.length})</h3>
                {loadingStudents ? (
                  <div className="spinner"></div>
                ) : students.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No students registered under your college yet.</p>
                ) : (
                  <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Department</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => (
                          <tr key={student.id}>
                            <td>
                              <strong>{student.first_name} {student.last_name}</strong>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{student.username}</div>
                            </td>
                            <td>{student.email}</td>
                            <td>
                              <span style={{ padding: '2px 8px', background: 'var(--bg-tertiary)', borderRadius: '4px', fontSize: '12px' }}>
                                {student.department || 'General'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
