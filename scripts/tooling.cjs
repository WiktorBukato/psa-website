const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname,'../tools.local.json');
const local = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : {};
function dependency(name) {
  try { return require(name); } catch(error) {
    if(local.moduleDirectory) return require(path.join(local.moduleDirectory,name));
    throw Error(`Development tool ${name} is missing. Reuse a central installation via tools.local.json, or install the documented dev dependency. ${error.message}`);
  }
}
module.exports={dependency,chromeExecutable:process.env.CHROME_EXECUTABLE||local.chromeExecutable};
