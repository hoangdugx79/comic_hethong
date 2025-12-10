const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
require('dotenv').config();

// Config
const SERVER_URL = process.argv[2] || process.env.SERVER_DOMAIN || 'http://localhost:3001';
const buildDir = path.join(__dirname, 'worker_build');

console.log(`🎯 Building worker for: ${SERVER_URL}`);

// Parse URL
const urlObj = new URL(SERVER_URL);
const protocol = urlObj.protocol.replace(':', '');
const host = urlObj.hostname;
const port = urlObj.port || (protocol === 'https' ? '443' : '80');
const fullUrl = `${protocol}://${host}${port === '80' || port === '443' ? '' : ':' + port}`;

console.log(`   Full URL: ${fullUrl}`);

// FULL WORKER CODE - với đầy đủ logic xử lý video
const WORKER_CODE = `
const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const sharp = require('sharp');
const crypto = require('crypto');

// Server URL - injected at build time
const SERVER_URL = process.argv[2] || '${fullUrl}';
const WORKER_ID = 'worker_' + crypto.randomBytes(4).toString('hex');
const POLL_INTERVAL = 2000;

console.log(\`🤖 Initializing Worker: \${WORKER_ID}\`);
console.log(\`🔗 Connecting to Server: \${SERVER_URL}\`);

// --- Fix FFmpeg Path in PKG ---
// --- Fix FFmpeg Path in PKG ---
let finalFfmpegPath = ffmpegStatic;
if (process.pkg) {
  const workerDir = path.dirname(process.execPath);
  const destPath = path.join(workerDir, 'ffmpeg.exe');
  
  try {
    if (!fs.existsSync(destPath)) {
      console.log("⚙️ FFmpeg not found, checking alternatives...");
      
      // Thử tìm ffmpeg.exe ở các vị trí có thể
      const possiblePaths = [
        destPath,
        path.join(workerDir, 'ffmpeg.exe'),
        path.join(process.cwd(), 'ffmpeg.exe')
      ];
      
      let found = false;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          finalFfmpegPath = p;
          found = true;
          console.log(\`✅ Found FFmpeg at: \${p}\`);
          break;
        }
      }
      
      if (!found) {
        console.error("❌ FFmpeg not found! Please place ffmpeg.exe in the same folder as worker.exe");
        console.error("   Download from: https://ffmpeg.org/download.html");
        process.exit(1);
      }
    } else {
      finalFfmpegPath = destPath;
      console.log("✅ Using FFmpeg from:", destPath);
    }
  } catch (err) { 
    console.error("⚠️ FFmpeg setup error:", err.message);
    console.error("   Please place ffmpeg.exe in the same folder as worker.exe");
    process.exit(1);
  }
} else {
  console.log("✅ Using system FFmpeg:", finalFfmpegPath);
}


try { ffmpeg.setFfmpegPath(finalFfmpegPath); } catch (e) {}
sharp.cache(false);

// Image processing function
const processImageForStyle = async (inputPath, outputDir, index, style, videoW, videoH) => {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const processedFiles = [];
  const targetAspect = videoW / videoH;
  const isTallImage = metadata.height > (metadata.width / targetAspect) * 1.5;
  const stylesNeedingSlicing = ['scroll_down', 'smart_crop', 'zoom_in'];

  if (isTallImage && stylesNeedingSlicing.includes(style)) {
    const segmentHeight = Math.floor(metadata.width / targetAspect);
    const overlap = Math.floor(segmentHeight * 0.15);
    let currentY = 0;
    let subIdx = 0;

    while (currentY < metadata.height) {
      let extractH = segmentHeight;
      if (currentY + extractH > metadata.height) extractH = metadata.height - currentY;
      if (extractH < segmentHeight * 0.3 && subIdx > 0) break;

      const outName = \`proc_\${index}_\${subIdx}.jpg\`;
      const outPath = path.join(outputDir, outName);

      await sharp({ 
        create: { width: videoW, height: videoH, channels: 4, background: 'black' } 
      })
      .composite([{ 
        input: await image.clone()
          .extract({ left: 0, top: currentY, width: metadata.width, height: extractH })
          .resize({ width: videoW, height: videoH, fit: 'contain', background: 'black' })
          .toBuffer() 
      }])
      .toFile(outPath);

      processedFiles.push(outPath);
      currentY += (segmentHeight - overlap);
      subIdx++;
    }
    return processedFiles;
  }

  const outName = \`proc_\${index}.jpg\`;
  const outPath = path.join(outputDir, outName);
  let pipeline = image.clone();

  if ((style === 'smart_crop' || style === 'zoom_in') && !isTallImage) {
    await pipeline.resize(videoW, videoH, { fit: 'cover', position: 'center' }).toFile(outPath);
  } else if (style === 'simple_fit') {
    await pipeline.resize(videoW, videoH, { fit: 'contain', background: 'black' }).toFile(outPath);
  } else {
    const blurredBg = await image.clone()
      .resize(videoW, videoH, { fit: 'cover' })
      .blur(40)
      .modulate({ brightness: 0.7 })
      .toBuffer();
    
    const mainImage = await image.clone()
      .resize(videoW, videoH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    await sharp(blurredBg).composite([{ input: mainImage }]).toFile(outPath);
  }

  processedFiles.push(outPath);
  return processedFiles;
};

// Motion filter generator
const getMotionFilter = (style, w, h, duration) => {
  const fps = 30;
  const frames = duration * fps;
  const s = \`\${w}x\${h}\`;
  const calcStep = (zoomTarget, zoomStart = 1.0) => ((Math.abs(zoomTarget - zoomStart) / frames).toFixed(7));

  switch (style) {
    case 'zoom_in': 
      return \`zoompan=z='min(zoom+\${calcStep(1.5)},1.5)':d=\${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=\${s}\`;
    case 'pan_right': 
      return \`zoompan=z=1.2:x='x+2':y='ih/2-(ih/zoom/2)':d=\${frames}:s=\${s}\`;
    case 'pan_left': 
      return \`zoompan=z=1.2:x='if(eq(on,1),iw/2,x-2)':y='ih/2-(ih/zoom/2)':d=\${frames}:s=\${s}\`;
    case 'scroll_down': 
      return \`zoompan=z='min(zoom+\${calcStep(1.1)},1.1)':d=\${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=\${s}\`;
    default: 
      return \`zoompan=z='min(zoom+\${calcStep(1.05)},1.05)':d=\${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=\${s}\`;
  }
};

// Main task processing function
const processTask = async (taskData) => {
  const { jobId, images, config, musicUrl, title } = taskData;
  console.log(\`📥 Processing Job \${jobId}: \${images.length} images\`);

  const rootDir = process.cwd();
  const tempDir = path.join(rootDir, 'temp_worker', jobId);
  const processedDir = path.join(tempDir, 'processed');
  const outputVideoPath = path.join(tempDir, 'output.mp4');

  try {
    await fs.ensureDir(tempDir);
    await fs.ensureDir(processedDir);

    const isPortrait = config.ratio === '9:16';
    const outW = isPortrait ? 720 : 1280;
    const outH = isPortrait ? 1280 : 720;
    const duration = config?.durationPerImg || 3;
    const style = config?.style || 'blur_bg';

    // Download images
    console.log('⬇️ Downloading images...');
    const downloadedFiles = [];
    for (let i = 0; i < images.length; i++) {
      const cleanUrl = images[i].url.split('?')[0];
      let ext = path.extname(cleanUrl) || '.jpg';
      if (ext.length > 5) ext = '.jpg';
      const fileName = \`raw_\${String(i).padStart(3, '0')}\${ext}\`;
      const filePath = path.join(tempDir, fileName);

      try {
        const response = await axios({ url: images[i].url, responseType: 'stream' });
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => { 
          writer.on('finish', resolve); 
          writer.on('error', reject); 
        });
        downloadedFiles.push(filePath);
      } catch (e) { 
        console.error(\`Error downloading image \${i}\`); 
      }
    }

    // Process images
    console.log('🎨 Processing images...');
    let finalImageList = [];
    for (let i = 0; i < downloadedFiles.length; i++) {
      const processed = await processImageForStyle(downloadedFiles[i], processedDir, i, style, outW, outH);
      finalImageList = finalImageList.concat(processed);
    }

    if (finalImageList.length === 0) throw new Error("No images processed");

    // Download music
    let audioPath = null;
    if (musicUrl && musicUrl.startsWith('http')) {
      console.log('🎵 Downloading music...');
      const musicPath = path.join(tempDir, 'bgm.mp3');
      try {
        const audioRes = await axios({ url: musicUrl, responseType: 'stream' });
        const audioWriter = fs.createWriteStream(musicPath);
        audioRes.data.pipe(audioWriter);
        await new Promise((resolve, reject) => { 
          audioWriter.on('finish', resolve); 
          audioWriter.on('error', reject); 
        });
        audioPath = musicPath;
      } catch (err) { 
        console.error("Music download error:", err.message); 
      }
    }

    // Create FFmpeg concat file
    const listFilePath = path.join(tempDir, 'images.txt');
    let fileContent = '';
    finalImageList.forEach(file => {
      fileContent += \`file '\${file.replace(/\\\\\\\\/g, '/')}'\n\`;
      fileContent += \`duration \${duration}\n\`;
    });
    fileContent += \`file '\${finalImageList[finalImageList.length - 1].replace(/\\\\\\\\/g, '/')}'\n\`;
    await fs.writeFile(listFilePath, fileContent);

    // Render video with FFmpeg
    console.log("🎬 Rendering video with FFmpeg...");
    await new Promise((resolve, reject) => {
      let command = ffmpeg(listFilePath).inputOptions(['-f concat', '-safe 0']);
      
      if (audioPath) command.input(audioPath).inputOptions(['-stream_loop -1']);

      const outOptions = ['-c:v libx264', '-pix_fmt yuv420p', '-r 30', '-movflags +faststart'];
      if (audioPath) { 
        outOptions.push('-c:a aac'); 
        outOptions.push('-shortest'); 
        outOptions.push('-map 0:v'); 
        outOptions.push('-map 1:a'); 
      }

      command.outputOptions(outOptions)
        .complexFilter([getMotionFilter(style, outW, outH, duration)])
        .save(outputVideoPath)
        .on('end', resolve)
        .on('error', reject);
    });

    // Upload result to server
    console.log("📤 Uploading video to server...");
    const videoBuffer = await fs.readFile(outputVideoPath);
    await axios.post(\`\${SERVER_URL}/api/worker/submit-result/\${jobId}\`, videoBuffer, {
      headers: { 'Content-Type': 'video/mp4' },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log("✅ Job completed successfully!");
    await fs.remove(tempDir);

  } catch (error) {
    console.error("❌ Task Failed:", error.message);
    await axios.post(\`\${SERVER_URL}/api/worker/report-error/\${jobId}\`, { error: error.message });
    await fs.remove(tempDir).catch(() => {});
  }
};

// Poll server for tasks
const pollServer = async () => {
  try {
    const { data: task } = await axios.get(\`\${SERVER_URL}/api/worker/get-task?workerId=\${WORKER_ID}\`);
    
    if (task && task.jobId) {
      await processTask(task);
    }
  } catch (e) {
    if (e.code === 'ECONNREFUSED') {
      console.log("❌ Server unavailable, retrying...");
    } else if (e.response && e.response.status !== 404) {
      console.error("Poll error:", e.message);
    }
  }

  setTimeout(pollServer, POLL_INTERVAL);
};

console.log("🚀 Worker started. Polling for tasks...");
pollServer();
`;

// Ensure build dir
fs.ensureDirSync(buildDir);

// Write worker.js
fs.writeFileSync(path.join(buildDir, 'worker.js'), WORKER_CODE);
console.log('✅ Generated worker.js with full processing logic');

// Write package.json
const workerPackage = {
  name: 'worker',
  version: '1.0.0',
  main: 'worker.js',
  dependencies: {
    axios: '^0.27.2',
    sharp: '^0.32.6',
    'fs-extra': '^11.1.1',
    'fluent-ffmpeg': '^2.1.2',
    'ffmpeg-static': '^5.2.0'
  }
};

fs.writeFileSync(
  path.join(buildDir, 'package.json'), 
  JSON.stringify(workerPackage, null, 2)
);
console.log('✅ Generated package.json');

console.log('📦 Installing dependencies...');

exec('npm install', { cwd: buildDir }, (installErr) => {
  if (installErr) {
    console.error('❌ npm install failed:', installErr);
    process.exit(1);
  }
  
console.log('✅ Dependencies installed');
console.log('🔨 Building worker.exe with pkg...');

const pkgCommand = 'npx pkg worker.js -t node16-win-x64 -o worker.exe';

exec(pkgCommand, { cwd: buildDir }, (buildErr, buildStdout, buildStderr) => {
  if (buildErr) {
    console.error('❌ Build failed:');
    console.error(buildStderr);
    process.exit(1);
  }

  console.log(buildStdout);

  const outputPath = path.join(buildDir, 'worker.exe');
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log('');
    console.log('✅ Build successful!');
    console.log(`📦 File: ${outputPath}`);
    console.log(`📏 Size: ${fileSizeMB} MB`);
    console.log('');
    console.log('👉 Next steps:');
    console.log('1. Copy ffmpeg.exe vào cùng thư mục worker.exe (nếu chưa có)');
    console.log('2. Upload worker.exe (+ ffmpeg.exe) lên VPS: public/downloads/');
  } else {
    console.error('❌ Output worker.exe not found after build');
    process.exit(1);
  }
});

});
