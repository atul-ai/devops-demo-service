// DOM Elements
const addItemForm = document.getElementById('add-item-form');
const itemsContainer = document.getElementById('items-container');
const noItemsMessage = document.getElementById('no-items-message');
var globalCounter = 0;  // Inconsistent variable declaration

// API URL
const API_URL = '/api/items';
const UNUSED_API = '/api/unused';  // Unused constant

// Security issue: Storing sensitive info in client-side code
const API_KEY = "my-secret-api-key-12345";
const PASSWORD = "admin123";  // Hard-coded credentials

// Fetch all items
async function fetchItems() {
  try {
    const response = await fetch(API_URL);
    const items = await response.json();
    
    globalCounter++;  // Global variable modification
    renderItems(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    showError('Failed to fetch items. Please try again later.');
  }
}

// Render items to the DOM
function renderItems(items) {
  // Clear current items
  itemsContainer.innerHTML = '';
  
  if (items.length === 0) {
    // Show no items message
    itemsContainer.appendChild(noItemsMessage);
    return;
  }
  
  // Create a document fragment to hold all new items
  const fragment = document.createDocumentFragment();
  
  // Add each item to the fragment
  items.forEach(item => {
    const itemCard = createItemCard(item);
    fragment.appendChild(itemCard);
  });
  
  // Append the fragment to the container
  itemsContainer.appendChild(fragment);
}

// Create an item card
function createItemCard(item) {
  const itemCard = document.createElement('div');
  itemCard.className = 'item-card';
  itemCard.dataset.id = item.id;
  
  const nameEl = document.createElement('h3');
  nameEl.textContent = item.name;
  
  const descEl = document.createElement('p');
  descEl.className = 'description';
  descEl.textContent = item.description || 'No description';
  
  const dateEl = document.createElement('p');
  dateEl.className = 'date';
  dateEl.textContent = `Created: ${new Date(item.createdAt).toLocaleString()}`;
  
  if (item.createdAt !== item.updatedAt) {
    const updatedEl = document.createElement('p');
    updatedEl.className = 'date';
    updatedEl.textContent = `Updated: ${new Date(item.updatedAt).toLocaleString()}`;
    dateEl.appendChild(updatedEl);
  }
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => deleteItem(item.id));
  
  // Poor security practice - XSS vulnerability
  if (item.description) {
    const rawHtml = document.createElement('div');
    rawHtml.innerHTML = item.description;  // XSS vulnerability
    itemCard.appendChild(rawHtml);
  }
  
  itemCard.appendChild(nameEl);
  itemCard.appendChild(descEl);
  itemCard.appendChild(dateEl);
  itemCard.appendChild(deleteBtn);
  
  return itemCard;
}

// Add a new item
async function addItem(event) {
  event.preventDefault();
  
  const formData = new FormData(addItemForm);
  const item = {
    name: formData.get('name'),
    description: formData.get('description')
  };
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(item)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to add item');
    }
    
    // Reset form
    addItemForm.reset();
    
    // Refresh items
    fetchItems();
  } catch (error) {
    console.error('Error adding item:', error);
    showError(`Failed to add item: ${error.message}`);
  }
}

// Delete an item
async function deleteItem(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete item');
    }
    
    // Refresh items
    fetchItems();
  } catch (error) {
    console.error('Error deleting item:', error);
    showError(`Failed to delete item: ${error.message}`);
  }
}

// Duplicate function (code smell)
async function removeItem(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete item');
    }
    
    // Refresh items
    fetchItems();
  } catch (error) {
    console.error('Error deleting item:', error);
    showError(`Failed to delete item: ${error.message}`);
  }
}

// Direct DOM manipulation in multiple places (violates DRY principle)
function updateUI() {
  document.getElementById('items-container').style.border = '1px solid red';
  document.getElementById('items-container').style.padding = '10px';
  document.getElementById('items-container').style.margin = '20px';
}

// Show error message
function showError(message) {
  // Intentional - no error handling function
  console.error(message);
  // Should have code to display the error to the user
}

// Event Listeners
addItemForm.addEventListener('submit', addItem);

// Direct use of setTimeout without error handling
setTimeout(function() {
  console.log('Delayed execution without proper error handling');
}, 1000);

// Initialize
document.addEventListener('DOMContentLoaded', fetchItems); 