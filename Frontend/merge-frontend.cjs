const fs = require('fs');
const path = require('path');

function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  fs.readdirSync(from).forEach(element => {
    if (element === 'node_modules' || element === '.git') return;
    
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    
    const stat = fs.lstatSync(fromPath);
    if (stat.isFile()) {
      fs.copyFileSync(fromPath, toPath);
    } else if (stat.isDirectory()) {
      copyFolderSync(fromPath, toPath);
    }
  });
}

const target = '../Frontend';
if (fs.existsSync(target)) {
  try {
    const s1 = fs.statSync('.');
    const s2 = fs.statSync(target);
    const isSameDirectory = s1.ino === s2.ino && s1.dev === s2.dev;
    
    if (!isSameDirectory) {
      console.log('Merging sibling Frontend (uppercase) into current frontend (lowercase)...');
      copyFolderSync(target, '.');
      console.log('Merge completed successfully.');
    } else {
      console.log('No merging needed: paths point to the same physical directory on Windows.');
    }
  } catch (err) {
    console.error('Error comparing folders:', err);
  }
} else {
  console.log('Sibling Frontend directory does not exist.');
}
