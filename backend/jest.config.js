/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  roots: ['<rootDir>/tests'],
  testTimeout: 60000, // first run downloads the in-memory MongoDB binary
  maxWorkers: 1, // share one memory-server download; avoids Windows file locks
};
