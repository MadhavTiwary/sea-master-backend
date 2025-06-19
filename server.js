const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const basicAuth = require('express-basic-auth');

const app = express();

// Use Railway's provided PORT or fallback
const PORT = process.env.PORT || 8000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pakistanmc';
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('🚀 Starting SEA MASTER Dashboard Server...');
console.log(`📊 Environment: ${NODE_ENV}`);
console.log(`🔐 Admin Password: ${ADMIN_PASSWORD}`);
console.log(`📁 Working Directory: ${__dirname}`);

// Basic Authentication
app.use(basicAuth({
    users: { 'admin': ADMIN_PASSWORD },
    challenge: true,
    unauthorizedResponse: (req) => {
        return {
            error: 'Unauthorized',
            message: 'Invalid credentials for SEA MASTER Dashboard',
            timestamp: new Date().toISOString()
        };
    }
}));

// CORS configuration
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from current directory
app.use(express.static(__dirname, {
    maxAge: NODE_ENV === 'production' ? '1h' : '0',
    etag: true
}));

// Data file management
const DATA_FILE = path.join(__dirname, 'data.json');
let jsonData = [];

function initializeDataFile() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            jsonData = JSON.parse(data);
            
            if (!Array.isArray(jsonData)) {
                console.warn('⚠️ Data file is not an array, converting...');
                jsonData = Array.isArray(jsonData) ? jsonData : [jsonData];
                saveDataFile();
            }
            
            console.log(`✅ Loaded ${jsonData.length} records from data.json`);
        } else {
            console.log('📝 Creating new data.json file...');
            jsonData = [];
            saveDataFile();
        }
    } catch (err) {
        console.error('❌ Error reading data.json:', err.message);
        
        // Create backup if file is corrupted
        if (fs.existsSync(DATA_FILE)) {
            const backupFile = `${DATA_FILE}.backup.${Date.now()}`;
            try {
                fs.copyFileSync(DATA_FILE, backupFile);
                console.log(`💾 Corrupted file backed up to: ${backupFile}`);
            } catch (backupError) {
                console.error('❌ Failed to create backup:', backupError.message);
            }
        }
        
        jsonData = [];
        saveDataFile();
    }
}

function saveDataFile() {
    try {
        const dataToSave = JSON.stringify(jsonData, null, 2);
        const tempFile = `${DATA_FILE}.tmp`;
        
        // Write to temp file first (atomic operation)
        fs.writeFileSync(tempFile, dataToSave, 'utf8');
        
        // Move temp file to actual file
        if (fs.existsSync(DATA_FILE)) {
            fs.unlinkSync(DATA_FILE);
        }
        fs.renameSync(tempFile, DATA_FILE);
        
        console.log(`💾 Saved ${jsonData.length} records to data.json`);
        return true;
    } catch (error) {
        console.error('❌ Error saving data.json:', error.message);
        
        // Clean up temp file if it exists
        const tempFile = `${DATA_FILE}.tmp`;
        if (fs.existsSync(tempFile)) {
            try {
                fs.unlinkSync(tempFile);
            } catch (cleanupError) {
                console.error('❌ Failed to cleanup temp file:', cleanupError.message);
            }
        }
        
        return false;
    }
}

// Initialize data file
initializeDataFile();

// ROUTES

// Root route - redirect to dashboard
app.get('/', (req, res) => {
    res.redirect('/dashboard.html');
});

// Health check endpoint
app.get('/health', (req, res) => {
    const healthData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        records: jsonData.length,
        memory: process.memoryUsage(),
        version: '2.0.0',
        node: process.version,
        dataFile: DATA_FILE,
        dataFileExists: fs.existsSync(DATA_FILE)
    };
    
    res.json(healthData);
});

// Serve data.json directly (IMPORTANT: This fixes the 404 error)
app.get('/data.json', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.json(jsonData);
        console.log(`📡 Served data.json with ${jsonData.length} records`);
    } catch (error) {
        console.error('❌ Error serving data.json:', error);
        res.status(500).json({ 
            error: 'Error retrieving data',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// API endpoint to get data
app.get('/api/data', (req, res) => {
    try {
        const { limit, offset, search } = req.query;
        let responseData = [...jsonData];
        
        // Apply search filter
        if (search) {
            const searchTerm = search.toLowerCase();
            responseData = responseData.filter(item => 
                Object.values(item).some(value => 
                    String(value).toLowerCase().includes(searchTerm)
                )
            );
        }
        
        // Apply pagination
        if (offset) {
            const offsetNum = parseInt(offset, 10);
            if (!isNaN(offsetNum)) {
                responseData = responseData.slice(offsetNum);
            }
        }
        
        if (limit) {
            const limitNum = parseInt(limit, 10);
            if (!isNaN(limitNum)) {
                responseData = responseData.slice(0, limitNum);
            }
        }
        
        res.json({
            data: responseData,
            total: jsonData.length,
            filtered: responseData.length,
            timestamp: new Date().toISOString()
        });
        
        console.log(`📡 API: Served ${responseData.length}/${jsonData.length} records`);
    } catch (error) {
        console.error('❌ Error in /api/data:', error);
        res.status(500).json({ 
            error: 'Error retrieving data',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// API endpoint to save data
app.post('/api/save', (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ 
                success: false,
                error: 'No data provided',
                timestamp: new Date().toISOString()
            });
        }
        
        if (!Array.isArray(req.body)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid data format - expected array',
                received: typeof req.body,
                timestamp: new Date().toISOString()
            });
        }
        
        // Validate data structure
        const hasValidStructure = req.body.every(item => 
            typeof item === 'object' && item !== null
        );
        
        if (!hasValidStructure) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid data structure - all items must be objects',
                timestamp: new Date().toISOString()
            });
        }
        
        // Update data
        jsonData = req.body;
        const saveSuccess = saveDataFile();
        
        if (saveSuccess) {
            res.json({ 
                success: true,
                message: 'Data saved successfully',
                records: jsonData.length,
                timestamp: new Date().toISOString()
            });
            console.log(`💾 API: Saved ${jsonData.length} records`);
        } else {
            res.status(500).json({ 
                success: false,
                error: 'Failed to save data to file',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('❌ Error in /api/save:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error saving data',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Legacy save endpoint for backward compatibility
app.post('/save', (req, res) => {
    try {
        if (!Array.isArray(req.body)) {
            return res.status(400).send('Invalid data format - expected array');
        }
        
        jsonData = req.body;
        const saveSuccess = saveDataFile();
        
        if (saveSuccess) {
            res.send('File saved successfully');
            console.log(`💾 Legacy: Saved ${jsonData.length} records`);
        } else {
            res.status(500).send('Error saving file');
        }
    } catch (error) {
        console.error('❌ Error in /save:', error);
        res.status(500).send('Error saving file');
    }
});

// API endpoint to get statistics
app.get('/api/stats', (req, res) => {
    try {
        const stats = {
            totalRecords: jsonData.length,
            lastModified: fs.existsSync(DATA_FILE) ? 
                fs.statSync(DATA_FILE).mtime : null,
            fileSize: fs.existsSync(DATA_FILE) ? 
                fs.statSync(DATA_FILE).size : 0,
            timestamp: new Date().toISOString()
        };
        
        // Calculate status distribution if Status field exists
        if (jsonData.length > 0) {
            const sampleItem = jsonData[0];
            if (sampleItem && sampleItem.hasOwnProperty('Status')) {
                stats.statusDistribution = jsonData.reduce((acc, item) => {
                    const status = item.Status || 'Unknown';
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {});
            }
        }
        
        res.json(stats);
        console.log(`📊 API: Served statistics for ${jsonData.length} records`);
    } catch (error) {
        console.error('❌ Error in /api/stats:', error);
        res.status(500).json({ 
            error: 'Error calculating statistics',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Debug endpoint to check file system
app.get('/debug', (req, res) => {
    try {
        const debugInfo = {
            timestamp: new Date().toISOString(),
            workingDirectory: __dirname,
            dataFilePath: DATA_FILE,
            dataFileExists: fs.existsSync(DATA_FILE),
            filesInDirectory: fs.readdirSync(__dirname),
            records: jsonData.length,
            environment: NODE_ENV,
            port: PORT
        };
        
        res.json(debugInfo);
    } catch (error) {
        res.status(500).json({
            error: 'Debug info error',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('🚨 Server error:', err);
    
    const errorResponse = {
        error: 'Internal Server Error',
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
    };
    
    if (NODE_ENV === 'development') {
        errorResponse.message = err.message;
        errorResponse.stack = err.stack;
    }
    
    res.status(500).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
    console.log(`❌ 404: ${req.method} ${req.path}`);
    
    res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
        availableEndpoints: [
            'GET /',
            'GET /dashboard.html',
            'GET /data.json',
            'GET /health',
            'GET /api/data',
            'POST /api/save',
            'GET /api/stats',
            'GET /debug'
        ]
    });
});

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    try {
        console.log('💾 Saving data before shutdown...');
        saveDataFile();
        console.log('✅ Data saved successfully');
    } catch (error) {
        console.error('❌ Error saving data during shutdown:', error);
    }
    
    console.log('👋 Goodbye!');
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    try {
        saveDataFile();
    } catch (saveError) {
        console.error('❌ Failed to save data on crash:', saveError);
    }
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🎉 SEA MASTER Dashboard Server Started Successfully!');
    console.log('═'.repeat(70));
    console.log(`🚀 Server URL: http://0.0.0.0:${PORT}`);
    console.log(`📊 Dashboard: http://0.0.0.0:${PORT}/dashboard.html`);
    console.log(`📄 Data JSON: http://0.0.0.0:${PORT}/data.json`);
    console.log(`🏥 Health Check: http://0.0.0.0:${PORT}/health`);
    console.log(`🔧 Debug Info: http://0.0.0.0:${PORT}/debug`);
    console.log('═'.repeat(70));
    console.log('📡 Available API Endpoints:');
    console.log('   GET  /api/data   - Fetch all data');
    console.log('   POST /api/save   - Save data');
    console.log('   GET  /api/stats  - Get statistics');
    console.log('   POST /save       - Legacy save endpoint');
    console.log('   GET  /data.json  - Direct data access (FIXED!)');
    console.log('═'.repeat(70));
    console.log(`🔐 Admin Credentials: admin/${ADMIN_PASSWORD}`);
    console.log(`📁 Data Storage: ${DATA_FILE}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`📦 Node Version: ${process.version}`);
    console.log(`💾 Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.log(`📊 Records Loaded: ${jsonData.length}`);
    console.log('═'.repeat(70));
    console.log('✅ Ready to serve requests!');
    console.log('🔧 Try: curl http://localhost:' + PORT + '/data.json');
});

// Server error handling
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', error);
        process.exit(1);
    }
});

module.exports = app;
