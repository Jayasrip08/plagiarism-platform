import React, { useState, useEffect } from 'react';
import api, { logout } from './api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminPortal({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Pending queue
  const [queue, setQueue] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [completeForm, setCompleteForm] = useState({ similarity_score: '', report_file: null });
  const [updatingOrder, setUpdatingOrder] = useState(false);

  // College management
  const [colleges, setColleges] = useState([]);
  const [loadingColleges, setLoadingColleges] = useState(false);
  const [newCollege, setNewCollege] = useState({ college_name: '', credits: 100, contact_email: '', admin_username: '', admin_password: '' });
  const [addingCollege, setAddingCollege] = useState(false);
  const [allocateData, setAllocateData] = useState({ college_id: '', credits: '', admin_username: '', admin_email: '', admin_password: '' });
  const [allocatingCredits, setAllocatingCredits] = useState(false);

  // User management
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUser, setSearchUser] = useState('');

  // Pricing configs
  const [pricing, setPricing] = useState({ per_word_rate: '', express_fee: '', editing_suggestions_fee: '', referral_credit: '' });
  const [updatingPricing, setUpdatingPricing] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchQueue();
    fetchColleges();
    fetchUsers();
    fetchPricing();
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('analytics/dashboard/');
      setStats(res.data);
    } catch (e) {
      console.error("Failed to load superadmin stats", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchQueue = async () => {
    setLoadingQueue(true);
    try {
      const res = await api.get('orders/super/queue/');
      setQueue(res.data);
    } catch (e) {
      console.error("Failed to fetch pending queue", e);
    } finally {
      setLoadingQueue(false);
    }
  };

  const fetchColleges = async () => {
    setLoadingColleges(true);
    try {
      const res = await api.get('colleges/');
      setColleges(res.data);
    } catch (e) {
      console.error("Failed to load colleges list", e);
    } finally {
      setLoadingColleges(false);
    }
  };

  const fetchUsers = async (search = '') => {
    setLoadingUsers(true);
    try {
      const res = await api.get('accounts/super/users/', {
        params: search ? { search } : {}
      });
      setUsers(res.data);
    } catch (e) {
      console.error("Failed to search users list", e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchPricing = async () => {
    try {
      const res = await api.get('orders/pricing/');
      setPricing(res.data);
    } catch (e) {
      console.error("Failed to fetch pricing config", e);
    }
  };

  const handleStartProcessing = async (orderId) => {
    try {
      await api.post(`orders/super/${orderId}/update/`, { action: 'start_processing' });
      alert("Order status changed to Processing.");
      fetchQueue();
    } catch (e) {
      console.error("Failed to change status", e);
    }
  };

  const handleCompleteOrderSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrder || !completeForm.report_file) return;
    setUpdatingOrder(true);

    const formData = new FormData();
    formData.append('action', 'complete');
    formData.append('similarity_score', completeForm.similarity_score);
    formData.append('report_file', completeForm.report_file);

    try {
      await api.post(`orders/super/${selectedOrder.id}/update/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(`Order #${selectedOrder.id} completed. Notifications sent successfully.`);
      setSelectedOrder(null);
      setCompleteForm({ similarity_score: '', report_file: null });
      fetchQueue();
      fetchStats();
    } catch (e) {
      console.error("Failed to complete check", e);
      alert("Error completing check. Check values.");
    } finally {
      setUpdatingOrder(false);
    }
  };

  const handleCreateCollege = async (e) => {
    e.preventDefault();
    setAddingCollege(true);
    try {
      const colRes = await api.post('colleges/', {
        college_name: newCollege.college_name,
        credits: newCollege.credits,
        contact_email: newCollege.contact_email
      });
      
      // If admin username specified, allocate admin
      if (newCollege.admin_username && colRes.data.id) {
        await api.post(`colleges/${colRes.data.id}/allocate-credits/`, {
          credits: 0,
          admin_username: newCollege.admin_username,
          admin_email: newCollege.contact_email,
          admin_password: newCollege.admin_password
        });
      }

      alert(`College '${newCollege.college_name}' registered successfully!`);
      setNewCollege({ college_name: '', credits: 100, contact_email: '', admin_username: '', admin_password: '' });
      fetchColleges();
      fetchStats();
    } catch (e) {
      console.error("Failed to register college", e);
      alert("Error creating college.");
    } finally {
      setAddingCollege(false);
    }
  };

  const handleAllocateCredits = async (e) => {
    e.preventDefault();
    if (!allocateData.college_id || !allocateData.credits) return;
    setAllocatingCredits(true);
    try {
      await api.post(`colleges/${allocateData.college_id}/allocate-credits/`, {
        credits: allocateData.credits,
        admin_username: allocateData.admin_username,
        admin_email: allocateData.admin_email,
        admin_password: allocateData.admin_password
      });
      alert("Allocated credits successfully!");
      setAllocateData({ college_id: '', credits: '', admin_username: '', admin_email: '', admin_password: '' });
      fetchColleges();
      fetchStats();
    } catch (e) {
      console.error("Failed to allocate credits", e);
      alert("Error allocating credits.");
    } finally {
      setAllocatingCredits(false);
    }
  };

  const handleToggleUserBlock = async (userId) => {
    try {
      const res = await api.post(`accounts/super/users/${userId}/block/`);
      alert(res.data.message);
      fetchUsers(searchUser);
    } catch (e) {
      console.error("Failed to toggle block status", e);
      alert("Cannot block superadmin user.");
    }
  };

  const handlePricingSubmit = async (e) => {
    e.preventDefault();
    setUpdatingPricing(true);
    try {
      await api.post('orders/pricing/', pricing);
      alert("Pricing configuration saved successfully!");
      fetchPricing();
    } catch (e) {
      console.error("Failed to save pricing configuration", e);
      alert("Failed to save. Check fields.");
    } finally {
      setUpdatingPricing(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(searchUser);
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo" style={{ background: 'linear-gradient(135deg, var(--text-main) 0%, var(--primary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Super Admin
        </div>
        <div className="sidebar-nav">
          <button className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            BI Dashboard
          </button>
          <button className={`nav-link ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => { setActiveTab('queue'); fetchQueue(); }}>
            Pending Queue ({queue.length})
          </button>
          <button className={`nav-link ${activeTab === 'colleges' ? 'active' : ''}`} onClick={() => setActiveTab('colleges')}>
            Colleges Manager
          </button>
          <button className={`nav-link ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
            User Lockout tool
          </button>
          <button className={`nav-link ${activeTab === 'pricing' ? 'active' : ''}`} onClick={() => setActiveTab('pricing')}>
            Pricing Configuration
          </button>
        </div>
        <div style={{ marginTop: 'auto', padding: '16px 0' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            System Console:<br/>
            <strong style={{ color: 'var(--text-main)' }}>Super Admin</strong>
          </div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ padding: '40px', overflowY: 'auto', textAlign: 'left' }}>
        
        {/* TAB 1: BI DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            <h2 style={{ fontSize: '30px', marginBottom: '6px' }}>Business Intelligence</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
              Real-time transactional revenue performance, operational queues sizes, and growths.
            </p>

            {loadingStats ? (
              <div className="spinner"></div>
            ) : stats && (
              <div>
                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                  
                  <div className="glass-card">
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Today's Orders
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.today_orders}</div>
                    <div style={{ color: 'var(--secondary)', fontSize: '12px', marginTop: '6px' }}>New submissions</div>
                  </div>

                  <div className="glass-card">
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Total Revenue
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--success)' }}>
                      ₹{stats.total_revenue.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      B2C: ₹{stats.b2c_revenue_total.toLocaleString()} • B2B: ₹{stats.b2b_revenue_total.toLocaleString()}
                    </div>
                  </div>

                  <div className="glass-card">
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Pending Queue Checks
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--warning)' }}>{stats.pending_checks}</div>
                    <div style={{ color: 'var(--warning)', fontSize: '12px', marginTop: '6px' }}>NeedsTurnitin upload</div>
                  </div>

                  <div className="glass-card">
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Active Colleges / Users
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                      {stats.active_colleges} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ {stats.total_registered_users}</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '6px' }}>Total client accounts</div>
                  </div>
                </div>

                {/* Revenue Charts and Spenders */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '32px' }}>
                  
                  {/* Revenue Growth Trend */}
                  <div className="glass-card" style={{ minHeight: '350px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '18px' }}>Revenue Chart split (B2C vs B2B)</h3>
                      <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                        MoM Growth: {stats.mom_growth_percent}%
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '260px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.monthly_trends}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="month" stroke="var(--text-muted)" />
                          <YAxis stroke="var(--text-muted)" unit="₹" />
                          <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }} />
                          <Legend />
                          <Bar dataKey="B2C" name="B2C Cash" fill="var(--primary)" stackId="a" />
                          <Bar dataKey="B2B" name="B2B Credits" fill="var(--secondary)" stackId="a" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Top B2C Spenders */}
                  <div className="glass-card" style={{ minHeight: '350px' }}>
                    <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Top Spenders (B2C)</h3>
                    {stats.top_spenders.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)' }}>No spending accounts recorded.</p>
                    ) : (
                      <div className="table-container">
                        <table className="custom-table" style={{ fontSize: '13px' }}>
                          <thead>
                            <tr>
                              <th>User</th>
                              <th>Total Spent</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.top_spenders.map(spender => (
                              <tr key={spender.id}>
                                <td>
                                  <strong>{spender.username}</strong>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{spender.email}</div>
                                </td>
                                <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                                  ₹{spender.total_spend.toFixed(2)}
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
          </div>
        )}

        {/* TAB 2: PENDING QUEUE */}
        {activeTab === 'queue' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '26px' }}>Pending Checks Queue</h2>
              <button className="btn btn-secondary" onClick={fetchQueue}>
                Refresh Queue
              </button>
            </div>

            {loadingQueue ? (
              <div className="spinner"></div>
            ) : queue.length === 0 ? (
              <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                🎉 Great! The verification queue is currently empty.
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Queue priority</th>
                      <th>Order ID</th>
                      <th>Account</th>
                      <th>Filename</th>
                      <th>Words</th>
                      <th>Status</th>
                      <th>Document</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map(order => (
                      <tr 
                        key={order.id}
                        style={{
                          backgroundColor: order.is_express ? 'rgba(6, 182, 212, 0.03)' : 'inherit'
                        }}
                      >
                        <td>
                          {order.is_express ? (
                            <span style={{ fontSize: '11px', padding: '4px 8px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', fontWeight: 'bold' }}>
                              ⚡ EXPRESS PRIORITY
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-dark)', fontSize: '12px' }}>Standard</span>
                          )}
                        </td>
                        <td>#{order.id}</td>
                        <td>
                          <strong>{order.user_details?.username}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {order.is_b2b ? `B2B (${order.college_name})` : 'B2C (Cash)'}
                          </div>
                        </td>
                        <td>{order.document.split('/').pop()}</td>
                        <td>{order.word_count}</td>
                        <td>
                          <span className={`badge badge-${order.status.toLowerCase().replace(' ', '-')}`}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          <a 
                            href={`http://localhost:8000${order.document}`} 
                            download 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            ⬇️ Download
                          </a>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {order.status === 'Submitted' && (
                              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleStartProcessing(order.id)}>
                                Start Processing
                              </button>
                            )}
                            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setSelectedOrder(order)}>
                              Complete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COLLEGES MANAGER */}
        {activeTab === 'colleges' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            {/* Left: Create & Allocate */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Create College */}
              <div className="glass-card">
                <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Register New College Account</h3>
                <form onSubmit={handleCreateCollege} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <input type="text" placeholder="College Name" className="form-control" required value={newCollege.college_name} onChange={(e) => setNewCollege({ ...newCollege, college_name: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <input type="email" placeholder="Billing / Contact Email" className="form-control" required value={newCollege.contact_email} onChange={(e) => setNewCollege({ ...newCollege, contact_email: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <input type="number" placeholder="Initial Credits Balance" className="form-control" required value={newCollege.credits} onChange={(e) => setNewCollege({ ...newCollege, credits: e.target.value })} />
                  </div>
                  
                  <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '8px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Create College Administrator Account (Optional)</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" placeholder="Admin Username" className="form-control" value={newCollege.admin_username} onChange={(e) => setNewCollege({ ...newCollege, admin_username: e.target.value })} />
                      <input type="password" placeholder="Admin Password" className="form-control" value={newCollege.admin_password} onChange={(e) => setNewCollege({ ...newCollege, admin_password: e.target.value })} />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={addingCollege}>
                    {addingCollege ? "Registering..." : "Create College Account"}
                  </button>
                </form>
              </div>

              {/* Allocate Credits */}
              <div className="glass-card">
                <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Allocate Credits & Update Admin</h3>
                <form onSubmit={handleAllocateCredits} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label">Select College</label>
                    <select className="form-control" required value={allocateData.college_id} onChange={(e) => setAllocateData({ ...allocateData, college_id: e.target.value })}>
                      <option value="">-- Choose College --</option>
                      {colleges.map(c => <option key={c.id} value={c.id}>{c.college_name} (Bal: {c.credits})</option>)}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <input type="number" placeholder="Additional Credits to Add" className="form-control" required value={allocateData.credits} onChange={(e) => setAllocateData({ ...allocateData, credits: e.target.value })} />
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '8px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Add/Update College Admin credentials</p>
                    <input type="text" placeholder="Admin Username" className="form-control" style={{ marginBottom: '8px' }} value={allocateData.admin_username} onChange={(e) => setAllocateData({ ...allocateData, admin_username: e.target.value })} />
                    <input type="email" placeholder="Admin Email" className="form-control" style={{ marginBottom: '8px' }} value={allocateData.admin_email} onChange={(e) => setAllocateData({ ...allocateData, admin_email: e.target.value })} />
                    <input type="password" placeholder="Admin Password" className="form-control" value={allocateData.admin_password} onChange={(e) => setAllocateData({ ...allocateData, admin_password: e.target.value })} />
                  </div>

                  <button type="submit" className="btn btn-secondary" style={{ marginTop: '8px' }} disabled={allocatingCredits}>
                    {allocatingCredits ? "Allocating..." : "Allocate Credits"}
                  </button>
                </form>
              </div>

            </div>

            {/* Right: Colleges List */}
            <div className="glass-card">
              <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Registered College Accounts ({colleges.length})</h3>
              {loadingColleges ? (
                <div className="spinner"></div>
              ) : (
                <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table className="custom-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>College Details</th>
                        <th>Credits Balance</th>
                        <th>Admin Info</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colleges.map(c => (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.college_name}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Created {new Date(c.created_at).toLocaleDateString()}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Contact: {c.contact_email}</div>
                          </td>
                          <td>
                            <strong style={{ fontSize: '16px' }}>{c.credits}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Allocated: {c.allocated_credits}</div>
                          </td>
                          <td>
                            {c.admin_username ? (
                              <div>
                                <strong>@{c.admin_username}</strong>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.admin_email}</div>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--danger)', fontSize: '11px' }}>No Admin</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 4: USER LOCKOUT TOOL */}
        {activeTab === 'users' && (
          <div>
            <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>User Account Management</h2>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', marginBottom: '24px', maxWidth: '500px' }}>
              <input type="text" placeholder="Search user by username or email..." className="form-control" value={searchUser} onChange={(e) => setSearchUser(e.target.value)} />
              <button type="submit" className="btn btn-primary">Search</button>
            </form>

            {loadingUsers ? (
              <div className="spinner"></div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Account Info</th>
                      <th>Role</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td>
                          <strong>{u.first_name} {u.last_name}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{u.username} • {u.email}</div>
                        </td>
                        <td>
                          <span style={{ padding: '2px 8px', background: 'var(--bg-tertiary)', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                            {u.role.toUpperCase()}
                          </span>
                          {u.college_name && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.college_name}</div>}
                        </td>
                        <td>{u.phone || 'N/A'}</td>
                        <td>
                          <span className={`badge badge-${u.is_active ? 'ready' : 'submitted'}`}>
                            {u.is_active ? 'Active' : 'Blocked'}
                          </span>
                        </td>
                        <td>
                          {u.role !== 'super_admin' ? (
                            <button 
                              className={`btn ${u.is_active ? 'btn-danger' : 'btn-accent'}`} 
                              style={{ padding: '6px 12px', fontSize: '12px', color: u.is_active ? '#fff' : 'var(--bg-primary)' }}
                              onClick={() => handleToggleUserBlock(u.id)}
                            >
                              {u.is_active ? 'Block Account' : 'Unblock Account'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>System Administrator</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: PRICING CONFIGURATION */}
        {activeTab === 'pricing' && (
          <div style={{ maxWidth: '500px' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Pricing Configuration</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Edit base charges, express rates, and suggestions addons instantly.</p>

            <form onSubmit={handlePricingSubmit} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Per-Word Verification Rate (₹)</label>
                <input type="number" step="0.01" className="form-control" required value={pricing.per_word_rate} onChange={(e) => setPricing({ ...pricing, per_word_rate: e.target.value })} />
              </div>

              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Express Verification Surcharge (₹)</label>
                <input type="number" step="1" className="form-control" required value={pricing.express_fee} onChange={(e) => setPricing({ ...pricing, express_fee: e.target.value })} />
              </div>

              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Editing Suggestions Addon Fee (₹)</label>
                <input type="number" step="1" className="form-control" required value={pricing.editing_suggestions_fee} onChange={(e) => setPricing({ ...pricing, editing_suggestions_fee: e.target.value })} />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Referral Bonus Allocation (₹)</label>
                <input type="number" step="1" className="form-control" required value={pricing.referral_credit} onChange={(e) => setPricing({ ...pricing, referral_credit: e.target.value })} />
              </div>

              <button type="submit" className="btn btn-primary" disabled={updatingPricing}>
                {updatingPricing ? "Saving..." : "Save Pricing Config"}
              </button>
            </form>
          </div>
        )}

      </main>

      {/* COMPLETE ORDER DIALOG MODAL */}
      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '20px', marginBottom: '16px' }}>Upload Report & Complete Order #{selectedOrder.id}</h3>
            
            <form onSubmit={handleCompleteOrderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', fontSize: '13px', textAlign: 'left', marginBottom: '8px' }}>
                File: <strong style={{ color: 'var(--secondary)' }}>{selectedOrder.document.split('/').pop()}</strong><br/>
                Word Count: <strong>{selectedOrder.word_count} words</strong>
              </div>

              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Similarity Score (%)</label>
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  className="form-control" 
                  placeholder="e.g. 12" 
                  required 
                  value={completeForm.similarity_score}
                  onChange={(e) => setCompleteForm({ ...completeForm, similarity_score: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Verified PDF Plagiarism Report</label>
                <input 
                  type="file" 
                  accept=".pdf" 
                  className="form-control" 
                  required 
                  onChange={(e) => setCompleteForm({ ...completeForm, report_file: e.target.files[0] })}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={updatingOrder}>
                  {updatingOrder ? "Dispatching..." : "Submit Done"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
