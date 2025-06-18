const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());
app.use(express.static('.'));

// Create data.json if it doesn't exist
if (!fs.existsSync('data.json')) {
    fs.writeFileSync('data.json', '[]');
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/api/data', (req, res) => {
    try {
        const data = fs.readFileSync('data.json', 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.json([]);
    }
});

app.post('/save', (req, res) => {
    try {
        fs.writeFileSync('data.json', JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});