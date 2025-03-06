const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for items
const items = [];

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// GET all items
app.get('/api/items', (req, res) => {
  res.json(items);
});

// GET item by ID
app.get('/api/items/:id', (req, res) => {
  const item = items.find(item => item.id === req.params.id);
  
  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }
  
  res.json(item);
});

// POST new item
app.post('/api/items', (req, res) => {
  const { name, description } = req.body;
  
  // Validation - Intentionally minimal for Codacy to detect
  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }
  
  const newItem = {
    id: uuidv4(),
    name,
    description: description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  items.push(newItem);
  res.status(201).json(newItem);
});

// PUT update item - Intentionally missing validation for Codacy to detect
app.put('/api/items/:id', (req, res) => {
  const index = items.findIndex(item => item.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ message: 'Item not found' });
  }
  
  // Missing validation here (intentional flaw)
  const { name, description } = req.body;
  
  // Update the item without any validation
  const updatedItem = {
    ...items[index],
    name: name !== undefined ? name : items[index].name,
    description: description !== undefined ? description : items[index].description,
    updatedAt: new Date().toISOString()
  };
  
  items[index] = updatedItem;
  res.json(updatedItem);
});

// DELETE item
app.delete('/api/items/:id', (req, res) => {
  const index = items.findIndex(item => item.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ message: 'Item not found' });
  }
  
  const deletedItem = items[index];
  items.splice(index, 1);
  
  res.json(deletedItem);
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app; // Export for testing 