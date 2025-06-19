const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// Configuration
const PORT = process.env.PORT || 8000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pakistanmc';
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('🚀 Starting SEA MASTER Dashboard Server...');
console.log(`📊 Environment: ${NODE_ENV}`);
console.log(`🔐 Admin Password: ${ADMIN_PASSWORD}`);
console.log(`📁 Working Directory: ${__dirname}`);

// Simple Basic Auth Middleware (custom implementation)
function basicAuth(req, res, next) {
    const auth = req.headers.authorization;
    
    if (!auth || !auth.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="SEA MASTER Dashboard"');
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Please provide admin credentials'
        });
    }
    
    const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
    const username = credentials[0];
    const password = credentials[1];
    
    if (username !== 'admin' || password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            error: 'Invalid credentials',
            message: 'Wrong username or password'
        });
    }
    
    next();
}

// Apply basic auth to all routes
app.use(basicAuth);

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

// Serve static files
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
            console.log('📝 Creating new data.json file with sample data...');
            jsonData = [
                {
                    "id": "001",
                    "Project_Name": "Layer Enhancement Project",
                    "Status": "In Progress",
                    "Production_Team_Remark": "Working on optimization",
                    "Priority": "High",
                    "Assigned_To": "Development Team",
                    "Created_Date": new Date().toLocaleString(),
                    "Created_By": "System",
                    "Last_Edit_Date": new Date().toLocaleString(),
                    "Edited_By": "System"
                },
                {
                    "id": "002",
                    "Project_Name": "Feedback Integration",
                    "Status": "Completed",
                    "Production_Team_Remark": "Successfully integrated feedback system",
                    "Priority": "Medium",
                    "Assigned_To": "QA Team",
                    "Created_Date": new Date().toLocaleString(),
                    "Created_By": "System",
                    "Last_Edit_Date": new Date().toLocaleString(),
                    "Edited_By": "System"
                }
            ];
            saveDataFile();
        }
    } catch (err) {
        console.error('❌ Error reading data.json:', err.message);
        jsonData = [];
        saveDataFile();
    }
}

function saveDataFile() {
    try {
        const dataToSave = JSON.stringify(jsonData, null, 2);
        fs.writeFileSync(DATA_FILE, dataToSave, 'utf8');
        console.log(`💾 Saved ${jsonData.length} records to data.json`);
        return true;
    } catch (error) {
        console.error('❌ Error saving data.json:', error.message);
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

// Serve data.json directly
app.get('/data.json', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.json(jsonData);
        console.log(`📡 Served data.json with ${jsonData.length} records to ${req.ip}`);
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

// Legacy save endpoint
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

// Debug endpoint
app.get('/debug', (req, res) => {
    try {
        const debugInfo = {
            timestamp: new Date().toISOString(),
            workingDirectory: __dirname,
            dataFilePath: DATA_FILE,
            dataFileExists: fs.existsSync(DATA_FILE),
            filesInDirectory: fs.readdirSync(__dirname).filter(f => !f.startsWith('.')),
            records: jsonData.length,
            environment: NODE_ENV,
            port: PORT,
            nodeVersion: process.version,
            memoryUsage: process.memoryUsage()
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
    res.status(500).json({
        error: 'Internal Server Error',
        message: NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    console.log(`❌ 404: ${req.method} ${req.path} from ${req.ip}`);
    
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

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, saving data and shutting down...');
    saveDataFile();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, saving data and shutting down...');
    saveDataFile();
    process.exit(0);
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
    console.log(`🔐 Admin Credentials: admin/${ADMIN_PASSWORD}`);
    console.log(`📁 Data Storage: ${DATA_FILE}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`📦 Node Version: ${process.version}`);
    console.log(`📊 Records Loaded: ${jsonData.length}`);
    console.log('═'.repeat(70));
    console.log('✅ Ready to serve requests!');
    console.log('🔧 Authentication: Basic Auth with admin/password');
    console.log('📝 Note: Use admin/' + ADMIN_PASSWORD + ' to login');
});

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
