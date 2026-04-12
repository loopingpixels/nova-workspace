import { createAppServices } from '../src/app.js';

const services = createAppServices();
const summary = services.maintenance.runWeeklyReview();
console.log(JSON.stringify(summary, null, 2));
