# Cursor AI Interaction Logger

Automatically logs every AI interaction in Cursor - captures your prompts and the file changes Cursor makes.

## How It Works

Uses Cursor's official Hooks system:
- `beforeSubmitPrompt` hook → captures what you ask Cursor
- `afterFileEdit` hook → captures what files Cursor changes
- Links them together using `conversation_id`
- Stores everything in SQLite database

## Setup

1. **Install dependencies** (already done):
   ```bash
   npm install
   ```

2. **Test the system**:
   - Open this project (`/Users/workingapesh/Logger`) in Cursor
   - Chat with Cursor AI and ask it to create or modify a file
   - Example: "Create a hello.js file with a hello world function"

3. **View the logs**:
   ```bash
   node viewer.js
   ```

## Files

- `database.js` - SQLite database operations
- `prompt-logger.js` - Captures user prompts (called by Cursor)
- `edit-logger.js` - Captures file edits (called by Cursor)
- `.cursor/hooks.json` - Configuration telling Cursor when to call our scripts
- `viewer.js` - View logged interactions
- `cursor-interactions.db` - SQLite database (created automatically)
- `hook-debug.log` - Debug log showing exact JSON from Cursor
- `hook-errors.log` - Error log (if something goes wrong)

## Database Schema

**prompts table:**
- `id` - Unique ID
- `conversation_id` - Links to edits
- `prompt_text` - What you asked
- `timestamp` - When you asked

**edits table:**
- `id` - Unique ID
- `conversation_id` - Links back to prompt
- `file_path` - Which file was changed
- `old_string` - Code before
- `new_string` - Code after
- `timestamp` - When the edit happened

## Querying the Database

```bash
# View all prompts
sqlite3 cursor-interactions.db "SELECT * FROM prompts;"

# View all edits
sqlite3 cursor-interactions.db "SELECT * FROM edits;"

# Get a specific interaction
sqlite3 cursor-interactions.db "
  SELECT p.prompt_text, e.file_path, e.old_string, e.new_string
  FROM prompts p
  JOIN edits e ON p.conversation_id = e.conversation_id
  WHERE p.id = 1;
"
```

## Troubleshooting

1. **Not capturing data?**
   - Check `hook-debug.log` to see if hooks are firing
   - Check `hook-errors.log` for errors
   - Make sure you're running Cursor 1.7+ (hooks were added in 1.7)

2. **Want to see what Cursor sends?**
   - Check `hook-debug.log` - it shows the exact JSON structure

3. **Reset the database:**
   ```bash
   rm cursor-interactions.db
   # Database will be recreated on next interaction
   ```

## What's Next?

Once this works, you can:
- Add more context (model used, file selections, etc.)
- Create a web UI to browse logs
- Export to different formats
- Add Claude Code support (terminal monitoring)
- Make it a proper VS Code extension

## How Hooks Work

When Cursor's AI interacts with your code:

1. You type a prompt and hit Enter
2. Cursor runs: `node prompt-logger.js` (passes prompt as JSON via stdin)
3. prompt-logger.js saves to database
4. Cursor's AI thinks and edits files
5. Cursor runs: `node edit-logger.js` (passes edits as JSON via stdin)
6. edit-logger.js saves to database
7. Both share same `conversation_id` so they're linked!

## Test Edit

This is a random test edit made by Claude Code to test the hooks system!

The system now supports both Cursor AI and Claude Code through their respective hook systems.

This line was added to test if Claude Code edits are now being captured correctly!

🎲 Random fact: A group of flamingos is called a "flamboyance".
