const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const multer = require('multer');
const os = require('os');
const app = express();
const port = 3000;

// Configure media directories here
const mediaDirectories = [
    {
        name: 'Home',
        path: process.env.HOME || process.env.USERPROFILE
    },
    {
        name: 'WD1TB',
        path: '/run/media/dan/WD1TB'
    },
    // Add your USB drive path here, for example:
    // {
    //     name: 'USB Drive',
    //     path: '/run/media/dan/YOUR_USB_NAME'
    // }
];

// Function to get local IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
            if (!iface.internal && iface.family === 'IPv4') {
                return iface.address;
            }
        }
    }
    return '127.0.0.1'; // Fallback to localhost if no other IP is found
}

// Configure multer for handling file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Keep original filename but ensure it's safe
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, safeName);
    }
});

const upload = multer({ storage: storage });

// Serve static files from the current directory
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/streams', express.static(path.join(__dirname, 'streams')));
app.use(express.json());

// Add at the top of server.js
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// API endpoint to get root directories
app.get('/api/roots', (req, res) => {
    // Filter only accessible directories
    const accessibleDirs = mediaDirectories.filter(dir => {
        try {
            fs.accessSync(dir.path, fs.constants.R_OK);
            return true;
        } catch (err) {
            console.warn(`Directory ${dir.path} is not accessible:`, err);
            return false;
        }
    });
    res.json(accessibleDirs);
});

// API endpoint to get directories within a root
app.get('/api/directories/:root', (req, res) => {
    const rootDir = mediaDirectories.find(dir => dir.name === req.params.root);
    
    if (!rootDir) {
        return res.status(404).json({ error: 'Root directory not found' });
    }

    fs.readdir(rootDir.path, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return res.status(500).json({ error: 'Failed to read directories' });
        }
        
        // Filter out hidden files and get only directories
        const directories = files.filter(file => {
            try {
                const fullPath = path.join(rootDir.path, file);
                return !file.startsWith('.') && fs.statSync(fullPath).isDirectory();
            } catch (err) {
                console.error('Error checking directory:', err);
                return false;
            }
        });
        
        res.json(directories);
    });
});

// API endpoint to get files in a directory
app.get('/api/files/:root/:directory', (req, res) => {
    const rootDir = mediaDirectories.find(dir => dir.name === req.params.root);
    
    if (!rootDir) {
        return res.status(404).json({ error: 'Root directory not found' });
    }

    const dirPath = path.join(rootDir.path, req.params.directory);

    // Validate that the directory is within the root directory
    if (!dirPath.startsWith(rootDir.path)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    fs.readdir(dirPath, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return res.status(500).json({ error: 'Failed to read files' });
        }
        
        // Filter for video files
        const videoFiles = files.filter(file => {
            try {
                // Skip hidden files (starting with .)
                if (file.startsWith('.')) {
                    return false;
                }
                const ext = path.extname(file).toLowerCase();
                return ['.mp4', '.mkv', '.avi', '.mov', '.m4v'].includes(ext);
            } catch (err) {
                console.error('Error checking file:', err);
                return false;
            }
        });
        
        res.json(videoFiles);
    });
});

// Add explicit route for serving HLS files
app.get('/stream/:id/stream.m3u8', (req, res) => {
    const { id } = req.params;
    const m3u8Path = path.join(os.tmpdir(), 'stream', id, 'stream.m3u8');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.sendFile(m3u8Path);
});

// Add route for serving video segments
app.get('/stream/:id/*.ts', (req, res) => {
    const { id } = req.params;
    const segmentPath = path.join(os.tmpdir(), 'stream', id, path.basename(req.path));
    res.setHeader('Content-Type', 'video/MP2T');
    res.sendFile(segmentPath);
});

// Update the stream endpoint to ensure proper path handling
app.post('/api/stream', async (req, res) => {
    const { root, directory, filename, directStream } = req.body;
    
    if (!root || !directory || !filename) {
        return res.status(400).json({ error: 'Root, directory and filename are required' });
    }

    const rootDir = mediaDirectories.find(dir => dir.name === root);
    
    if (!rootDir) {
        return res.status(404).json({ error: 'Root directory not found' });
    }

    const inputPath = path.join(rootDir.path, directory, filename);

    // Validate that the file path is within the root directory
    if (!inputPath.startsWith(rootDir.path)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    if (directStream) {
        const ext = path.extname(filename).toLowerCase();
        const mimeType = ext === '.mkv' ? 'video/x-matroska' : 'video/mp4';
        res.setHeader('Content-Type', mimeType);
        // For direct streaming, serve the file directly
        res.json({ 
            success: true, 
            streamUrl: `/api/direct-stream/${encodeURIComponent(root)}/${encodeURIComponent(directory)}/${encodeURIComponent(filename)}`,
            isDirectStream: true
        });
    } else {
        const streamId = Date.now().toString();
        const outputPath = path.join(os.tmpdir(), 'stream', streamId);
        
        try {
            await fs.promises.mkdir(outputPath, { recursive: true });
            
            // Create a promise to wait for initial segment creation
            const streamReady = new Promise((resolve, reject) => {
                const ffmpeg = spawn('ffmpeg', [
                    '-i', inputPath,
                    '-c:v', 'libx264',
                    '-profile:v', 'baseline', // More compatible profile
                    '-level', '3.0',          // Lower level for better compatibility
                    '-pix_fmt', 'yuv420p',    // Standard pixel format
                    '-c:a', 'aac',
                    '-ar', '44100',           // Standard audio rate
                    '-b:a', '128k',           // Standard audio bitrate
                    '-ac', '2',               // Stereo audio
                    '-hls_time', '6',         // Longer segments for stability
                    '-hls_list_size', '0',
                    '-hls_segment_type', 'mpegts',
                    '-hls_flags', 'delete_segments+append_list',
                    '-start_number', '0',
                    '-f', 'hls',
                    path.join(outputPath, 'stream.m3u8')
                ]);

                // Listen for ffmpeg output
                ffmpeg.stderr.on('data', (data) => {
                    console.log('FFmpeg:', data.toString());
                });

                // Check for m3u8 file creation
                const checkFile = setInterval(async () => {
                    try {
                        await fs.promises.access(path.join(outputPath, 'stream.m3u8'));
                        clearInterval(checkFile);
                        resolve();
                    } catch (err) {
                        // File doesn't exist yet, continue waiting
                    }
                }, 500);

                ffmpeg.on('error', (err) => {
                    clearInterval(checkFile);
                    console.error('FFmpeg error:', err);
                    reject(err);
                });

                // Set a timeout to avoid hanging
                setTimeout(() => {
                    clearInterval(checkFile);
                    reject(new Error('Timeout waiting for stream file'));
                }, 10000); // 10 second timeout
            });

            // Wait for initial segment creation before sending response
            await streamReady;

            res.json({
                streamUrl: `/stream/${streamId}/stream.m3u8`,
                isDirectStream: false
            });

        } catch (error) {
            console.error('Error setting up stream:', error);
            res.status(500).json({ error: 'Failed to start stream: ' + error.message });
        }
    }
});

// Direct streaming endpoint
app.get('/api/direct-stream/:root/:directory/:filename', (req, res) => {
    const rootDir = mediaDirectories.find(dir => dir.name === req.params.root);
    
    if (!rootDir) {
        return res.status(404).json({ error: 'Root directory not found' });
    }

    const filePath = path.join(rootDir.path, req.params.directory, req.params.filename);

    // Validate that the file path is within the root directory
    if (!filePath.startsWith(rootDir.path)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    // Get file stats
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

// Clean up function for old files
function cleanupOldFiles() {
    const uploadsDir = path.join(__dirname, 'uploads');
    const streamsDir = path.join(__dirname, 'streams');
    const tempStreamsDir = path.join(os.tmpdir(), 'stream');

    [uploadsDir, streamsDir, tempStreamsDir].forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.readdir(dir, (err, files) => {
                if (err) {
                    console.error(`Error reading ${dir}:`, err);
                    return;
                }

                files.forEach(file => {
                    const filePath = path.join(dir, file);
                    fs.stat(filePath, (err, stats) => {
                        if (err) {
                            console.error(`Error getting stats for ${filePath}:`, err);
                            return;
                        }

                        // Remove files older than 1 hour
                        const now = new Date().getTime();
                        const endTime = new Date(stats.ctime).getTime() + 3600000; // 1 hour in milliseconds

                        if (now > endTime) {
                            // If it's a directory (like stream ID directories in temp), remove recursively
                            if (stats.isDirectory()) {
                                fs.rm(filePath, { recursive: true, force: true }, err => {
                                    if (err) console.error(`Error deleting directory ${filePath}:`, err);
                                });
                            } else {
                                fs.unlink(filePath, err => {
                                    if (err) console.error(`Error deleting file ${filePath}:`, err);
                                });
                            }
                        }
                    });
                });
            });
        }
    });
}

// Run cleanup every hour
setInterval(cleanupOldFiles, 3600000);

app.listen(port, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`Server running at:`);
    console.log(`- Local:   http://localhost:${port}`);
    console.log(`- Network: http://${localIP}:${port}`);
    console.log('\nConfigured media directories:');
    mediaDirectories.forEach(dir => {
        try {
            fs.accessSync(dir.path, fs.constants.R_OK);
            console.log(`- ${dir.name}: ${dir.path} (accessible)`);
        } catch (err) {
            console.log(`- ${dir.name}: ${dir.path} (not accessible)`);
        }
    });
}); 