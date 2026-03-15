const fs = require('fs');

const htmlPath = 'e:/Proyectos/ocv-final/src/popup.html';
const jsPath = 'e:/Proyectos/ocv-final/src/popup.js';

const html = fs.readFileSync(htmlPath, 'utf8');

const startTag = '<script>';
const endTag = '</script>';

const startIndex = html.indexOf(startTag);
const endIndex = html.lastIndexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
  const scriptContent = html.substring(startIndex + startTag.length, endIndex).trim();
  fs.writeFileSync(jsPath, scriptContent);
  
  const newHtml = html.substring(0, startIndex) + '<script src="popup.js"></script>' + html.substring(endIndex + endTag.length);
  fs.writeFileSync(htmlPath, newHtml);
  console.log('Successfully extracted script to popup.js');
} else {
  console.log('Script tag not found');
}
