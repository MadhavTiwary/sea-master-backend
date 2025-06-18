// Add this before the wildcard route
app.get('/api/data', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error reading data' });
  }
});

app.post('/api/save', (req, res) => {
  try {
    fs.writeFileSync('data.json', JSON.stringify(req.body));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error saving data' });
  }
});
