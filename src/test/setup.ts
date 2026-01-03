import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Tauri プラグインのモック
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// window.__TAURI_INTERNALS__ をモック
Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: {
    invoke: vi.fn(),
  },
  writable: true,
});
