require('dotenv').config();
const ftp = require("basic-ftp");

async function testConnection() {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  const settings = [
    { name: "Plain FTP", secure: false },
    { name: "FTPS (Implicit/Explicit)", secure: true },
    { name: "FTPS (only-explicit)", secure: "explicit" }
  ];

  for (const setting of settings) {
    console.log(`\n--- Testing ${setting.name} ---`);
    try {
      await client.access({
        host: process.env.FTP_SERVER,
        user: process.env.FTP_USERNAME,
        password: process.env.FTP_PASSWORD,
        secure: setting.secure
      });
      console.log(`✅ ${setting.name} connected successfully!`);
      await client.list();
      client.close();
      return;
    } catch (err) {
      console.error(`❌ ${setting.name} failed:`, err.message);
    }
  }
  client.close();
}

testConnection();
