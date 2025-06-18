const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Data file path
const DATA_FILE = path.join(__dirname, 'data.json');

// Ensure data file exists
async function ensureDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch (error) {
        // Create empty data file if it doesn't exist
        await fs.writeFile(DATA_FILE, '[]', 'utf8');
        console.log('Created new data.json file');
    }
}

// Initialize data file
ensureDataFile();

// Routes
// Serve the dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

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
            return res.status(400).json({ error: 'Invalid data format' });
        }
        
        // Save data to file
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        
        // Log the save operation
        console.log(`Data saved by ${user} at ${timestamp}`);
        
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

// Upload file endpoint
app.post('/api/upload', express.raw({ type: ['application/json', 'text/csv'], limit: '50mb' }), async (req, res) => {
    try {
        const contentType = req.headers['content-type'];
        let data;
        
        if (contentType.includes('json')) {
            data = JSON.parse(req.body.toString());
        } else if (contentType.includes('csv')) {
            // Basic CSV parsing
            const csvText = req.body.toString();
            const lines = csvText.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            data = [];
            
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const values = lines[i].split(',').map(v => v.trim());
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = values[index] || '';
                });
                data.push(obj);
            }
        } else {
            return res.status(400).json({ error: 'Unsupported file type' });
        }
        
        // Ensure data is an array
        if (!Array.isArray(data)) {
            data = [data];
        }
        
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        res.json({ success: true, message: 'File uploaded successfully', itemCount: data.length });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`SEA MASTER server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
