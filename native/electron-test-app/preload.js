const { contextBridge } = require('electron');
const fs = require('fs');
const path = '/tmp/ac-electron-test-status.txt';

contextBridge.exposeInMainWorld('acTestStatus', {
  write: (status) => {
    const line = `${new Date().toISOString()} ${status}\n`;
    fs.appendFileSync(path, line, 'utf-8');
  },
});
