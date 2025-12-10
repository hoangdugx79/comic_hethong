import { useState, useEffect } from 'react';
import Head from 'next/head';

const MUSIC_LIBRARY = [
  { id: '', name: '🔇 Không sử dụng nhạc', url: '' },
  { id: 'epic_battle', name: '⚔️ 1. Shonen Battle (Hành động kịch tính)', url: '' },
  { id: 'sad_emotional', name: '😢 2. Sad Backstory (Buồn/Cảm động)', url: '' },
  { id: 'tension_suspense', name: '😨 3. Plot Twist (Hồi hộp/Gay cấn)', url: '' },
  { id: 'heroic_victory', name: '🏆 4. Hero Arrives (Hào hùng)', url: '' },
  { id: 'comedy_funny', name: '😂 5. Funny Moments (Hài hước)', url: '' },
  { id: 'dark_villain', name: '😈 6. Villain Theme (Tăm tối/Ác nhân)', url: '' },
  { id: 'training_montage', name: '💪 7. Training Arc (Sôi động/Luyện tập)', url: '' },
  { id: 'japan_traditional', name: '🌸 8. Ancient Era (Cổ trang Nhật Bản)', url: '' },
  { id: 'lofi_chill', name: '☕ 9. Reading Mode (Lofi Chill)', url: '' },
  { id: 'horror_seinen', name: '👻 10. Horror/Gore (Kinh dị/Rùng rợn)', url: '' },
  { id: 'fast_paced', name: '⚡ 11. Speed Lines (Tiết tấu nhanh)', url: '' },
  { id: 'mystery_detective', name: '🕵️ 12. Investigation (Trinh thám/Jazz)', url: '' },
  { id: 'fantasy_adventure', name: '🌍 13. New World (Phiêu lưu giả tưởng)', url: '' },
  { id: 'romance_cute', name: '💕 14. Romance (Lãng mạn/Piano)', url: '' },
  { id: 'ending_credits', name: '🎬 15. Emotional Ending (Kết thúc cảm xúc)', url: '' }
];

const VIDEO_STYLES = [
  { id: 'blur_bg', name: '✨ Cinematic Blur (Đẹp nhất - Khuyên dùng)' },
  { id: 'scroll_down', name: '📜 Webtoon Scroll (Cuộn dọc từ trên xuống)' },
  { id: 'zoom_in', name: '🔍 Ken Burns (Zoom In chậm)' },
  /* Đã xóa Zoom Out theo yêu cầu */
  { id: 'pan_right', name: '➡️ Pan Right (Lướt sang phải)' },
  { id: 'pan_left', name: '⬅️ Pan Left (Lướt sang trái)' },
  { id: 'simple_fit', name: '⬛ Simple Fit (Mặc định - Viền đen)' },
  { id: 'smart_crop', name: '✂️ Smart Crop (Cắt full màn hình)' },
  { id: 'manga_bw', name: '✒️ Manga Mode (Trắng đen sắc nét)' },
  { id: 'sepia', name: '📜 Old Paper (Màu giấy cũ)' }
];

export default function Home() {
  // --- EXISTING STATES ---
  const [url, setUrl] = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [videoConfig, setVideoConfig] = useState({
    ratio: '16:9',
    style: 'blur_bg', 
    duration: 3
  });
  const [selectedMusic, setSelectedMusic] = useState(MUSIC_LIBRARY[0].id);

  // --- NEW AUTHENTICATION STATES ---
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null); // { username: string }
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
  const [authData, setAuthData] = useState({ username: '', password: '', confirmPass: '' });
  const [authStatus, setAuthStatus] = useState({ loading: false, error: '', success: '' });

  // --- EFFECT: CHECK LOGIN ---
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('username');
    if (savedToken && savedUser) {
        setToken(savedToken);
        setUser({ username: savedUser });
    }
  }, []);

  const handleLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      setToken(null);
      setUser(null);
      setImages([]); // Clear data on logout optional
  };

  const openAuthModal = (mode = 'login') => {
      setAuthMode(mode);
      setAuthStatus({ loading: false, error: '', success: '' });
      setAuthData({ username: '', password: '', confirmPass: '' });
      setShowAuthModal(true);
  };

  // --- LOGIC 1: Fetch Images (Updated with Token) ---
  const fetchImages = async () => {
    if (!url.trim()) return setError('Vui lòng nhập URL truyện tranh hợp lệ.');
    
    // Auth Check
    if (!token) {
        openAuthModal('login');
        return setError('Vui lòng đăng nhập để sử dụng tính năng này.');
    }

    setLoading(true); 
    setError(''); 
    setSuccessMsg('');

    try {
      const res = await fetch('/api/fetch-images', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Send Token
        },
        body: JSON.stringify({ url: url.trim() })
      });
      const data = await res.json();
      
      if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
              handleLogout();
              throw new Error(data.error || 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
          }
          throw new Error(data.error || 'Lỗi lấy ảnh');
      }
      
      setImages(prev => [...prev, ...data.images]);
      setSuccessMsg(`Đã thêm ${data.images.length} trang thành công!`);
      setUrl(''); 

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearImages = () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ danh sách ảnh để làm lại từ đầu không?')) {
      setImages([]);
      setUrl('');
      setError('');
      setSuccessMsg('');
    }
  };

  // --- LOGIC 2: Create Video (Updated with Token) ---
  const createAndDownloadVideo = async () => {
    if (images.length === 0) return;
    
    // Auth Check
    if (!token) {
        openAuthModal('login');
        return setError('Vui lòng đăng nhập để tạo video.');
    }

    setVideoLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const response = await fetch('/api/create-video', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Send Token
        },
        body: JSON.stringify({ 
          images, 
          config: {
            ratio: videoConfig.ratio,
            style: videoConfig.style,
            durationPerImg: Number(videoConfig.duration)
          },
          musicUrl: selectedMusic 
        })
      });

      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const errJson = await response.json();
          if (response.status === 401 || response.status === 403) {
             handleLogout();
             throw new Error(errJson.error || 'Phiên đăng nhập hết hạn.');
          }
          throw new Error(errJson.error || 'Lỗi từ server');
        } else {
          throw new Error(`Lỗi Server (${response.status}). Vui lòng thử lại.`);
        }
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const musicLabel = selectedMusic ? `_${selectedMusic}` : '_no-music';
      a.download = `comic_${videoConfig.style}_${videoConfig.ratio.replace(':','-')}${musicLabel}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setVideoLoading(false);
    }
  };

  // --- LOGIC 3: Authentication (Register & Login) ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthStatus({ loading: true, error: '', success: '' });

    // Validate
    if (!authData.username || !authData.password) {
        setAuthStatus({ loading: false, error: 'Vui lòng điền đầy đủ thông tin.', success: '' });
        return;
    }

    if (authMode === 'register') {
        if (authData.password !== authData.confirmPass) {
            setAuthStatus({ loading: false, error: 'Mật khẩu xác nhận không khớp.', success: '' });
            return;
        }
    }

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              username: authData.username, 
              password: authData.password 
          })
      });

      const data = await res.json();

      if (!res.ok) {
          throw new Error(data.error || 'Thao tác thất bại');
      }

      if (authMode === 'login') {
          // Login Success
          setToken(data.token);
          setUser({ username: data.username });
          localStorage.setItem('token', data.token);
          localStorage.setItem('username', data.username);
          setShowAuthModal(false);
          setSuccessMsg(`Chào mừng ${data.username} quay trở lại!`);
      } else {
          // Register Success
          setAuthStatus({ 
              loading: false, 
              error: '', 
              success: 'Đăng ký thành công! Vui lòng chờ Admin duyệt tài khoản.' 
          });
      }
      
    } catch (err) {
      setAuthStatus({ loading: false, error: err.message, success: '' });
    }
  };

  return (
    <>
      <Head>
        <title>Manga Studio AI - Professional Video Maker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      {/* --- MODERN CSS SYSTEM --- */}
      <style jsx global>{`
        :root {
          /* Premium Color Palette */
          --primary: #6366f1; /* Indigo 500 */
          --primary-dark: #4f46e5; /* Indigo 600 */
          --primary-light: #818cf8; /* Indigo 400 */
          --secondary: #ec4899; /* Pink 500 */
          --surface: #ffffff;
          --background: #f8fafc; /* Slate 50 */
          --text-primary: #1e293b; /* Slate 800 */
          --text-secondary: #64748b; /* Slate 500 */
          --border: #e2e8f0; /* Slate 200 */
          --success-bg: #f0fdf4;
          --success-text: #15803d;
          --error-bg: #fef2f2;
          --error-text: #b91c1c;
          
          /* Shadows & Radius */
          --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
          --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
          --radius-lg: 16px;
          --radius-md: 12px;
        }

        body {
          margin: 0;
          padding: 0;
          background-color: var(--background);
          font-family: 'Inter', -apple-system, sans-serif;
          color: var(--text-primary);
          -webkit-font-smoothing: antialiased;
          line-height: 1.5;
        }

        * { box-sizing: border-box; }

        /* Animation Keyframes */
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Layout Utilities */
        .container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px 60px 24px;
        }

        /* Custom Scrollbar for Preview */
        .custom-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Form Elements Hover/Focus */
        .input-focus-effect:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
        }
        
        .btn-hover-effect {
          transition: all 0.2s ease;
        }
        .btn-hover-effect:hover:not(:disabled) {
          transform: translateY(-2px);
          filter: brightness(110%);
        }
        .btn-hover-effect:active:not(:disabled) {
          transform: translateY(0);
        }

        /* Responsive Grid System */
        .workspace-layout {
          display: grid;
          gap: 32px;
          grid-template-columns: 1fr;
          animation: fadeIn 0.5s ease-out;
        }
        
        @media (min-width: 1024px) {
          .workspace-layout {
            grid-template-columns: 420px 1fr;
            align-items: start;
          }
        }
        
        .grid-2-col {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 640px) {
          .grid-2-col { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="page-wrapper">
        {/* HEADER - Glassmorphism Style */}
        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.headerLeft}>
                <div style={styles.logoContainer}>
                <div style={styles.logoIconBg}>
                    <span style={{ fontSize: '24px' }}>⛩️</span>
                </div>
                <div style={styles.logoTextGroup}>
                    <h1 style={styles.appTitle}>Manga Studio <span style={styles.badgePro}>AI PRO</span></h1>
                    <p style={styles.tagline}>Create viral videos from comics in seconds</p>
                </div>
                </div>
            </div>

            {/* AUTH SECTION */}
            <div style={styles.headerRight}>
                {user ? (
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                            <span style={{fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)'}}>
                                Hello, {user.username}
                            </span>
                            <span style={{fontSize: '11px', color: 'var(--success-text)', background: 'var(--success-bg)', padding: '0 6px', borderRadius: '4px'}}>
                                Active Member
                            </span>
                        </div>
                        <button 
                            onClick={handleLogout} 
                            style={styles.btnOutline}
                            className="btn-hover-effect"
                        >
                            Logout
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={() => openAuthModal('login')} 
                        style={styles.btnRegisterHeader}
                        className="btn-hover-effect"
                    >
                        Login / Sign Up
                    </button>
                )}
            </div>
          </div>
        </header>

        <main className="container">
          
          {/* STEP 1: INPUT URL */}
          <section style={styles.sectionCard}>
            <div style={styles.cardHeader}>
              <div style={styles.stepIndicator}>1</div>
              <div>
                <h2 style={styles.cardTitle}>
                  {images.length === 0 ? 'Start Project' : 'Add More Content'}
                </h2>
                <p style={styles.cardSubtitle}>
                  {images.length === 0 ? 'Nhập liên kết truyện tranh để bắt đầu.' : 'Dán link chapter tiếp theo để nối vào video hiện tại.'}
                </p>
              </div>
            </div>
            
            <div style={styles.inputGroup}>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={images.length === 0 ? "https://truyen-site.com/chapter-1..." : "https://truyen-site.com/chapter-2..."}
                style={styles.mainInput}
                className="input-focus-effect"
                onKeyDown={(e) => e.key === 'Enter' && fetchImages()}
              />
              
              <div style={styles.actionButtons}>
                <button 
                  onClick={fetchImages} 
                  disabled={loading} 
                  style={{...styles.btnPrimary, ...(loading ? styles.btnDisabled : {})}}
                  className="btn-hover-effect"
                >
                  {loading ? (
                    <>
                      <span style={styles.spinnerSmall}></span> Loading...
                    </>
                  ) : (
                    <>
                      {images.length > 0 ? '➕ Add Chapter' : '🚀 Import Images'}
                    </>
                  )}
                </button>
                
                {images.length > 0 && (
                  <button 
                    onClick={clearImages}
                    style={styles.btnOutline}
                    className="btn-hover-effect"
                    title="Clear All"
                  >
                    🗑️ Reset
                  </button>
                )}
              </div>
            </div>
            
            {/* Status Messages */}
            {error && (
              <div style={styles.alertError}>
                <span style={styles.alertIcon}>⚠️</span>
                <span><strong>Error:</strong> {error}</span>
              </div>
            )}
            
            {successMsg && (
              <div style={styles.alertSuccess}>
                <span style={styles.alertIcon}>✅</span>
                <span>{successMsg}</span>
              </div>
            )}
          </section>

          {/* MAIN WORKSPACE: CONFIG & PREVIEW */}
          {images.length > 0 && (
            <div className="workspace-layout">
              
              {/* LEFT: STUDIO CONFIGURATION */}
              <div style={styles.configPanel}>
                <div style={styles.sectionCard}>
                  <div style={styles.cardHeader}>
                    <div style={styles.stepIndicator}>2</div>
                    <div>
                      <h2 style={styles.cardTitle}>Studio Settings</h2>
                      <p style={styles.cardSubtitle}>Tùy chỉnh thông số video</p>
                    </div>
                  </div>

                  <div style={styles.formStack}>
                    {/* Visual Style */}
                    <div style={styles.formField}>
                      <label style={styles.fieldLabel}>Video Style / Transition</label>
                      <div style={styles.selectContainer}>
                        <select 
                          value={videoConfig.style}
                          onChange={e => setVideoConfig({...videoConfig, style: e.target.value})}
                          style={styles.selectInput}
                          className="input-focus-effect"
                        >
                          {VIDEO_STYLES.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <span style={styles.selectArrow}>▼</span>
                      </div>
                    </div>

                    {/* Music */}
                    <div style={styles.formField}>
                      <label style={styles.fieldLabel}>Background Music</label>
                      <div style={styles.selectContainer}>
                        <select 
                          value={selectedMusic}
                          onChange={e => setSelectedMusic(e.target.value)}
                          style={styles.selectInput}
                          className="input-focus-effect"
                        >
                          {MUSIC_LIBRARY.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                        <span style={styles.selectArrow}>♫</span>
                      </div>
                    </div>

                    {/* Grid: Ratio & Duration */}
                    <div className="grid-2-col">
                      <div style={styles.formField}>
                        <label style={styles.fieldLabel}>Aspect Ratio</label>
                        <div style={styles.selectContainer}>
                          <select 
                            value={videoConfig.ratio}
                            onChange={e => setVideoConfig({...videoConfig, ratio: e.target.value})}
                            style={styles.selectInput}
                            className="input-focus-effect"
                          >
                            <option value="16:9">16:9 (YouTube/TV)</option>
                            <option value="9:16">9:16 (TikTok/Shorts)</option>
                          </select>
                        </div>
                      </div>

                      <div style={styles.formField}>
                        <label style={styles.fieldLabel}>Duration (sec/img)</label>
                        <input 
                          type="number" min="1" max="10" 
                          value={videoConfig.duration}
                          onChange={e => setVideoConfig({...videoConfig, duration: e.target.value})}
                          style={styles.inputNumber}
                          className="input-focus-effect"
                        />
                      </div>
                    </div>

                    {/* Summary Info */}
                    <div style={styles.summaryBox}>
                      <div style={styles.summaryItem}>
                        <span style={styles.summaryLabel}>Total Pages</span>
                        <span style={styles.summaryValue}>{images.length}</span>
                      </div>
                      <div style={styles.summaryDivider}></div>
                      <div style={styles.summaryItem}>
                        <span style={styles.summaryLabel}>Est. Length</span>
                        <span style={styles.summaryValue}>{images.length * videoConfig.duration}s</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button 
                      onClick={createAndDownloadVideo} 
                      disabled={videoLoading}
                      style={{
                        ...styles.btnRender, 
                        ...(videoLoading ? styles.btnRenderDisabled : {})
                      }}
                      className="btn-hover-effect"
                    >
                      {videoLoading ? (
                        <div style={styles.loadingContent}>
                          <span style={styles.spinner}></span>
                          <span>Rendering Video...</span>
                        </div>
                      ) : (
                        <div style={styles.renderContent}>
                          <span style={{fontSize: '20px'}}>🎬</span>
                          <span>RENDER & DOWNLOAD</span>
                        </div>
                      )}
                    </button>
                    {videoLoading && <p style={styles.loadingNote}>Vui lòng không tắt trình duyệt. Quá trình có thể mất 1-2 phút.</p>}
                  </div>
                </div>
              </div>

              {/* RIGHT: PREVIEW GALLERY */}
              <div style={styles.previewPanel}>
                <div style={{...styles.sectionCard, height: '100%', display: 'flex', flexDirection: 'column'}}>
                  <div style={styles.cardHeader}>
                    <div>
                      <h2 style={styles.cardTitle}>Preview Gallery</h2>
                      <p style={styles.cardSubtitle}>Danh sách ảnh đã tải ({images.length})</p>
                    </div>
                  </div>
                  
                  <div style={styles.scrollArea} className="custom-scroll">
                    <div style={styles.masonryGrid}>
                      {images.map((img, idx) => (
                        <div key={idx} style={styles.imageCard}>
                          <div style={styles.imageOverlay}>
                            <span style={styles.imageIndex}>#{idx + 1}</span>
                          </div>
                          <img src={img.url} style={styles.thumbImg} loading="lazy" alt={`Page ${idx}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </main>

        {/* --- AUTHENTICATION MODAL (LOGIN & REGISTER) --- */}
        {showAuthModal && (
            <div style={styles.modalOverlay}>
                <div style={styles.modalCard} className="modal-animate">
                    <div style={styles.modalHeader}>
                        <h3 style={styles.modalTitle}>
                            {authMode === 'login' ? 'Đăng Nhập' : 'Đăng Ký Tài Khoản'}
                        </h3>
                        <button 
                            onClick={() => setShowAuthModal(false)} 
                            style={styles.modalCloseBtn}
                        >
                            ✕
                        </button>
                    </div>

                    {/* TABS */}
                    <div style={styles.tabContainer}>
                        <button 
                            style={{...styles.tabButton, ...(authMode === 'login' ? styles.tabActive : {})}}
                            onClick={() => { setAuthMode('login'); setAuthStatus({loading: false, error: '', success: ''}); }}
                        >
                            Đăng Nhập
                        </button>
                        <button 
                            style={{...styles.tabButton, ...(authMode === 'register' ? styles.tabActive : {})}}
                            onClick={() => { setAuthMode('register'); setAuthStatus({loading: false, error: '', success: ''}); }}
                        >
                            Đăng Ký
                        </button>
                    </div>
                    
                    <div style={styles.modalBody}>
                        {authStatus.success && authMode === 'register' ? (
                            <div style={{textAlign: 'center', padding: '20px 0'}}>
                                <div style={{fontSize: '40px', marginBottom: '16px'}}>🎉</div>
                                <h4 style={{color: 'var(--success-text)', margin: 0}}>Thành công!</h4>
                                <p style={{color: 'var(--text-secondary)'}}>{authStatus.success}</p>
                                <button 
                                    onClick={() => setShowAuthModal(false)}
                                    style={{...styles.btnPrimary, width: '100%', marginTop: '20px', justifyContent: 'center'}}
                                >
                                    Đóng
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleAuthSubmit} style={styles.formStack}>
                                <div style={styles.formField}>
                                    <label style={styles.fieldLabel}>Tên đăng nhập</label>
                                    <input 
                                        type="text" 
                                        value={authData.username}
                                        onChange={e => setAuthData({...authData, username: e.target.value})}
                                        style={styles.mainInput}
                                        className="input-focus-effect"
                                        placeholder="User123"
                                        autoFocus
                                    />
                                </div>
                                <div style={styles.formField}>
                                    <label style={styles.fieldLabel}>Mật khẩu</label>
                                    <input 
                                        type="password" 
                                        value={authData.password}
                                        onChange={e => setAuthData({...authData, password: e.target.value})}
                                        style={styles.mainInput}
                                        className="input-focus-effect"
                                        placeholder="••••••••"
                                    />
                                </div>
                                
                                {authMode === 'register' && (
                                    <div style={styles.formField}>
                                        <label style={styles.fieldLabel}>Xác nhận mật khẩu</label>
                                        <input 
                                            type="password" 
                                            value={authData.confirmPass}
                                            onChange={e => setAuthData({...authData, confirmPass: e.target.value})}
                                            style={styles.mainInput}
                                            className="input-focus-effect"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                )}

                                {authStatus.error && (
                                    <div style={{...styles.alertError, marginTop: '8px', padding: '12px'}}>
                                        <span style={{fontSize: '14px'}}>⚠️ {authStatus.error}</span>
                                    </div>
                                )}

                                <button 
                                    type="submit" 
                                    disabled={authStatus.loading}
                                    style={{
                                        ...styles.btnPrimary, 
                                        width: '100%', 
                                        justifyContent: 'center', 
                                        marginTop: '16px',
                                        ...(authStatus.loading ? styles.btnDisabled : {})
                                    }}
                                    className="btn-hover-effect"
                                >
                                    {authStatus.loading ? (
                                        <>
                                            <span style={styles.spinnerSmall}></span> Processing...
                                        </>
                                    ) : (
                                        authMode === 'login' ? 'Đăng Nhập' : 'Đăng Ký Ngay'
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>
    </>
  );
}

// --- PREMIUM JAVASCRIPT STYLES OBJECT ---
const styles = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
    marginBottom: '40px',
  },
  headerInner: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerLeft: {
      display: 'flex',
      alignItems: 'center'
  },
  headerRight: {
      display: 'flex',
      alignItems: 'center'
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  logoIconBg: {
    width: '48px',
    height: '48px',
    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    border: '1px solid #bbf7d0'
  },
  logoTextGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  appTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '800',
    letterSpacing: '-0.5px',
    color: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  badgePro: {
    fontSize: '11px',
    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: '700',
    letterSpacing: '0.5px'
  },
  tagline: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#64748b',
    fontWeight: '500'
  },
  sectionCard: {
    background: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border)',
    padding: '32px',
    transition: 'box-shadow 0.3s ease',
  },
  cardHeader: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    alignItems: 'flex-start'
  },
  stepIndicator: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#eff6ff',
    color: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '16px',
    border: '1px solid #c7d2fe',
    flexShrink: 0
  },
  cardTitle: {
    margin: '0 0 4px 0',
    fontSize: '18px',
    fontWeight: '700',
    color: '#1e293b'
  },
  cardSubtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#64748b'
  },
  inputGroup: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap'
  },
  mainInput: {
    flex: 1,
    padding: '14px 18px',
    fontSize: '16px',
    borderRadius: 'var(--radius-md)',
    border: '2px solid var(--border)',
    background: '#fff',
    outline: 'none',
    transition: 'all 0.2s ease',
    minWidth: '300px',
    color: '#334155'
  },
  actionButtons: {
    display: 'flex',
    gap: '12px'
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    color: 'white',
    border: 'none',
    padding: '0 28px',
    height: '52px',
    borderRadius: 'var(--radius-md)',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap'
  },
  btnOutline: {
    background: 'transparent',
    color: '#ef4444',
    border: '2px solid #fee2e2',
    padding: '0 20px',
    height: '52px',
    borderRadius: 'var(--radius-md)',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  btnRegisterHeader: {
    background: 'white',
    color: '#4f46e5',
    border: '2px solid #e0e7ff',
    padding: '0 24px',
    height: '44px',
    borderRadius: 'var(--radius-md)',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  btnDisabled: {
    background: '#94a3b8',
    cursor: 'not-allowed',
    boxShadow: 'none',
    transform: 'none !important'
  },
  alertError: {
    marginTop: '20px',
    background: 'var(--error-bg)',
    color: 'var(--error-text)',
    padding: '16px',
    borderRadius: 'var(--radius-md)',
    fontSize: '14px',
    border: '1px solid #fecaca',
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  alertSuccess: {
    marginTop: '20px',
    background: 'var(--success-bg)',
    color: 'var(--success-text)',
    padding: '16px',
    borderRadius: 'var(--radius-md)',
    fontSize: '14px',
    border: '1px solid #bbf7d0',
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  alertIcon: { fontSize: '18px' },
  configPanel: {
    minWidth: '300px'
  },
  formStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  fieldLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  selectContainer: {
    position: 'relative'
  },
  selectInput: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: '#fff',
    color: '#1e293b',
    outline: 'none',
    appearance: 'none',
    cursor: 'pointer',
    fontWeight: '500'
  },
  selectArrow: {
    position: 'absolute',
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: '#94a3b8',
    fontSize: '12px'
  },
  inputNumber: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    outline: 'none',
    color: '#1e293b',
    fontWeight: '500'
  },
  summaryBox: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1
  },
  summaryLabel: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: '4px'
  },
  summaryValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a'
  },
  summaryDivider: {
    width: '1px',
    height: '30px',
    background: '#cbd5e1'
  },
  btnRender: {
    background: 'linear-gradient(to right, #10b981, #059669)',
    color: 'white',
    border: 'none',
    padding: '18px',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
    marginTop: '8px',
    overflow: 'hidden'
  },
  btnRenderDisabled: {
    background: '#94a3b8',
    cursor: 'wait',
    boxShadow: 'none',
    transform: 'none'
  },
  renderContent: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    fontSize: '16px',
    fontWeight: '700',
    letterSpacing: '0.5px'
  },
  loadingContent: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    fontSize: '15px',
    fontWeight: '600'
  },
  loadingNote: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#64748b',
    margin: '12px 0 0 0'
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  spinnerSmall: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  previewPanel: {
    height: 'calc(100vh - 140px)',
    minHeight: '600px',
    position: 'sticky',
    top: '120px'
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    marginTop: '16px',
    paddingRight: '8px',
    paddingBottom: '16px'
  },
  masonryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '16px'
  },
  imageCard: {
    position: 'relative',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    aspectRatio: '2/3',
    background: '#f1f5f9',
    transition: 'transform 0.2s',
    border: '1px solid #e2e8f0'
  },
  imageOverlay: {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 30%)',
    zIndex: 1
  },
  imageIndex: {
    position: 'absolute',
    top: '8px',
    left: '8px',
    color: 'white',
    fontSize: '11px',
    fontWeight: '700',
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    padding: '2px 8px',
    borderRadius: '6px',
    zIndex: 2
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block'
  },
  // --- MODAL STYLES ---
  modalOverlay: {
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeIn 0.2s ease-out'
  },
  modalCard: {
      background: '#fff',
      width: '100%',
      maxWidth: '400px',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      overflow: 'hidden',
      border: '1px solid var(--border)'
  },
  modalHeader: {
      padding: '20px 24px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
  },
  modalTitle: {
      margin: 0,
      fontSize: '18px',
      fontWeight: '700',
      color: 'var(--text-primary)'
  },
  modalCloseBtn: {
      background: 'transparent',
      border: 'none',
      fontSize: '20px',
      color: 'var(--text-secondary)',
      cursor: 'pointer'
  },
  modalBody: {
      padding: '24px'
  },
  // --- NEW STYLES FOR AUTH TABS ---
  tabContainer: {
      display: 'flex',
      borderBottom: '1px solid var(--border)',
      background: '#f8fafc'
  },
  tabButton: {
      flex: 1,
      padding: '14px',
      border: 'none',
      background: 'transparent',
      fontSize: '14px',
      fontWeight: '600',
      color: 'var(--text-secondary)',
      cursor: 'pointer',
      transition: 'all 0.2s',
      borderBottom: '2px solid transparent'
  },
  tabActive: {
      color: 'var(--primary)',
      borderBottom: '2px solid var(--primary)',
      background: '#ffffff'
  }
};