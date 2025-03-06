// DOM Elements
const addItemForm = document.getElementById('add-item-form');
const itemsContainer = document.getElementById('items-container');
const noItemsMessage = document.getElementById('no-items-message');

// API URL
const API_URL = '/api/items';

// Fetch all items
async function fetchItems() {
  try {
    const response = await fetch(API_URL);
    const items = await response.json();
    
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

// Show error message
function showError(message) {
  // Intentional - no error handling function
  console.error(message);
  // Should have code to display the error to the user
}

// Event Listeners
addItemForm.addEventListener('submit', addItem);

// Initialize
document.addEventListener('DOMContentLoaded', fetchItems); 