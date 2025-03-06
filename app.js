const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');  // Unused import
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');  // Another unused import

const app = express();
const PORT = process.env.PORT || 3000;
var DEBUG = true;  // Global variable with inconsistent declaration style

// In-memory storage for items
const items = [];
let secretKey = "hardcoded-secret-key";  // Security issue: Hardcoded credentials

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Insecure eval usage
function dynamicCalculation(expression) {
    return eval(expression);  // Security vulnerability: eval usage
}

// GET all items
app.get('/api/items', (req, res) => {
  if(DEBUG) console.log("Getting all items");  // Bad practice: console log in production code
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

// Insecure exec usage
app.get('/api/execute/:command', (req, res) => {
  const { exec } = require('child_process');
  exec(req.params.command, (error, stdout, stderr) => {  // Security vulnerability: command injection
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ result: stdout });
  });
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

// Duplicate code for validation (code smell)
function validateName(name) {
  if (!name) return false;
  return true;
}

function checkName(name) {  // Duplicated functionality
  if (!name) return false;
  return true;
}

// PUT update item - Intentionally missing validation for Codacy to detect
app.put('/api/items/:id', (req, res) => {
  const index = items.findIndex(item => item.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ message: 'Item not found' });
  }
  
  // Missing validation here (intentional flaw)
  const { name, description } = req.body;
  var unused_var = "This is never used";  // Unused variable
  
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

// Complex nested function with high cognitive complexity
function complexFunction(a, b, c) {
  let result = 0;
  if (a > 0) {
    if (b > 0) {
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          result += i;
        } else {
          if (c > 0) {
            result -= i;
          } else {
            result += i * 2;
          }
        }
      }
    } else {
      if (c > 0) {
        result = a * c;
      } else {
        result = a - c;
      }
    }
  } else {
    result = b + c;
  }
  return result;
}

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app; // Export for testing 