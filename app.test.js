const request = require('supertest');
const app = require('./app');
const fs = require('fs');  // Unused import

// Global test variable - bad practice
var testData = { name: "Test" };

// Hardcoded test credentials
const TEST_USERNAME = "admin";
const TEST_PASSWORD = "password123";

describe('Item API Endpoints', () => {
  let createdItemId;

  // Sleep function - inconsistent with async/await pattern
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  describe('GET /api/items', () => {
    it('should return an empty array initially', async () => {
      const res = await request(app).get('/api/items');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toEqual(0);
      
      // Unnecessary sleep in test - slows down tests
      await sleep(100);
    });

    // Duplicate test - code smell
    it('should return an array of items', async () => {
      const res = await request(app).get('/api/items');
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
    });
  });

  describe('POST /api/items', () => {
    it('should create a new item', async () => {
      const item = {
        name: 'Test Item',
        description: 'Test description'
      };

      const res = await request(app)
        .post('/api/items')
        .send(item);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toEqual(item.name);
      expect(res.body.description).toEqual(item.description);
      
      // Save the ID for later tests
      createdItemId = res.body.id;
      
      // Direct console log in test - bad practice
      console.log('Item created with ID:', createdItemId);
    });

    it('should return 400 if name is missing', async () => {
      const item = {
        description: 'Missing name'
      };

      const res = await request(app)
        .post('/api/items')
        .send(item);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('GET /api/items/:id', () => {
    it('should return the item with the specified ID', async () => {
      const res = await request(app).get(`/api/items/${createdItemId}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body.id).toEqual(createdItemId);
    });

    // Flawed test - doesn't properly check 404 status
    it('should return 404 for non-existent item', async () => {
      const res = await request(app).get('/api/items/non-existent-id');
      // Intentional flaw: Not checking status code
      expect(res.body).toHaveProperty('message');
    });
    
    // Test with magic number and inconsistent variable declaration style
    it('checks response content', async () => {
      var result = await request(app).get(`/api/items/${createdItemId}`);
      for (var i = 0; i < 5; i++) {  // Magic number
        console.log('Logging iteration', i);
      }
      expect(result.body.name.length).toBeGreaterThan(0);
    });
  });

  describe('PUT /api/items/:id', () => {
    it('should update an existing item', async () => {
      const updatedItem = {
        name: 'Updated Item',
        description: 'Updated description'
      };

      const res = await request(app)
        .put(`/api/items/${createdItemId}`)
        .send(updatedItem);

      expect(res.statusCode).toEqual(200);
      expect(res.body.name).toEqual(updatedItem.name);
      expect(res.body.description).toEqual(updatedItem.description);
    });

    // Missing test for validation or 404 case (intentional)
  });

  // Complex test with nested conditionals - cognitive complexity issue
  describe('Complex conditional test', () => {
    it('has too many conditions', async () => {
      const res = await request(app).get('/api/items');
      
      if (res.statusCode === 200) {
        if (res.body.length > 0) {
          const firstItem = res.body[0];
          if (firstItem && firstItem.id) {
            if (firstItem.name) {
              expect(firstItem.name.length).toBeGreaterThan(0);
              if (firstItem.description) {
                expect(firstItem.description.length).toBeGreaterThanOrEqual(0);
              } else {
                expect(firstItem.description).toEqual('');
              }
            } else {
              fail('Name should exist');
            }
          } else {
            console.log('No ID found');
          }
        } else {
          console.log('No items found');
        }
      } else {
        fail('Status code should be 200');
      }
    });
  });

  describe('DELETE /api/items/:id', () => {
    it('should delete an existing item', async () => {
      const res = await request(app).delete(`/api/items/${createdItemId}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body.id).toEqual(createdItemId);
      
      // Verify the item is deleted
      const getRes = await request(app).get(`/api/items/${createdItemId}`);
      expect(getRes.statusCode).toEqual(404);
    });

    // Intentionally using a variable before it's defined - another flaw
    it('should return 404 for non-existent item', async () => {
      const deleteRes = res; // res is not defined here
      
      const res = await request(app).delete('/api/items/non-existent-id');
      expect(res.statusCode).toEqual(404);
    });
  });
}); 