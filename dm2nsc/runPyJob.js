'use strict';

const path = require('path');
const { spawn } = require('child_process');
const cron = require('node-cron');

// Path to the Python script that does the Diabetes-M -> Nightscout sync
const scriptPath = path.join(__dirname, 'getdata.py');

// Cron expression for when to run the job.
// Default: run at the top of every hour.
// You can override via DM2NSC_CRON, e.g. "*/5 * * * *" for every 5 minutes.
const scheduleExpression = process.env.DM2NSC_CRON || '*/5 * * * *';

const pythonExecutable = process.env.DM2NSC_PYTHON || 'python3';

function runJob() {
  console.log(`[dm2nsc] Starting Python sync job using ${pythonExecutable} ${scriptPath}`);

  const py = spawn(pythonExecutable, [scriptPath], {
    cwd: path.join(__dirname, '..'),
    env: process.env
  });

  py.stdout.on('data', (data) => {
    console.log(`[dm2nsc stdout] ${data}`);
  });

  py.stderr.on('data', (data) => {
    console.error(`[dm2nsc stderr] ${data}`);
  });

  py.on('close', (code) => {
    console.log(`[dm2nsc] Job exited with code ${code}`);
  });
}

console.log(`[dm2nsc] Scheduling Python sync job with cron expression "${scheduleExpression}"`);

// Schedule the job; it will automatically run while the Node app is running.
cron.schedule(scheduleExpression, runJob, {
  timezone: process.env.DM2NSC_TZ || undefined
});

module.exports = {
  runJob
};

