const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load .env from the project that calls this script
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

async function deploy() {

    // Check for required environment variables
    const keyPath = process.env.UPLOAD_KEY_PATH || null;
    const password = process.env.UPLOAD_PASS || null;

    if (!process.env.UPLOAD_HOST || !process.env.UPLOAD_USER || !process.env.UPLOAD_PORT) {
        console.error("❌ Error: Missing SSH credentials in .env file.");
        console.error("Please ensure UPLOAD_HOST, UPLOAD_USER, and UPLOAD_PORT are set.");
        process.exit(1);
    }

    if (!keyPath && !password) {
        console.error("❌ Error: No SSH auth method configured.");
        console.error("Set UPLOAD_KEY_PATH (recommended) or UPLOAD_PASS in .env.");
        process.exit(1);
    }

    if (!keyPath && password) {
        console.warn('⚠️  Using password auth (sshpass). Migrate to SSH keys for better security.');
        console.warn('   Set UPLOAD_KEY_PATH in .env and remove UPLOAD_PASS.');
    }

    const host = process.env.UPLOAD_HOST;
    const user = process.env.UPLOAD_USER;
    const port = process.env.UPLOAD_PORT || 65002;

    const ROOT_DIR = process.cwd(); // Assume running from package root
    const DIST_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT_DIR, 'dist');

    // Determine remote dir based on domain
    let remoteDir = process.env.REMOTE_DIR;
    if (!remoteDir && process.env.DOMAIN) {
        // Absolute path for SCP/SSH: /home/user/domains/domain.com/public_html/
        remoteDir = `/home/${user}/domains/${process.env.DOMAIN}/public_html/`;
    }

    if (!remoteDir) {
        console.error("❌ Error: REMOTE_DIR not set.");
        process.exit(1);
    }

    // SSH auth helpers
    const sshAuth = keyPath ? `-i "${keyPath}"` : '';
    const sshPrefix = keyPath ? '' : `sshpass -p "${password}" `;
    const sshOpts = `-o StrictHostKeyChecking=accept-new`;

    // Local dir
    const localDir = DIST_DIR;

    // Zip + Upload + Unzip Strategy
    console.log(`🚀 Deploying via Zip + SCP (stable)...`);

    const zipFile = path.join(ROOT_DIR, 'deploy.zip');

    try {
        // 1. Zip files
        console.log(`\n📦 Zipping files...`);
        // cd to dist dir and zip everything to project root deploy.zip
        execSync(`cd "${localDir}" && zip -r "${zipFile}" . -x "*.DS_Store"`, { stdio: 'inherit' });

        // 2. Ensure remote dir exists
        console.log(`\n📂 Ensuring remote directory exists: ${remoteDir}`);
        const mkdirCmd = `${sshPrefix}ssh -p ${port} ${sshAuth} ${sshOpts} ${user}@${host} "mkdir -p ${remoteDir}"`;
        execSync(mkdirCmd, { stdio: 'inherit' });

        // 3. Upload Zip
        console.log(`\n📤 Uploading zip...`);
        const scpCmd = `${sshPrefix}scp -P ${port} ${sshAuth} ${sshOpts} "${zipFile}" ${user}@${host}:${remoteDir}deploy.zip`;
        execSync(scpCmd, { stdio: 'inherit' });

        // 4. Unzip on server
        console.log(`\n📂 Unzipping on server...`);
        const unzipCmd = `${sshPrefix}ssh -p ${port} ${sshAuth} ${sshOpts} ${user}@${host} "cd ${remoteDir} && unzip -o deploy.zip && rm deploy.zip"`;
        execSync(unzipCmd, { stdio: 'inherit' });

        // Fix permissions explicitly
        console.log(`\n🔧 Setting correct permissions...`);
        const chmodCmd = `${sshPrefix}ssh -p ${port} ${sshAuth} ${sshOpts} ${user}@${host} "chmod -R 644 ${remoteDir}*.html ${remoteDir}*/*.html 2>/dev/null || true"`;
        execSync(chmodCmd, { stdio: 'inherit' });

        // Purge Cloudflare cache
        const CF_API_KEY = process.env.CF_API_KEY;
        const CF_EMAIL = process.env.CF_EMAIL;
        const CF_ZONE_ID = process.env.CF_ZONE_ID;
        if (CF_API_KEY && CF_EMAIL && CF_ZONE_ID) {
            console.log(`\n🌐 Purging Cloudflare cache...`);
            try {
                const curlCmd = `curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" -H "X-Auth-Email: ${CF_EMAIL}" -H "X-Auth-Key: ${CF_API_KEY}" -H "Content-Type: application/json" --data '{"purge_everything":true}'`;
                const result = execSync(curlCmd, { encoding: 'utf8' });
                const parsed = JSON.parse(result);
                if (parsed.success) {
                    console.log("✅ Cloudflare cache purged successfully!");
                } else {
                    console.log("⚠️  Cloudflare purge response:", result);
                }
            } catch (cfErr) {
                console.log("⚠️  Cloudflare cache purge failed (non-blocking):", cfErr.message);
            }
        } else {
            console.log("\n⚠️  Skipping Cloudflare cache purge (CF_API_KEY/CF_EMAIL/CF_ZONE_ID not set)");
        }

        console.log("\n✅ Deployment complete!");
    } catch (err) {
        console.error("❌ Zip Deployment failed:", err.message);
        process.exit(1);
    } finally {
        // Cleanup local zip
        if (fs.existsSync(zipFile)) {
            fs.unlinkSync(zipFile);
        }
    }
}

deploy();
