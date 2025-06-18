const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || './data';
const DATA_FILE = path.join(DATA_DIR, 'data.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
        console.log(`Created data directory: ${DATA_DIR}`);
    }
}

// Initialize data file if it doesn't exist
async function initializeDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        const initialData = [];
        await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
        console.log('Created initial data.json file');
    }
}

// API Routes

// Get data
app.get('/api/data', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading data:', error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// Save data
app.post('/api/save', async (req, res) => {
    try {
        const { data, user, timestamp } = req.body;
        
        if (!Array.isArray(data)) {
            return res.status(400).json({ error: 'Data must be an array' });
        }
        
        // Save to file
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        
        // Log the save action
        console.log(`Data saved by ${user || 'Unknown'} at ${timestamp || new Date().toISOString()}`);
        
        res.json({ 
            success: true, 
            message: 'Data saved successfully',
            itemCount: data.length 
        });
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Serve the dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
    try {
        await ensureDataDir();
        await initializeDataFile();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`SEA MASTER server running on port ${PORT}`);
            console.log(`Data directory: ${DATA_DIR}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
