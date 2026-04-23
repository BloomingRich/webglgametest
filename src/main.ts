import { ExperienceApp } from './ExperienceApp';

const appRoot = document.getElementById('app');
if (!appRoot) {
  throw new Error('Missing #app root element');
}

const app = new ExperienceApp(appRoot);
app.start();
