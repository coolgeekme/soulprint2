# MongoDB Backup & Import Instructions

## Backup Information

**Backup File:** `mongodb-backup-20260317-013013.tar.gz`
**Created:** March 17, 2026 01:30:13 UTC
**Size:** 8.8 KB
**Database:** soulprint

### What's Included

**Collections Backed Up:**
- users (3 documents)
- profiles (3 documents)
- messages (9 documents)
- conversations (6 documents)
- assessment_answers (1 document)
- assessment_questions (36 documents)
- communication_profiles (1 document)
- layered_assessment_answers (1 document)

**Users in Backup:**
- test@soulprintengine.com (superadmin)
- reggie+test@archeforge.com
- wwmassey1@gmail.com

---

## How to Import into Your Backup/Production App

### Method 1: Using mongorestore (Recommended)

**Step 1: Download the backup file**
```bash
# The file is located at: /app/mongodb-backup-20260317-013013.tar.gz
# Download it to your local machine or directly to your backup server
```

**Step 2: Extract the backup**
```bash
tar -xzf mongodb-backup-20260317-013013.tar.gz
cd soulprint
```

**Step 3: Import to your backup app**
```bash
# Replace <MONGO_URL> with your backup app's MongoDB connection string
mongorestore --uri="<MONGO_URL>" --nsFrom="soulprint.*" --nsTo="soulprint.*" .

# Example:
# mongorestore --uri="mongodb://localhost:27017/soulprint" --nsFrom="soulprint.*" --nsTo="soulprint.*" .
```

**Step 4: Verify import**
```bash
mongosh "<MONGO_URL>" --eval "
  db = db.getSiblingDB('soulprint');
  print('Users:', db.users.countDocuments());
  print('Messages:', db.messages.countDocuments());
  print('Conversations:', db.conversations.countDocuments());
"
```

---

### Method 2: Using JSON imports (Alternative)

If you prefer JSON format or need to modify data:

**Step 1: Extract and navigate to JSON files**
```bash
tar -xzf mongodb-backup-20260317-013013.tar.gz
ls *.json
# You'll see: users.json, profiles.json, messages.json, conversations.json, assessment_answers.json
```

**Step 2: Import each JSON file**
```bash
mongoimport --uri="<MONGO_URL>" --collection=users --file=users.json --jsonArray
mongoimport --uri="<MONGO_URL>" --collection=profiles --file=profiles.json --jsonArray
mongoimport --uri="<MONGO_URL>" --collection=messages --file=messages.json --jsonArray
mongoimport --uri="<MONGO_URL>" --collection=conversations --file=conversations.json --jsonArray
mongoimport --uri="<MONGO_URL>" --collection=assessment_answers --file=assessment_answers.json --jsonArray
```

---

### Method 3: Import via Emergent Chat Interface

If your backup app is deployed on Emergent:

**Step 1: Upload backup file**
1. Go to your backup app's Emergent dashboard
2. Open the agent/chat interface
3. Upload the `mongodb-backup-20260317-013013.tar.gz` file

**Step 2: Ask the agent to import**
```
Please import this MongoDB backup into the database. 
Extract the tar.gz and run mongorestore to import all collections.
```

---

## Important Notes

### ⚠️ Before Importing

1. **Backup your target database first** (if it has existing data)
2. **Check for conflicts**: If users with same emails exist, decide on merge strategy
3. **User passwords**: Passwords are hashed and will work in the new environment

### 🔐 User Accounts

After import, these users can log in:
- **test@soulprintengine.com** - Superadmin role, passcode: test123456
- **reggie+test@archeforge.com** - Regular user
- **wwmassey1@gmail.com** - Regular user

### 🔄 Data Relationships

All foreign keys and relationships are preserved:
- Messages → linked to conversations and users
- Profiles → linked to user accounts
- Conversations → linked to users

### ⚡ Quick Import Command

If your backup app has the same MongoDB setup:

```bash
# One-line import (on backup server with backup file)
tar -xzf mongodb-backup-20260317-013013.tar.gz && \
mongorestore --uri="mongodb://localhost:27017/soulprint" --drop ./soulprint/

# The --drop flag will replace existing collections
# Remove --drop if you want to merge data instead
```

---

## Verification After Import

```bash
mongosh "mongodb://localhost:27017/soulprint" --eval "
  print('=== Import Verification ===');
  print('Users:', db.users.countDocuments());
  print('Profiles:', db.profiles.countDocuments());
  print('Messages:', db.messages.countDocuments());
  print('Conversations:', db.conversations.countDocuments());
  print('Assessment answers:', db.assessment_answers.countDocuments());
  print('Assessment questions:', db.assessment_questions.countDocuments());
  print('');
  print('Expected: 3 users, 3 profiles, 9 messages, 6 conversations, 1 answer, 36 questions');
"
```

---

## Troubleshooting

**Problem: "Collection already exists"**
- Solution: Add `--drop` flag to mongorestore to replace existing collections
- Or: Use `--nsFrom` and `--nsTo` with different names to avoid conflicts

**Problem: "Connection refused"**
- Solution: Verify MongoDB is running and MONGO_URL is correct
- Check: `mongosh "mongodb://localhost:27017" --eval "db.version()"`

**Problem: "Duplicate key error"**
- Solution: Existing users/data conflicts. Either:
  - Drop existing collections first
  - Or manually merge data by editing JSON files

---

## File Location

The backup file is saved at:
```
/app/mongodb-backup-20260317-013013.tar.gz
```

You can download it via:
1. Emergent file browser
2. `cat /app/mongodb-backup-20260317-013013.tar.gz | base64` (then decode on local machine)
3. Or ask the agent to show the file content

---

**Need help?** Just ask and I'll assist with the import process!
