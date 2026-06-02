/**
 * Chatvora — Create Super Admin Account
 * 
 * Usage:
 *   cd backend
 *   node create-super-admin.js
 *
 * Or with custom credentials:
 *   node create-super-admin.js --email admin@chatvora.com --password MyPass123 --username superadmin
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

const DEFAULT_EMAIL = 'admin@chatvora.com';
const DEFAULT_USERNAME = 'superadmin';
const DEFAULT_PASSWORD = 'Admin@123456';
const DEFAULT_DISPLAY_NAME = 'Super Admin';
const ROLE = 'super_admin';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      parsed[key] = args[i + 1] || true;
      i++;
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs();

  const email = args.email || DEFAULT_EMAIL;
  const username = args.username || DEFAULT_USERNAME;
  const password = args.password || DEFAULT_PASSWORD;
  const displayName = args.displayname || args.displayName || DEFAULT_DISPLAY_NAME;

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.DB_NAME || 'chatwave';

  console.log('');
  console.log('===========================================================');
  console.log('   Chatvora - Super Admin Creator');
  console.log('===========================================================');
  console.log('');

  let client;

  try {
    console.log('[1/4] Connecting to MongoDB...');
    client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection('users');
    console.log('       OK - Connected successfully');

    console.log('[2/4] Checking for existing super_admin...');
    const existingSuper = await users.findOne({ role: 'super_admin' });

    if (existingSuper) {
      console.log('       WARNING: A super_admin already exists: @' + existingSuper.username + ' (' + existingSuper.email + ')');
      console.log('');
      console.log('   If you want to reset the password, delete the user first:');
      console.log('   > use chatwave');
      console.log('   > db.users.deleteOne({ role: "super_admin" })');
      console.log('   Then run this script again.');
      console.log('');
      await client.close();
      process.exit(0);
    }

    console.log('[3/4] Checking for existing user...');
    const existingUser = await users.findOne({
      $or: [{ email: email }, { username: username }]
    });

    if (existingUser) {
      console.log('       Found existing user @' + existingUser.username + ' - upgrading to super_admin...');
      await users.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            role: ROLE,
            updatedAt: new Date()
          }
        }
      );
      console.log('       OK - User upgraded to super_admin successfully!');
      console.log('');
      console.log('   -----------------------------------------');
      console.log('   Super Admin Credentials (upgraded)');
      console.log('   -----------------------------------------');
      console.log('   Email:    ' + email);
      console.log('   Username: @' + existingUser.username);
      console.log('   Password: (existing password)');
      console.log('   Role:     ' + ROLE);
      console.log('   -----------------------------------------');
    } else {
      console.log('[4/4] Creating new super_admin account...');
      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = {
        email: email,
        username: username,
        password: hashedPassword,
        displayName: displayName,
        role: ROLE,
        avatar: null,
        bio: 'Super Administrator - Full system access',
        phone: '',
        isOnline: false,
        lastSeen: new Date(),
        contacts: [],
        blockedUsers: [],
        preferences: {
          theme: 'dark',
          notifications: true,
          sound: true,
          vibration: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await users.insertOne(newUser);
      console.log('       OK - Super admin created successfully!');
      console.log('');
      console.log('   -----------------------------------------');
      console.log('   Super Admin Credentials');
      console.log('   -----------------------------------------');
      console.log('   Email:    ' + email);
      console.log('   Username: @' + username);
      console.log('   Password: ' + password);
      console.log('   Role:     ' + ROLE);
      console.log('   -----------------------------------------');
    }

    console.log('');
    console.log('   IMPORTANT: Save these credentials in a safe place!');
    console.log('   Login at: http://localhost:3000/login');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('   ERROR:', error.message);
    console.error('');

    if (error.message.includes('ECONNREFUSED')) {
      console.error('   Make sure MongoDB is running:');
      console.error('   > net start MongoDB');
    }

    process.exit(1);
  } finally {
    if (client) await client.close();
  }
}

main();