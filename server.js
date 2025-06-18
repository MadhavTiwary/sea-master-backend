const path = require('path');
const express = require('express');
const app = express();

// Serve static files from the correct directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle all other routes by serving the HTML file
app.get('*', (req, res) => {
  // Change line 10 to:
res.sendFile(path.join(__dirname, 'dashboard.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
