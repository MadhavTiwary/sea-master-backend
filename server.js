const path = require('path');
const express = require('express');
const app = express();

// Serve static files from the correct directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle all other routes by serving the HTML file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
