import { createApp } from './app.js';
import { config } from './config/env.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Qualitrack API escuchando en http://localhost:${config.port}/api`);
});
