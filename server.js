require('dotenv').config();

const express = require('express');
const next = require('next');
const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const uniqueSlug = require('unique-slug');
const sharp = require('sharp');
const crypto = require('crypto');
const http = require('http');
const { exec } = require('child_process');
const os = require('os');
const multer = require('multer');


sharp.cache(false);

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

ffmpeg.setFfmpegPath(ffmpegPath);

const PORT = process.env.PORT || 3000;

// ============ SETUP DIRECTORIES ============
const MUSIC_CACHE_DIR = path.join(__dirname, 'music_cache');
fs.ensureDirSync(MUSIC_CACHE_DIR);

const USERS_FILE = path.join(__dirname, 'users.json');
fs.ensureFile(USERS_FILE).then(() => {
  fs.readFile(USERS_FILE, 'utf8').then(data => {
    if (!data) fs.writeJson(USERS_FILE, []);
  }).catch(() => fs.writeJson(USERS_FILE, []));
});

// Ensure public/downloads for pre-built worker
const DOWNLOADS_DIR = path.join(__dirname, 'public', 'downloads');
fs.ensureDirSync(DOWNLOADS_DIR);

const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
fs.ensureDirSync(UPLOADS_DIR);

const sanitizeFilename = (name) => {
  return name.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 80) || 'image';
};

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destPath = req.uploadBatchDir || UPLOADS_DIR;
    cb(null, destPath);
  },
  filename: (req, file, cb) => {
    req.uploadCounter = (req.uploadCounter || 0) + 1;
    const parsed = path.parse(file.originalname || '');
    const safeBase = sanitizeFilename(parsed.name || 'page');
    const ext = (parsed.ext && parsed.ext.length <= 6 ? parsed.ext : '.jpg') || '.jpg';
    const seq = String(req.uploadCounter).padStart(4, '0');
    cb(null, `${seq}-${safeBase}${ext.toLowerCase()}`);
  }
});

const uploadFileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed.'), false);
  }
};

const upload = multer({
  storage: uploadStorage,
  fileFilter: uploadFileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 800
  }
});

// ============ MUSIC LIBRARY ============
const MANGA_MUSIC_LIBRARY = [
  { id: 'epic_battle', name: '1. Shonen Battle (Epic Rock)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Volatile%20Reaction.mp3', tag: 'Action' },
  { id: 'sad_emotional', name: '2. Sad Backstory (Piano/Violin)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sad%20Trio.mp3', tag: 'Sad' },
  { id: 'tension_suspense', name: '3. Plot Twist (Suspense)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Oppressive%20Gloom.mp3', tag: 'Mystery' },
  { id: 'heroic_victory', name: '4. Hero Arrives (Orchestral)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Heroic%20Age.mp3', tag: 'Epic' },
  { id: 'comedy_funny', name: '5. Funny Moments (Slice of Life)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Monkeys%20Spinning%20Monkeys.mp3', tag: 'Fun' },
  { id: 'dark_villain', name: '6. Villain Theme (Dark/Creepy)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Impact%20Moderato.mp3', tag: 'Dark' },
  { id: 'training_montage', name: '7. Training Arc (Upbeat)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Take%20a%20Chance.mp3', tag: 'Motivational' },
  { id: 'japan_traditional', name: '8. Ancient Era (Shamisen/Koto)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Ishikari%20Lore.mp3', tag: 'Traditional' },
  { id: 'lofi_chill', name: '9. Reading Mode (Lofi Hip Hop)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Dream%20Culture.mp3', tag: 'Chill' },
  { id: 'horror_seinen', name: '10. Horror/Gore (Ambient)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Giant%20Wyrm.mp3', tag: 'Horror' },
  { id: 'fast_paced', name: '11. Speed Lines (Fast Drum&Bass)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Movement%20Proposition.mp3', tag: 'Fast' },
  { id: 'mystery_detective', name: '12. Investigation (Detective)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/I%20Knew%20a%20Guy.mp3', tag: 'Jazz' },
  { id: 'fantasy_adventure', name: '13. New World (Fantasy)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Celtic%20Impulse.mp3', tag: 'Adventure' },
  { id: 'romance_cute', name: '14. Romance (Cute/Piano)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Touching%20Moments%20Two.mp3', tag: 'Romance' },
  { id: 'ending_credits', name: '15. Emotional Ending (Finale)', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sovereign.mp3', tag: 'Ending' }
];

// ============ WORKER & JOB MANAGEMENT ============
const activeWorkers = new Map();
const jobToWorker = new Map();
const globalStats = { totalJobs: 0 };
const activeSessions = new Map();

// ============ AUTH HELPERS ============
const hashPassword = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
};

const validatePassword = (password, hash, salt) => {
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return checkHash === hash;
};

const getUsers = async () => {
  try {
    return await fs.readJson(USERS_FILE);
  } catch (e) {
    return [];
  }
};

const saveUsers = async (users) => {
  await fs.writeJson(USERS_FILE, users, { spaces: 2 });
};

const getLocalExternalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

const prepareUploadDir = async (req, res, next) => {
  try {
    const userFolder = req.user?.id || 'guest';
    const batchId = uniqueSlug();
    const batchDir = path.join(UPLOADS_DIR, userFolder, batchId);

    await fs.ensureDir(batchDir);

    req.uploadUserFolder = userFolder;
    req.uploadBatchId = batchId;
    req.uploadBatchDir = batchDir;
    next();
  } catch (error) {
    next(error);
  }
};

const requireUserAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
  }
  
  const token = authHeader.split(' ')[1];
  const sessionUser = activeSessions.get(token);
  if (!sessionUser) {
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
  
  const users = await getUsers();
  const currentUser = users.find(u => u.id === sessionUser.id);
  if (!currentUser) {
    activeSessions.delete(token);
    return res.status(401).json({ error: 'Tài khoản không tồn tại.' });
  }
  
  if (currentUser.status === 'banned') {
    activeSessions.delete(token);
    return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa.' });
  }
  
  if (currentUser.status === 'pending') {
    return res.status(403).json({ error: 'Tài khoản đang chờ Admin duyệt.' });
  }
  
  req.user = currentUser;
  next();
};

// Cleanup stale workers
setInterval(() => {
  const now = Date.now();
  for (const [id, info] of activeWorkers.entries()) {
    if (now - info.lastSeen > 10000 && info.status !== 'busy') {
      activeWorkers.delete(id);
    }
  }
}, 5000);

// ============ EXPRESS SERVER ============
app.prepare().then(() => {
  const server = express();
  
  server.use(express.json({ limit: '500mb' }));
  server.use(express.raw({ type: 'video/mp4', limit: '500mb' }));
  server.use(cors());
  server.use('/uploads', express.static(UPLOADS_DIR));
  
  const jobQueue = [];
  const pendingResponses = new Map();
  
  // ============ AUTH API ============
  server.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin.' });
    
    const users = await getUsers();
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại.' });
    }
    
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = hashPassword(password, salt);
    const newUser = {
      id: uniqueSlug(),
      username,
      salt,
      passwordHash: hashedPassword,
      status: 'pending',
      createdAt: Date.now()
    };
    
    users.push(newUser);
    await saveUsers(users);
    res.json({ success: true, message: 'Đăng ký thành công. Vui lòng chờ Admin duyệt.' });
  });
  
  server.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const users = await getUsers();
    const user = users.find(u => u.username === username);
    
    if (!user) return res.status(400).json({ error: 'Sai tên đăng nhập hoặc mật khẩu.' });
    if (!validatePassword(password, user.passwordHash, user.salt)) {
      return res.status(400).json({ error: 'Sai tên đăng nhập hoặc mật khẩu.' });
    }
    
    if (user.status === 'banned') return res.status(403).json({ error: 'Tài khoản đã bị khóa.' });
    if (user.status === 'pending') return res.status(403).json({ error: 'Tài khoản đang chờ duyệt.' });
    
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, { id: user.id, username: user.username });
    res.json({ success: true, token, username: user.username });
  });
  
  // ============ WORKER API ============
  server.get('/api/worker/get-task', (req, res) => {
    const { workerId } = req.query;
    
    if (workerId) {
      if (!activeWorkers.has(workerId)) {
        activeWorkers.set(workerId, { id: workerId, status: 'idle', lastSeen: Date.now() });
      } else {
        const w = activeWorkers.get(workerId);
        if (w.status !== 'busy') {
          activeWorkers.set(workerId, { ...w, status: 'idle', lastSeen: Date.now() });
        } else {
          activeWorkers.set(workerId, { ...w, lastSeen: Date.now() });
        }
      }
      
      if (jobQueue.length > 0) {
        const job = jobQueue.shift();
        console.log(`[Dispatcher] Sending Job ${job.jobId} to Worker ${workerId}`);
        
        activeWorkers.set(workerId, { id: workerId, status: 'busy', lastSeen: Date.now() });
        jobToWorker.set(job.jobId, workerId);
        
        return res.json(job.data);
      }
    }
    
    res.json(null);
  });
  
  server.post('/api/worker/submit-result/:jobId', express.raw({ type: '*/*', limit: '500mb' }), (req, res) => {
    const { jobId } = req.params;
    const videoBuffer = req.body;
    
    console.log(`✅ Received result for Job ${jobId}`);
    globalStats.totalJobs = (globalStats.totalJobs || 0) + 1;
    
    const workerId = jobToWorker.get(jobId);
    if (workerId && activeWorkers.has(workerId)) {
      const w = activeWorkers.get(workerId);
      activeWorkers.set(workerId, { ...w, status: 'idle', lastSeen: Date.now() });
      jobToWorker.delete(jobId);
    }
    
    const clientRes = pendingResponses.get(jobId);
    if (clientRes) {
      const { res: userRes, jobTitle } = clientRes;
      const seoFilename = `${jobTitle}.mp4`;
      userRes.setHeader('Content-Type', 'video/mp4');
      userRes.setHeader('Content-Disposition', `attachment; filename="${seoFilename}"`);
      userRes.send(videoBuffer);
      pendingResponses.delete(jobId);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Client disconnected' });
    }
  });
  
  server.post('/api/worker/report-error/:jobId', (req, res) => {
    const { jobId } = req.params;
    const { error } = req.body;
    
    console.error(`❌ Job ${jobId} failed: ${error}`);
    
    const workerId = jobToWorker.get(jobId);
    if (workerId && activeWorkers.has(workerId)) {
      const w = activeWorkers.get(workerId);
      activeWorkers.set(workerId, { ...w, status: 'idle', lastSeen: Date.now() });
      jobToWorker.delete(jobId);
    }
    
    const clientRes = pendingResponses.get(jobId);
    if (clientRes) {
      clientRes.res.status(500).json({ error: error });
      pendingResponses.delete(jobId);
    }
    
    res.json({ received: true });
  });
  
  // ============ VIDEO CREATION API ============
  server.post('/api/create-video', requireUserAuth, async (req, res) => {
    const { images, config, musicUrl, title } = req.body;
    if (!images || images.length === 0) return res.status(400).json({ error: 'Không có ảnh đầu vào' });
    
    req.setTimeout(600000);
    
    const jobId = uniqueSlug();
    let finalMusicUrl = musicUrl;
    
    if (musicUrl && !musicUrl.startsWith('http')) {
      const foundTrack = MANGA_MUSIC_LIBRARY.find(t => t.id === musicUrl);
      if (foundTrack) finalMusicUrl = foundTrack.url;
    }
    
    let seoFilename = title 
      ? title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-') 
      : 'video';
    
    pendingResponses.set(jobId, { res, jobTitle: seoFilename });
    jobQueue.push({ jobId, data: { jobId, images, config, musicUrl: finalMusicUrl, title } });
    
    console.log(`Job ${jobId} added to queue by User: ${req.user.username}`);
  });

  // ============ IMAGE UPLOAD API ============
  const uploadImagesMiddleware = upload.array('images', 800);
  server.post('/api/upload-images', requireUserAuth, prepareUploadDir, (req, res) => {
    uploadImagesMiddleware(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Tải ảnh thất bại' });
      }
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Khong co hinh nao duoc tai len.' });
      }

      const protoHeader = req.get('x-forwarded-proto') || req.protocol || 'http';
      const hostHeader = req.get('x-forwarded-host') || req.get('host') || 'localhost';
      const proto = protoHeader.split(',')[0];
      const baseUrl = `${proto}://${hostHeader}`;

      const responseImages = req.files.map((file, index) => {
        const relativePath = `/uploads/${req.uploadUserFolder}/${req.uploadBatchId}/${file.filename}`.replace(/\\/g, '/');
        return {
          url: `${baseUrl}${relativePath}`,
          alt: file.originalname || `Upload ${index + 1}`
        };
      });

      res.json({
        success: true,
        uploadId: req.uploadBatchId,
        count: responseImages.length,
        images: responseImages
      });
    });
  });
  
  // ============ SCRAPE API ============
  server.post('/api/fetch-images', requireUserAuth, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    
    try {
      const urlObj = new URL(url);
      const comicId = urlObj.searchParams.get('comicId');
      const episodeNum = urlObj.searchParams.get('read') || '1';
      const baseUrl = urlObj.origin;
      
      if (!comicId) return res.status(400).json({ error: 'Không tìm thấy Comic ID.' });
      
      let userId = null;
      try {
        const { data: listData } = await axios.get(`${baseUrl}/api/public/comics?limit=100`);
        if (listData?.comics) {
          const target = listData.comics.find(c => c.id === comicId);
          if (target) userId = target.userId;
        }
      } catch (e) {}
      
      if (!userId) {
        try {
          const { data: html } = await axios.get(url);
          const userMatch = html.match(/users\/([a-zA-Z0-9_-]+)\/comic/);
          if (userMatch) userId = userMatch[1];
        } catch (e) {}
      }
      
      if (!userId) return res.status(404).json({ error: 'Không tìm thấy User ID tác giả.' });
      
      const readApiUrl = `${baseUrl}/api/public/comics/${userId}/${comicId}/read/${episodeNum}`;
      const { data: readData } = await axios.get(readApiUrl);
      
      let images = [];
      if (readData) {
        if (Array.isArray(readData.pages)) images = readData.pages.map(p => p.url || p);
        else if (Array.isArray(readData.images)) images = readData.images;
        else if (Array.isArray(readData)) images = readData;
      }
      
      const cleanImages = images.map((url, index) => ({ 
        url: url.startsWith('http') ? url : `${baseUrl}${url}`, 
        alt: `Page ${index + 1}` 
      }));
      
      if (cleanImages.length === 0) return res.status(404).json({ error: 'Không tìm thấy ảnh.' });
      
      res.json({ success: true, count: cleanImages.length, images: cleanImages });
    } catch (error) { 
      res.status(500).json({ error: error.message }); 
    }
  });
  
  // ============ MUSIC LIBRARY API ============
  server.get('/api/music-library', (req, res) => {
    res.json({ success: true, music: MANGA_MUSIC_LIBRARY });
  });
  
  // ============ ADMIN API ============
  server.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === '999') {
      const token = 'admin_token_' + crypto.randomBytes(8).toString('hex');
      return res.json({ success: true, token });
    }
    return res.status(401).json({ success: false, message: 'Sai thông tin đăng nhập' });
  });
  
  const checkAdminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer admin_token_')) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
  
  server.get('/api/admin/stats', checkAdminAuth, (req, res) => {
    const workers = Array.from(activeWorkers.values());
    const queue = jobQueue.map(j => ({
      jobId: j.jobId,
      data: { title: j.data.title }
    }));
    
    res.json({
      workers,
      queue,
      stats: globalStats
    });
  });
  
  server.get('/api/admin/users', checkAdminAuth, async (req, res) => {
    const users = await getUsers();
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      status: u.status,
      createdAt: u.createdAt
    }));
    res.json({ users: safeUsers });
  });
  
  server.post('/api/admin/user-action', checkAdminAuth, async (req, res) => {
    const { userId, action } = req.body;
    let users = await getUsers();
    const userIdx = users.findIndex(u => u.id === userId);
    
    if (userIdx === -1) return res.status(404).json({ error: 'User not found' });
    
    if (action === 'delete') {
      users.splice(userIdx, 1);
    } else if (action === 'approve') {
      users[userIdx].status = 'active';
    } else if (action === 'ban') {
      users[userIdx].status = 'banned';
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    await saveUsers(users);
    res.json({ success: true });
  });
  
  // ============ WORKER DOWNLOAD API (FIXED) ============
  server.get('/api/download-worker', async (req, res) => {
    try {
      const zipPath = path.join(__dirname, 'public', 'downloads', 'comic-worker-win64.zip');
if (!fs.existsSync(zipPath)) {
  return res.status(404).json({ 
    error: 'Worker package not ready', 
    hint: 'Build worker first: cd worker_build && npm run build:win' 
  });
}
res.download(zipPath, 'comic-worker-win64.zip');

      
      // Check if pre-built worker exists
      if (!fs.existsSync(workerPath)) {
        return res.status(404).json({ 
          error: 'Worker executable not found',
          hint: 'Please build worker locally first',
          instructions: [
            '1. Run locally: node build-worker.js https://anclick.id.vn',
            '2. Upload worker_build/worker.exe to /public/downloads/',
            '3. Restart server'
          ]
        });
      }
      
      const stats = fs.statSync(workerPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log(`📥 Client downloading worker.exe (${fileSizeMB} MB)`);
      
      // Serve file directly
      res.download(workerPath, 'worker.exe', (err) => {
        if (err) {
          console.error('Download error:', err);
        } else {
          console.log('✅ Worker downloaded successfully');
        }
      });
      
    } catch (e) {
      console.error('❌ Download error:', e);
      res.status(500).json({ error: e.message });
    }
  });
  
  // Check worker availability
server.get('/api/worker-status', (req, res) => {
  const zipPath = path.join(__dirname, 'public', 'downloads', 'comic-worker-win64.zip');
  const exists = fs.existsSync(zipPath);
  if (exists) {
    const stats = fs.statSync(zipPath);
    res.json({ 
      available: true, 
      size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
      format: 'ZIP + Node.js (Windows)',
      path: '/api/download-worker'
    });
  } else {
    res.json({ 
      available: false, 
      message: 'Worker ZIP not ready. Run: cd worker_release && zip -r ../public/downloads/comic-worker-win64.zip worker.js node_modules run-worker.bat README.txt'
    });
  }
});

  
  // ============ NEXT.JS HANDLER ============
  server.all('*', (req, res) => handle(req, res));
  
  // ============ START SERVER ============
  server.listen(PORT, (err) => {
    if (err) throw err;
    
    const localIP = getLocalExternalIP();
    console.log(`> Server running on:`);
    console.log(`  - Local:   http://localhost:${PORT}`);
    console.log(`  - Network: http://${localIP}:${PORT}`);
    console.log(`> Download Worker at: http://${localIP}:${PORT}/api/download-worker`);
    console.log(`> Check worker status: http://${localIP}:${PORT}/api/worker-status`);
  });
});
