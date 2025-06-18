const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Data file path - using /tmp for Render's ephemeral storage
// For persistent storage, you'll need to use a database or external storage
const DATA_FILE = process.env.NODE_ENV === 'production' 
  ? '/tmp/data.json' 
  : path.join(__dirname, 'data.json');

// Initialize data file if it doesn't exist
async function initializeDataFile() {
  try {
    await fs.access(DATA_FILE);
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
    console.log('Data file initialized');
  }
}

// Routes
app.get('/', (req, res) => {
  const dashboardPath = path.join(__dirname, 'public', 'dashboard.html');
  console.log('Attempting to serve dashboard from:', dashboardPath);
  
  // Check if file exists
  fs.access(dashboardPath)
    .then(() => {
      res.sendFile(dashboardPath);
    })
    .catch(() => {
      console.error('Dashboard file not found at:', dashboardPath);
      res.status(404).send('Dashboard file not found. Please ensure dashboard.html is in the public directory.');
    });
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
    
    // Save to file
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    
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

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
async function startServer() {
  try {
    await initializeDataFile();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
