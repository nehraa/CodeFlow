import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Global matchers
expect.extend({
  toBeInTheDocument: (received: any) => {
    if (received && typeof received === 'object' && 'toBeInTheDocument' in received) {
      return received.toBeInTheDocument();
    }
    return {
      pass: false,
      message: () => 'Expected element to be in the document',
    };
  },
});