import React, { useState, useEffect, useRef } from 'react';
import api, { logout } from './api';

export default function StudentPortal({ user }) {
  const [activeTab, setActiveTab] = useState('new_check');
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // File Upload State
  const [file, setFile] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [isExpress, setIsExpress] = useState(false);
  const [hasSuggestions, setHasSuggestions] = useState(false);
  const [useCredits, setUseCredits] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  
  // Checkout & Upsell Modal
  const [showUpsell, setShowUpsell] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  
  // Tracking State
  const [trackedOrder, setTrackedOrder] = useState(null);
  const fileInputRef = useRef(null);

  // Load Razorpay checkout script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await api.get('orders/');
      setOrders(res.data);
    } catch (e) {
      console.error("Failed to load orders history:", e);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    await getEstimate(selectedFile, isExpress, hasSuggestions);
  };

  const getEstimate = async (selectedFile, expressOpt, suggestionsOpt) => {
    setEstimating(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('is_express', expressOpt);
      formData.append('has_suggestions', suggestionsOpt);
      
      const res = await api.post('orders/estimate/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setEstimate(res.data);
    } catch (e) {
      console.error("Failed to estimate word count/pricing", e);
      alert("Error parsing document. Please upload a valid PDF or DOCX.");
      setFile(null);
    } finally {
      setEstimating(false);
    }
  };

  const handleExpressToggle = async (val) => {
    setIsExpress(val);
    if (file) {
      await getEstimate(file, val, hasSuggestions);
    }
  };

  const handleSuggestionsToggle = async (val) => {
    setHasSuggestions(val);
    if (file) {
      await getEstimate(file, isExpress, val);
    }
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setSubmittingOrder(true);

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('is_express', isExpress);
      formData.append('has_suggestions', hasSuggestions);
      
      // Determine if B2B credits can be used
      const isB2B = useCredits && user.college_id && user.department;
      formData.append('is_b2b', isB2B);

      const res = await api.post('orders/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const orderData = res.data;
      setCurrentOrderId(orderData.id);

      if (isB2B) {
        // B2B order processed directly
        alert("Submissions completed successfully using college B2B credits!");
        setFile(null);
        setEstimate(null);
        fetchOrders();
        setActiveTab('history');
      } else {
        // B2C: Proceed to Payment
        initiatePayment(orderData);
      }
    } catch (e) {
      console.error("Failed to submit order", e);
      alert(e.response?.data?.error || "Error creating order. Please try again.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  const initiatePayment = async (order) => {
    try {
      const res = await api.post('payments/create/', { order_id: order.id });
      const payData = res.data;

      if (payData.is_mock) {
        // Simulate Sandbox Checkout directly in UI
        handleMockCheckout(payData, order);
      } else {
        // Real Razorpay options
        const options = {
          key: payData.key,
          amount: payData.amount,
          currency: payData.currency,
          name: 'Plagiarism Checker Platform',
          description: `Plagiarism verification - Order #${order.id}`,
          order_id: payData.id,
          handler: async (response) => {
            await verifyPayment({
              razorpay_order_id: payData.id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              order_id: order.id,
            });
          },
          prefill: {
            name: user.username,
            email: user.email,
            contact: user.phone || '',
          },
          theme: { color: '#6d28d9' }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (e) {
      console.error("Payment initiation failed", e);
      alert("Payment initiation failed. Please try again.");
    }
  };

  const handleMockCheckout = (payData, order) => {
    const confirmPay = window.confirm(`[SIMULATION Checkout] Total Amount: ₹${(payData.amount / 100).toFixed(2)}\nDo you want to authorize this simulated payment transaction?`);
    if (confirmPay) {
      verifyPayment({
        razorpay_order_id: payData.id,
        razorpay_payment_id: `pay_mock_${Date.now()}`,
        razorpay_signature: `sig_mock_${Date.now()}`,
        order_id: order.id,
      });
    } else {
      alert("Payment cancelled.");
    }
  };

  const verifyPayment = async (payload) => {
    try {
      await api.post('payments/verify/', payload);
      // Payment validated, prompt upsell check
      setShowUpsell(true);
      fetchOrders();
    } catch (e) {
      console.error("Payment validation failed", e);
      alert("Payment verification failed. Contact support.");
    }
  };

  const handleUpsellDecision = async (accept) => {
    setShowUpsell(false);
    if (accept && currentOrderId) {
      try {
        await api.post(`orders/${currentOrderId}/add-editing-suggestions/`);
        alert("Editing suggestions successfully added! Your report will include spelling and syntax improvement guidelines.");
      } catch (e) {
        console.error("Upsell update failed", e);
      }
    }
    // Clean states & route to order tracking
    setFile(null);
    setEstimate(null);
    fetchOrders();
    
    // Auto-select the order for tracking
    const activeOrder = orders.find(o => o.id === currentOrderId);
    if (activeOrder) {
      setTrackedOrder(activeOrder);
    } else {
      // Find from re-fetched orders
      api.get(`orders/${currentOrderId}/`).then(res => setTrackedOrder(res.data));
    }
    setActiveTab('tracking');
  };

  const downloadInvoice = (orderId) => {
    window.open(`http://localhost:8000/api/orders/${orderId}/invoice/`, '_blank');
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          PlagShield
        </div>
        <div className="sidebar-nav">
          <button 
            className={`nav-link ${activeTab === 'new_check' ? 'active' : ''}`}
            onClick={() => setActiveTab('new_check')}
          >
            New Document Check
          </button>
          <button 
            className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Order History
          </button>
          {trackedOrder && (
            <button 
              className={`nav-link ${activeTab === 'tracking' ? 'active' : ''}`}
              onClick={() => setActiveTab('tracking')}
            >
              Track Order #{trackedOrder.id}
            </button>
          )}
        </div>
        <div style={{ marginTop: 'auto', padding: '16px 0' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Logged in as:<br/>
            <strong style={{ color: 'var(--text-main)' }}>{user.username}</strong>
            {user.college_name && (
              <div style={{ fontSize: '12px', color: 'var(--secondary)' }}>
                {user.college_name} ({user.department})
              </div>
            )}
          </div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ padding: '40px', overflowY: 'auto' }}>
        
        {/* TAB 1: NEW DOCUMENT CHECK */}
        {activeTab === 'new_check' && (
          <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'left' }}>
            <h2 style={{ fontSize: '32px', marginBottom: '8px' }}>Plagiarism Document Check</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
              Upload your research papers, theses, or essays. Results verified within turnitin queues.
            </p>

            <form onSubmit={handleOrderSubmit} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Dropzone */}
              <div 
                className="dropzone"
                onClick={() => fileInputRef.current.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  style={{ display: 'none' }} 
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileChange}
                />
                <div className="dropzone-icon">📥</div>
                {file ? (
                  <div>
                    <h4 style={{ color: 'var(--secondary)', marginBottom: '6px' }}>{file.name}</h4>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB • Click to upload different file
                    </p>
                  </div>
                ) : (
                  <div>
                    <h4 style={{ marginBottom: '6px', color: 'var(--text-main)' }}>Drag & Drop or Click to Upload</h4>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                      Supports PDF, DOCX, TXT formats (Max 20MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Estimation Details */}
              {estimating && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="spinner"></div>
                  <span style={{ color: 'var(--text-muted)' }}>Analyzing document and counting words...</span>
                </div>
              )}

              {estimate && (
                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '18px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    Calculation Summary
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Word Count:</span>
                    <strong>{estimate.word_count} words</strong>
                  </div>
                  
                  {user.college_id && (
                    <div className="form-group" style={{ margin: '16px 0', padding: '10px', background: 'rgba(6, 182, 212, 0.05)', borderRadius: '6px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={useCredits} 
                          onChange={(e) => setUseCredits(e.target.checked)}
                          style={{ scale: '1.2' }}
                        />
                        <div>
                          <strong style={{ color: 'var(--secondary)' }}>Use College B2B Credits</strong>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Deduct 1 check from {user.college_name} credits. Free submission.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}

                  {!useCredits && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Base Price (at ₹0.50 per word):</span>
                        <span>₹{estimate.base_price.toFixed(2)}</span>
                      </div>
                      {isExpress && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: 'var(--secondary)' }}>
                          <span>Express Surcharge:</span>
                          <span>+ ₹{estimate.express_fee.toFixed(2)}</span>
                        </div>
                      )}
                      {hasSuggestions && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: 'var(--secondary)' }}>
                          <span>Editing Suggestions Addon:</span>
                          <span>+ ₹{estimate.editing_suggestions_fee.toFixed(2)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '18px', fontWeight: 'bold' }}>
                        <span>Grand Total:</span>
                        <span style={{ color: 'var(--secondary)' }}>₹{estimate.total_price.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Extras Option Checklist */}
              {file && !useCredits && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={isExpress}
                      onChange={(e) => handleExpressToggle(e.target.checked)}
                      style={{ scale: '1.2' }}
                    />
                    <div>
                      <strong>Express Verification (+₹500)</strong>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Prioritizes report generation. Average turnaround under 2 hours.</p>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={hasSuggestions}
                      onChange={(e) => handleSuggestionsToggle(e.target.checked)}
                      style={{ scale: '1.2' }}
                    />
                    <div>
                      <strong>Include Editing Suggestions (+₹299)</strong>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Auto-generates phrasing guidelines, grammar, and referencing checklists.</p>
                    </div>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              {file && (
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '16px' }}
                  disabled={submittingOrder}
                >
                  {submittingOrder ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <div className="spinner" style={{ width: '18px', height: '18px' }}></div>
                      Creating checkout...
                    </div>
                  ) : (
                    useCredits ? "Submit Check using B2B credits" : "Proceed to Payment & Start Check"
                  )}
                </button>
              )}
            </form>
          </div>
        )}

        {/* TAB 2: ORDER HISTORY */}
        {activeTab === 'history' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '28px' }}>Your Submissions History</h2>
              <button className="btn btn-secondary" onClick={fetchOrders}>
                Refresh List
              </button>
            </div>

            {loadingOrders ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                <div className="spinner"></div>
              </div>
            ) : orders.length === 0 ? (
              <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>You have not submitted any documents yet.</p>
                <button className="btn btn-primary" onClick={() => setActiveTab('new_check')}>
                  New Plagiarism Check
                </button>
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Filename</th>
                      <th>Date</th>
                      <th>Words</th>
                      <th>Type</th>
                      <th>Price</th>
                      <th>Similarity</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>#{o.id}</td>
                        <td style={{ fontWeight: '600' }}>
                          {o.document.split('/').pop()}
                          {o.is_express && <span style={{ marginLeft: '8px', fontSize: '10px', padding: '2px 6px', background: 'rgba(6, 182, 212, 0.2)', color: 'var(--secondary)', borderRadius: '4px' }}>EXPRESS</span>}
                        </td>
                        <td>{new Date(o.created_at).toLocaleDateString()}</td>
                        <td>{o.word_count}</td>
                        <td>
                          {o.is_b2b ? (
                            <span style={{ color: 'var(--secondary)', fontSize: '12px', fontWeight: 'bold' }}>B2B CREDIT</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>B2C CASH</span>
                          )}
                        </td>
                        <td>{o.is_b2b ? "—" : `₹${parseFloat(o.price).toFixed(2)}`}</td>
                        <td style={{ fontWeight: 'bold', color: o.similarity_score !== null ? (o.similarity_score > 25 ? 'var(--danger)' : 'var(--success)') : 'inherit' }}>
                          {o.similarity_score !== null ? `${o.similarity_score}%` : 'Pending'}
                        </td>
                        <td>
                          <span className={`badge badge-${o.status.toLowerCase().replace(' ', '-')}`}>
                            {o.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => { setTrackedOrder(o); setActiveTab('tracking'); }}>
                              Track
                            </button>
                            
                            {!o.is_b2b && (
                              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => downloadInvoice(o.id)}>
                                Invoice
                              </button>
                            )}

                            {o.status === 'Report Ready' && (
                              o.is_expired ? (
                                <span style={{ color: 'var(--danger)', fontSize: '11px', alignSelf: 'center' }}>Link Expired</span>
                              ) : (
                                <a 
                                  href={o.secure_download_url}
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="btn btn-accent" 
                                  style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--bg-primary)' }}
                                >
                                  Download
                                </a>
                              )
                            )}
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

        {/* TAB 3: LIVE TRACKING */}
        {activeTab === 'tracking' && trackedOrder && (
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2>Order Tracking - #{trackedOrder.id}</h2>
              <button 
                className="btn btn-secondary" 
                onClick={async () => {
                  const res = await api.get(`orders/${trackedOrder.id}/`);
                  setTrackedOrder(res.data);
                  fetchOrders();
                }}
              >
                Refresh Status
              </button>
            </div>

            <div className="glass-card" style={{ marginBottom: '32px' }}>
              <h3 style={{ marginBottom: '16px' }}>{trackedOrder.document.split('/').pop()}</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
                Submitted on: <strong>{new Date(trackedOrder.created_at).toLocaleString()}</strong>
              </p>
              <p style={{ color: 'var(--text-muted)' }}>
                Word Count: <strong>{trackedOrder.word_count} words</strong> • Service Mode: <strong>{trackedOrder.is_express ? 'Express check' : 'Standard check'}</strong>
              </p>
            </div>

            {/* Stepper Status tracker */}
            <div className="glass-card" style={{ padding: '40px 24px' }}>
              <div className="stepper">
                <div 
                  className="stepper-progress"
                  style={{
                    width: 
                      trackedOrder.status === 'Submitted' ? '0%' :
                      trackedOrder.status === 'Processing' ? '50%' : '100%'
                  }}
                ></div>
                
                <div className={`step ${trackedOrder.status === 'Submitted' ? 'active' : 'completed'}`}>
                  <div className="step-circle">
                    {trackedOrder.status !== 'Submitted' ? '✓' : '1'}
                  </div>
                  <div className="step-label">Submitted</div>
                </div>

                <div className={`step ${trackedOrder.status === 'Processing' ? 'active' : (trackedOrder.status === 'Report Ready' ? 'completed' : '')}`}>
                  <div className="step-circle">
                    {trackedOrder.status === 'Report Ready' ? '✓' : '2'}
                  </div>
                  <div className="step-label">Processing</div>
                </div>

                <div className={`step ${trackedOrder.status === 'Report Ready' ? 'active' : ''}`}>
                  <div className="step-circle">3</div>
                  <div className="step-label">Report Ready</div>
                </div>
              </div>

              {/* Status details information */}
              <div style={{ marginTop: '40px', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)', padding: '24px', borderRadius: '8px' }}>
                {trackedOrder.status === 'Submitted' && (
                  <div>
                    <h4 style={{ color: 'var(--warning)', marginBottom: '8px' }}>Awaiting Operator Allocation</h4>
                    <p style={{ color: 'var(--text-muted)' }}>
                      Our super admin operators will pull the file into processing queues shortly.
                    </p>
                  </div>
                )}
                {trackedOrder.status === 'Processing' && (
                  <div>
                    <h4 style={{ color: 'var(--secondary)', marginBottom: '8px' }}>Verification In Progress</h4>
                    <p style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                      Currently processing document through Turnitin verification queues. Please wait.
                    </p>
                  </div>
                )}
                {trackedOrder.status === 'Report Ready' && (
                  <div>
                    <h4 style={{ color: 'var(--success)', marginBottom: '12px' }}>Verification Completed!</h4>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginBottom: '24px' }}>
                      <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Similarity Score</div>
                        <div style={{ fontSize: '32px', fontWeight: 'bold', color: trackedOrder.similarity_score > 25 ? 'var(--danger)' : 'var(--success)' }}>
                          {trackedOrder.similarity_score}%
                        </div>
                      </div>
                    </div>
                    {trackedOrder.is_expired ? (
                      <div style={{ color: 'var(--danger)', fontWeight: 'bold' }}>
                        This report download link has expired (48 hours validity limit reached).
                      </div>
                    ) : (
                      <div>
                        <a 
                          href={trackedOrder.secure_download_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn btn-accent"
                          style={{ color: 'var(--bg-primary)', padding: '14px 28px' }}
                        >
                          Download Verified PDF Report
                        </a>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                          This secure download link is valid for 48 hours from completion time.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* UPSELL MODAL */}
      {showUpsell && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '24px', marginBottom: '12px', background: 'linear-gradient(135deg, var(--secondary), var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              One-Time Special Offer!
            </h3>
            <p style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
              Add Detailed Editing Suggestions for only ₹299?
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
              Take your research paper to the next level. Over 25% of researchers add this option. Receive automatic highlights on grammar, poor structural flow, and vocabulary enhancements directly attached in your plagiarism audit report.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => handleUpsellDecision(true)}>
                Yes, add for ₹299
              </button>
              <button className="btn btn-secondary" onClick={() => handleUpsellDecision(false)}>
                No thanks, proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
