import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Vitest auto-cleanup only registers when `globals` is enabled; we keep globals
// off and import test helpers explicitly, so unmount between tests by hand.
afterEach(cleanup);
