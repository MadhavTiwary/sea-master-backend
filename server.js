const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from public directory if it exists
app.use(express.static(path.join(__dirname, 'public')));

// Data file path - using /tmp for Render's ephemeral storage
const DATA_FILE = process.env.NODE_ENV === 'production' 
  ? '/tmp/data.json' 
  : path.join(__dirname, 'data.json');

// Initialize data file if it doesn't exist
async function initializeDataFile() {
  try {
    await fs.access(DATA_FILE);
    console.log('Data file found at:', DATA_FILE);
  } catch (error) {
    // File doesn't exist, create it with sample data
    const sampleData = [
      {
        id: "1",
        Layer_Name: "Sample Layer",
        Production_Team_Remark: "Initial remark",
        Status: "Pending",
        Created_By: "System",
        Created_Date: new Date().toLocaleString(),
        Edited_By: "System",
        Last_Edit_Date: new Date().toLocaleString()
      }
    ];
    await fs.writeFile(DATA_FILE, JSON.stringify(sampleData, null, 2));
    console.log('Data file initialized at:', DATA_FILE);
  }
}

// Debug endpoint to check file structure
app.get('/debug/files', async (req, res) => {
  try {
    const rootFiles = await fs.readdir(__dirname);
    let publicFiles = [];
    let publicExists = false;
    
    if (rootFiles.includes('public')) {
      publicExists = true;
      try {
        publicFiles = await fs.readdir(path.join(__dirname, 'public'));
      } catch (err) {
        publicFiles = ['Error reading public directory'];
      }
    }
    
    res.json({
      workingDirectory: __dirname,
      rootFiles: rootFiles,
      publicExists: publicExists,
      publicFiles: publicFiles,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to read directory', 
      message: error.message 
    });
  }
});

// Main route - try multiple approaches to serve dashboard
app.get('/', async (req, res) => {
  // List of possible locations for dashboard.html
  const possiblePaths = [
    path.join(__dirname, 'public', 'dashboard.html'),
    path.join(__dirname, 'dashboard.html'),
    path.join(process.cwd(), 'public', 'dashboard.html'),
    path.join(process.cwd(), 'dashboard.html')
  ];
  
  // Try to find dashboard.html in any of the possible locations
  for (const filePath of possiblePaths) {
    try {
      await fs.access(filePath);
      console.log('Dashboard found at:', filePath);
      return res.sendFile(filePath);
    } catch (error) {
      console.log('Dashboard not at:', filePath);
    }
  }
  
  // If dashboard.html is not found anywhere, serve it inline
  console.log('Dashboard file not found, serving inline HTML');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SEA MASTER - Setup Required</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            color: #333;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 600px;
            text-align: center;
        }
        h1 { color: #2a5298; }
        .error { color: #dc3545; }
        .info { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 5px; 
            margin: 20px 0;
            text-align: left;
        }
        code {
            background: #e9ecef;
            padding: 2px 5px;
            border-radius: 3px;
            font-size: 14px;
        }
        a {
            color: #2a5298;
            text-decoration: none;
        }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚧 SEA MASTER - Setup Required</h1>
        <p class="error">The dashboard.html file was not found in the expected location.</p>
        
        <div class="info">
            <h3>📁 Expected file structure:</h3>
            <pre>
project-root/
├── server.js
├── package.json
├── public/
│   └── dashboard.html  ← Missing
└── data.json (optional)
            </pre>
        </div>
        
        <p>Please ensure <code>dashboard.html</code> is in the <code>public</code> directory.</p>
        
        <div style="margin-top: 30px;">
            <p><a href="/debug/files">🔍 View Debug Information</a></p>
            <p><a href="/api/data">📊 Check API Endpoint</a></p>
            <p><a href="/health">❤️ Health Check</a></p>
        </div>
        
        <div style="margin-top: 30px; font-size: 14px; color: #666;">
            <p>If you need the dashboard.html file, please check your local development environment or repository.</p>
        </div>
    </div>
</body>
</html>`);
});

// API Routes
app.get('/api/data', async (req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading data:', error);
    // If file doesn't exist, return empty array
    if (error.code === 'ENOENT') {
      res.json([]);
    } else {
      res.status(500).json({ 
        error: 'Failed to read data', 
        message: error.message 
      });
    }
  }
});

app.post('/api/save', async (req, res) => {
  try {
    const { data, user, timestamp } = req.body;
    
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid data format - expected array' });
    }
    
    // Ensure directory exists for data file
    const dataDir = path.dirname(DATA_FILE);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
    
    // Save data
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    
    console.log(`Data saved by ${user} at ${timestamp} - ${data.length} items`);
    
    res.json({ 
      success: true, 
      message: 'Data saved successfully',
      itemCount: data.length,
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ 
      error: 'Failed to save data', 
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    dataFile: DATA_FILE
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found', 
    message: `Route ${req.path} not found`,
    availableRoutes: [
      'GET /',
      'GET /api/data',
      'POST /api/save',
      'GET /health',
      'GET /debug/files'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: err.message 
  });
});

// Start server
async function startServer() {
  try {
    // Initialize data file
    await initializeDataFile();
    
    // Start listening
    app.listen(PORT, '0.0.0.0', () => {
      console.log('=================================');
      console.log(`🚀 SEA MASTER server running`);
      console.log(`📡 Port: ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📁 Working directory: ${__dirname}`);
      console.log(`💾 Data file: ${DATA_FILE}`);
      console.log('=================================');
      
      // List files in root directory for debugging
      fs.readdir(__dirname)
        .then(files => {
          console.log('📂 Root directory files:', files);
          if (files.includes('public')) {
            return fs.readdir(path.join(__dirname, 'public'));
          }
        })
        .then(publicFiles => {
          if (publicFiles) {
            console.log('📂 Public directory files:', publicFiles);
          }
        })
        .catch(err => {
          console.log('Could not read directory:', err.message);
        });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the application
startServer();
