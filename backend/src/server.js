import { createApp } from './app.js';
import { config } from './config/env.js';
import { startDocumentRequestScheduler } from './services/documentRequests.service.js';
import { assertRequestTokenConfiguration } from './services/requestToken.service.js';

assertRequestTokenConfiguration();
const app = createApp();

app.listen(config.port, () => {
  console.log(`Qualitrack API escuchando en http://localhost:${config.port}/api`);
  startDocumentRequestScheduler();
});
