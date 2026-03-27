export default {
  import: ['features/support/**/*.ts'],
  worldParameters: {
    baseURL: 'http://localhost:3000',
  },
  letsrunit: {
    ignore: ['features/support/world.ts'],
  }
};
