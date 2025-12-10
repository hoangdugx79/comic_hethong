import React, { useEffect, useState } from 'react';
import Head from 'next/head';

const THEME = {
  bg: '#f8f9fa',
  cardBg: '#ffffff',
  textMain: '#2d3748',
  textSec: '#718096',
  primary: '#3182ce',
  success: '#38a169',
  warning: '#dd6b20',
  error: '#e53e3e',
  border: '#e2e8f0',
  shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
};

export default function AdminDashboard() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Dashboard State
  const [activeTab, setActiveTab] = useState('system'); // system | users
  const [workers, setWorkers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ totalJobs: 0 });
  const [serverOnline, setServerOnline] = useState(false);
  
  // Users Management State
  const [users, setUsers] = useState([]);

  // Check Login on Mount
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      setIsAuthenticated(true);
    }
    setAuthLoading(false);
  }, []);

  // Polling Stats when Authenticated & Tab is System
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Fetch stats loop
    const fetchStats = async () => {
      if (activeTab !== 'system') return;
      try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch('/api/admin/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 401) {
          logout();
          return;
        }

        if (res.ok) {
          const data = await res.json();
          setWorkers(data.workers || []);
          setQueue(data.queue || []);
          setStats(data.stats || { totalJobs: 0 });
          setServerOnline(true);
        } else {
            setServerOnline(false);
        }
      } catch (e) {
        console.error("Fetch error", e);
        setServerOnline(false);
      }
    };

    fetchStats(); 
    const interval = setInterval(fetchStats, 2000); 

    return () => clearInterval(interval);
  }, [isAuthenticated, activeTab]);

  // Fetch Users when Tab is Users
  useEffect(() => {
      if (isAuthenticated && activeTab === 'users') {
          fetchUsers();
      }
  }, [isAuthenticated, activeTab]);

  const fetchUsers = async () => {
      try {
          const token = localStorage.getItem('admin_token');
          const res = await fetch('/api/admin/users', {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
              const data = await res.json();
              setUsers(data.users || []);
          }
      } catch (e) {
          console.error("Fetch users error", e);
      }
  };

  const handleUserAction = async (userId, action) => {
      if (!confirm(`Are you sure you want to ${action} this user?`)) return;
      try {
          const token = localStorage.getItem('admin_token');
          const res = await fetch('/api/admin/user-action', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify({ userId, action })
          });
          if (res.ok) {
              fetchUsers(); // Reload list
          } else {
              alert("Action failed");
          }
      } catch (e) {
          alert("Error: " + e.message);
      }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('admin_token', data.token);
        setIsAuthenticated(true);
      } else {
        setLoginError(data.message || 'Login failed');
      }
    } catch (err) {
      setLoginError('Connection error');
    }
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    setWorkers([]);
    setQueue([]);
  };

  const downloadWorker = () => {
    window.location.href = '/api/download-worker';
  };

  if (authLoading) return <div className="loading">Loading...</div>;

  // --- LOGIN VIEW ---
  if (!isAuthenticated) {
    return (
      <div className="login-container">
         <Head>
          <title>Login | Admin System</title>
        </Head>
        <div className="login-card">
          <div className="brand">
             <div className="logo-icon">⚡</div>
             <h2>System Admin</h2>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                placeholder="Enter username"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Enter password"
              />
            </div>
            {loginError && <div className="error-msg">{loginError}</div>}
            <button type="submit" className="btn-login">Login Access</button>
          </form>
        </div>
        <style jsx global>{`
          body { margin: 0; font-family: sans-serif; background: ${THEME.bg}; }
          .loading { height: 100vh; display: flex; align-items: center; justify-content: center; color: ${THEME.textSec}; }
          .login-container {
            height: 100vh; display: flex; align-items: center; justify-content: center;
          }
          .login-card {
            background: white; width: 100%; max-width: 400px; padding: 2rem;
            border-radius: 12px; box-shadow: ${THEME.shadow};
            border: 1px solid ${THEME.border};
          }
          .brand { text-align: center; margin-bottom: 2rem; }
          .logo-icon { font-size: 3rem; margin-bottom: 0.5rem; }
          .brand h2 { margin: 0; color: ${THEME.textMain}; }
          .form-group { margin-bottom: 1rem; }
          .form-group label { display: block; margin-bottom: 0.5rem; color: ${THEME.textSec}; font-size: 0.9rem; }
          .form-group input { 
            width: 100%; padding: 0.75rem; border: 1px solid ${THEME.border}; 
            border-radius: 6px; font-size: 1rem; box-sizing: border-box;
          }
          .form-group input:focus { border-color: ${THEME.primary}; outline: none; }
          .error-msg { color: ${THEME.error}; font-size: 0.9rem; margin-bottom: 1rem; text-align: center; }
          .btn-login {
            width: 100%; background: ${THEME.primary}; color: white; border: none;
            padding: 0.8rem; border-radius: 6px; font-size: 1rem; cursor: pointer;
            font-weight: 600;
          }
          .btn-login:hover { background: #2b6cb0; }
        `}</style>
      </div>
    );
  }

  // --- DASHBOARD VIEW ---
  return (
    <div className="admin-container">
      <Head>
        <title>System Admin | Video Render Farm</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* --- HEADER --- */}
      <header className="header">
        <div className="header-content">
          <div className="brand">
            <div className="logo-icon">⚡</div>
            <div>
              <h1>Render Farm Control</h1>
              <p>Hệ thống điều phối Video tự động</p>
            </div>
          </div>
          <div className="header-actions">
            <div className="server-status">
                <span className={`status-dot ${serverOnline ? 'online' : 'offline'}`}></span>
                {serverOnline ? 'API Connected' : 'Connecting...'}
            </div>
            <button onClick={logout} className="btn-logout">Logout</button>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="main">
        
        {/* TAB NAVIGATION */}
        <div className="tabs">
            <button 
                className={`tab-btn ${activeTab === 'system' ? 'active' : ''}`}
                onClick={() => setActiveTab('system')}
            >
                🖥️ System Monitor
            </button>
            <button 
                className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
            >
                👥 User Management
            </button>
        </div>

        {activeTab === 'system' && (
            <>
                {/* STATS OVERVIEW */}
                <section className="stats-grid">
                <StatCard 
                    icon="🖥️" 
                    label="Active Workers" 
                    value={workers.length} 
                    color={THEME.primary} 
                />
                <StatCard 
                    icon="⏳" 
                    label="Pending Tasks" 
                    value={queue.length} 
                    color={THEME.warning} 
                />
                <StatCard 
                    icon="✅" 
                    label="Completed Jobs" 
                    value={stats.totalJobs || 0} 
                    color={THEME.success} 
                />
                </section>

                <div className="dashboard-grid">
                {/* LEFT COL: WORKER MANAGEMENT */}
                <div className="col-workers">
                    <div className="card">
                    <div className="card-header">
                        <h2>Worker Nodes</h2>
                        <button onClick={downloadWorker} className="btn-download">
                        ⬇ Tải Worker (.exe)
                        </button>
                    </div>
                    
                    <div className="card-body">
                        {workers.length === 0 ? (
                        <div className="empty-state">
                            <p>Chưa có Worker nào kết nối.</p>
                            <small>Hãy tải file worker.exe về máy tính và chạy để bắt đầu xử lý.</small>
                        </div>
                        ) : (
                        <ul className="worker-list">
                            {workers.map((worker, idx) => (
                            <li key={idx} className="worker-item">
                                <div className="worker-info">
                                <span className="worker-icon">🤖</span>
                                <div>
                                    <strong>{worker.id}</strong>
                                    <div className="worker-ip">Last seen: {new Date(worker.lastSeen).toLocaleTimeString()}</div>
                                </div>
                                </div>
                                <span className={`badge ${worker.status}`}>
                                {worker.status === 'busy' ? 'Đang xử lý...' : 'Đang chờ'}
                                </span>
                            </li>
                            ))}
                        </ul>
                        )}
                    </div>
                    <div className="card-footer">
                        <p>Hướng dẫn chạy:</p>
                        <code>worker.exe [Server_URL]</code>
                    </div>
                    </div>
                </div>

                {/* RIGHT COL: QUEUE & LOGS */}
                <div className="col-queue">
                    <div className="card">
                    <div className="card-header">
                        <h2>Job Queue</h2>
                        <span className="badge-count">{queue.length}</span>
                    </div>
                    <div className="card-body scrollable">
                        {queue.length === 0 ? (
                        <div className="empty-state">
                            <p>Hàng đợi trống.</p>
                        </div>
                        ) : (
                        <ul className="queue-list">
                            {queue.map((job, idx) => (
                            <li key={job.jobId} className="queue-item">
                                <span className="queue-idx">#{idx + 1}</span>
                                <div className="queue-details">
                                <strong>{job.data.title || 'Untitled Video'}</strong>
                                <small>Job ID: {job.jobId.substring(0, 8)}...</small>
                                </div>
                                <span className="queue-status">Waiting</span>
                            </li>
                            ))}
                        </ul>
                        )}
                    </div>
                    </div>
                </div>
                </div>
            </>
        )}

        {activeTab === 'users' && (
            <div className="card">
                <div className="card-header">
                    <h2>Registered Users</h2>
                    <span className="badge-count">{users.length}</span>
                </div>
                <div className="card-body">
                    {users.length === 0 ? (
                         <div className="empty-state">
                            <p>Chưa có người dùng nào đăng ký.</p>
                        </div>
                    ) : (
                        <table className="user-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Status</th>
                                    <th>Registered Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id}>
                                        <td><strong>{user.username}</strong></td>
                                        <td>
                                            <span className={`status-badge ${user.status}`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <div className="action-buttons">
                                                {user.status === 'pending' && (
                                                    <button className="btn-action approve" onClick={() => handleUserAction(user.id, 'approve')}>Approve</button>
                                                )}
                                                {user.status === 'banned' && (
                                                    <button className="btn-action approve" onClick={() => handleUserAction(user.id, 'approve')}>Unban</button>
                                                )}
                                                {user.status !== 'banned' && (
                                                    <button className="btn-action ban" onClick={() => handleUserAction(user.id, 'ban')}>Ban</button>
                                                )}
                                                <button className="btn-action delete" onClick={() => handleUserAction(user.id, 'delete')}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        )}

      </main>

      {/* --- CSS STYLES --- */}
      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          background-color: ${THEME.bg};
          color: ${THEME.textMain};
          line-height: 1.5;
        }
        
        /* Layout */
        .admin-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* Header */
        .header {
          background: ${THEME.cardBg};
          border-bottom: 1px solid ${THEME.border};
          padding: 1rem 2rem;
          box-shadow: ${THEME.shadow};
        }
        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header-actions { display: flex; align-items: center; gap: 1.5rem; }
        .brand { display: flex; align-items: center; gap: 1rem; }
        .logo-icon { font-size: 2rem; }
        .brand h1 { font-size: 1.25rem; font-weight: 700; color: ${THEME.textMain}; }
        .brand p { font-size: 0.875rem; color: ${THEME.textSec}; }
        
        .server-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          background: #edf2f7;
          padding: 0.5rem 1rem;
          border-radius: 99px;
        }
        .status-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background-color: #ccc;
        }
        .status-dot.online { background-color: ${THEME.success}; box-shadow: 0 0 0 3px rgba(56, 161, 105, 0.2); }
        
        .btn-logout {
            background: transparent; border: 1px solid ${THEME.border};
            padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;
            color: ${THEME.textSec}; font-size: 0.875rem;
        }
        .btn-logout:hover { border-color: ${THEME.textMain}; color: ${THEME.textMain}; }

        /* Main */
        .main {
          flex: 1;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          padding: 2rem;
        }

        /* Tabs */
        .tabs { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
        .tab-btn {
            background: transparent; border: none; padding: 0.75rem 1.5rem;
            font-size: 1rem; font-weight: 600; color: ${THEME.textSec};
            cursor: pointer; border-radius: 8px;
            transition: all 0.2s;
        }
        .tab-btn:hover { background: #e2e8f0; }
        .tab-btn.active { background: ${THEME.primary}; color: white; }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        /* Dashboard Grid */
        .dashboard-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 768px) {
          .dashboard-grid { grid-template-columns: 1fr; }
        }

        /* Card Component */
        .card {
          background: ${THEME.cardBg};
          border-radius: 12px;
          box-shadow: ${THEME.shadow};
          border: 1px solid ${THEME.border};
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .card-header {
          padding: 1.25rem;
          border-bottom: 1px solid ${THEME.border};
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .card-header h2 { font-size: 1.1rem; font-weight: 600; }
        .card-body { padding: 1.25rem; flex: 1; }
        .card-body.scrollable { max-height: 400px; overflow-y: auto; }
        .card-footer {
          background: #f7fafc;
          padding: 1rem 1.25rem;
          border-top: 1px solid ${THEME.border};
          font-size: 0.85rem;
          color: ${THEME.textSec};
        }
        .card-footer code {
          display: block;
          margin-top: 0.5rem;
          background: #e2e8f0;
          padding: 0.5rem;
          border-radius: 6px;
          font-family: monospace;
          color: #2d3748;
        }

        /* Buttons */
        .btn-download {
          background-color: ${THEME.textMain};
          color: white;
          border: none;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .btn-download:hover { background-color: #000; transform: translateY(-1px); }

        /* Worker List */
        .worker-list { list-style: none; }
        .worker-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 0;
          border-bottom: 1px solid ${THEME.border};
        }
        .worker-item:last-child { border-bottom: none; }
        .worker-info { display: flex; align-items: center; gap: 1rem; }
        .worker-icon {
          width: 40px; height: 40px;
          background: #ebf8ff; color: ${THEME.primary};
          display: flex; align-items: center; justify-content: center;
          border-radius: 10px; font-size: 1.25rem;
        }
        .worker-ip { font-size: 0.75rem; color: ${THEME.textSec}; }

        /* Queue List */
        .queue-list { list-style: none; }
        .queue-item {
          display: flex;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid ${THEME.border};
          gap: 1rem;
        }
        .queue-idx {
          font-size: 0.8rem; font-weight: bold; color: ${THEME.textSec};
          min-width: 25px;
        }
        .queue-details { flex: 1; }
        .queue-details strong { display: block; font-size: 0.95rem; }
        .queue-details small { font-size: 0.75rem; color: ${THEME.textSec}; }
        .queue-status {
          font-size: 0.75rem; background: #fffaf0; color: ${THEME.warning};
          padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid #feebc8;
        }

        /* Badges & States */
        .badge {
          font-size: 0.75rem; padding: 0.35rem 0.75rem; border-radius: 99px;
          font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .badge.idle { background-color: #c6f6d5; color: #22543d; }
        .badge.busy { background-color: #feebc8; color: #744210; }
        
        .badge-count {
          background: ${THEME.textMain}; color: white;
          padding: 0.25rem 0.6rem; border-radius: 12px; font-size: 0.75rem;
        }

        .empty-state {
          text-align: center; padding: 2rem 0; color: ${THEME.textSec};
        }

        /* User Table */
        .user-table { width: 100%; border-collapse: collapse; }
        .user-table th, .user-table td {
            text-align: left; padding: 1rem; border-bottom: 1px solid ${THEME.border};
        }
        .user-table th { color: ${THEME.textSec}; font-weight: 600; font-size: 0.875rem; }
        
        .status-badge {
            font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 99px;
            font-weight: 600; text-transform: capitalize;
        }
        .status-badge.active { background: #c6f6d5; color: #22543d; }
        .status-badge.pending { background: #feebc8; color: #744210; }
        .status-badge.banned { background: #fed7d7; color: #822727; }

        .action-buttons { display: flex; gap: 0.5rem; }
        .btn-action {
            border: none; padding: 0.4rem 0.8rem; border-radius: 4px;
            cursor: pointer; font-size: 0.75rem; font-weight: 600; color: white;
        }
        .btn-action.approve { background: ${THEME.success}; }
        .btn-action.ban { background: ${THEME.warning}; }
        .btn-action.delete { background: ${THEME.error}; }
      `}</style>
    </div>
  );
}

// --- SUB COMPONENTS ---
function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ backgroundColor: `${color}20`, color: color }}>
        {icon}
      </div>
      <div className="stat-content">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
      <style jsx>{`
        .stat-card {
          background: #ffffff;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: center;
          gap: 1rem;
          border: 1px solid #e2e8f0;
          transition: transform 0.2s;
        }
        .stat-card:hover { transform: translateY(-2px); }
        .stat-icon {
          width: 50px; height: 50px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem;
        }
        .stat-content { display: flex; flex-direction: column; }
        .stat-value { font-size: 1.75rem; font-weight: 700; color: #2d3748; line-height: 1.2; }
        .stat-label { font-size: 0.875rem; color: #718096; }
      `}</style>
    </div>
  );
}