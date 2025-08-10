// Test setup file for Jest
import { config } from 'dotenv';

// Load environment variables for testing
config({ path: '.env.test' });

// Global test timeout
jest.setTimeout(10000);

// Add a dummy test to satisfy Jest requirement
describe('Setup', () => {
  it('should load environment variables', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});
