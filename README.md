# StudySync - Online Group Study Platform

A real-time collaborative study platform built with Appwrite. Create study rooms, share notes, flashcards, and quizzes with your study group, and export everything to PDF when you're done!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/YOUR_REPO)

## Features

- **Room-Based Collaboration** - Create or join study rooms with a simple code + password (no signup required)
- **Real-time Notes** - Add and share notes that appear instantly for all participants
- **Interactive Flashcards** - Create flip-able flashcards for Q&A practice
- **Live Quizzes** - Send multiple-choice quizzes to all room members in real-time
- **PDF Export** - Export all study materials (notes, flashcards, quizzes with answers) to a formatted PDF
- **Offline Mode** - Works with localStorage when Appwrite is not configured

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Appwrite (Cloud or Self-hosted)
- **Realtime**: Appwrite Realtime API
- **Database**: Appwrite Database
- **PDF Generation**: jsPDF

## Getting Started

### Prerequisites

- Node.js (optional, for local development server)
- An Appwrite account (free at [cloud.appwrite.io](https://cloud.appwrite.io))

### Appwrite Setup

#### Step 1: Create an Appwrite Project

1. Go to [Appwrite Console](https://cloud.appwrite.io/console)
2. Click **Create Project**
3. Name your project (e.g., "StudySync")
4. Copy your **Project ID** - you'll need this later

#### Step 2: Configure Web Platform

1. In your project, go to **Settings** → **Platforms**
2. Click **Add Platform** → **Web**
3. Add your platform details:
   - **Name**: StudySync Web
   - **Hostname**: `localhost` (for development) or your domain
   - Click **Next** to save

#### Step 3: Create Database and Collections

1. Go to **Databases** in the sidebar
2. Click **Create Database**
3. Name it "StudySync" and copy the **Database ID**

Now create 4 tables:

##### TABLE 1: Rooms
- **TABLE ID**: Copy this ID
- **Attributes**:
  - `roomCode` - String (required, size: 100)
  - `password` - String (required, size: 255)
  - `createdAt` - String (required, size: 50)
- **Permissions**:
  - Role: Any → Create, Read
  - (Users can create and read rooms)

##### TABLE 2: Notes
- **TABLE ID**: Copy this ID
- **Attributes**:
  - `title` - String (required, size: 200)
  - `content` - String (required, size: 5000)
  - `roomCode` - String (required, size: 100)
  - `timestamp` - String (required, size: 50)
- **Permissions**:
  - Role: Any → Create, Read, Delete

##### TABLE 3: Flashcards
- **TABLE ID**: Copy this ID
- **Attributes**:
  - `question` - String (required, size: 500)
  - `answer` - String (required, size: 1000)
  - `roomCode` - String (required, size: 100)
  - `timestamp` - String (required, size: 50)
- **Permissions**:
  - Role: Any → Create, Read, Delete

##### TABLE 4: Quizzes
- **TABLE ID**: Copy this ID
- **Attributes**:
  - `question` - String (required, size: 500)
  - `option1` - String (required, size: 200)
  - `option2` - String (required, size: 200)
  - `option3` - String (required, size: 200)
  - `option4` - String (required, size: 200)
  - `correctAnswer` - Integer (required)
  - `roomCode` - String (required, size: 100)
  - `timestamp` - String (required, size: 50)
- **Permissions**:
  - Role: Any → Create, Read

#### Step 4: Configure the Application

1. Open `public/js/config.js`
2. Replace the placeholder values with your Appwrite project details:

```javascript
const appwriteConfig = {
    endpoint: 'https://cloud.appwrite.io/v1', // Keep as is for Appwrite Cloud
    projectId: 'YOUR_PROJECT_ID', // From Step 1
    databaseId: 'YOUR_DATABASE_ID', // From Step 3
    roomsCollectionId: 'YOUR_ROOMS_TABLE_ID', // Collection 1 ID
    notesCollectionId: 'YOUR_NOTES_TABLE_ID', // Collection 2 ID
    flashcardsCollectionId: 'YOUR_FLASHCARDS_TABLE_ID', // Collection 3 ID
    quizzesCollectionId: 'YOUR_QUIZZES_TABLE_ID' // Collection 4 ID
};
```

## Deployment to Vercel

This project is ready to deploy on Vercel! Follow these simple steps:

### Quick Deploy

1. **Push to GitHub** (if not already done)
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin master
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will automatically detect the settings from `vercel.json`
   - Click "Deploy"

3. **Configure Appwrite**
   - After deployment, update `public/js/config.js` with your Appwrite credentials
   - In Appwrite Console, add your Vercel domain to the **Web Platform** hostnames

### Vercel CLI Deployment

Alternatively, use the Vercel CLI:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

The `vercel.json` configuration file is already set up to:
- Serve files from the `public` directory
- Handle client-side routing
- Set proper cache headers

### Running the Application Locally

#### Option 1: Simple HTTP Server

```bash
# Using Python 3
cd public
python3 -m http.server 8000

# Using Node.js
npx serve public

# Using PHP
cd public
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

#### Option 2: Open Directly

Simply open `public/index.html` in your web browser. The app will work, but some browsers may restrict certain features when opening files directly.

## Usage

### Creating a Room

1. Enter a unique room code (e.g., "math101")
2. Set a password for the room
3. Click **Create Room**
4. Share the room code and password with your study group

### Joining a Room

1. Get the room code and password from your study group
2. Enter them in the form
3. Click **Join Room**
4. Start collaborating in real-time!

### Adding Study Materials

**Notes:**
- Enter a title and content
- Click "Add Note"
- Notes appear instantly for all participants

**Flashcards:**
- Enter a question and answer
- Click "Add Flashcard"
- Click "Flip" to toggle between question and answer

**Quizzes:**
- Enter a question and 4 options
- Specify which option is correct (1-4)
- Click "Send Quiz to Room"
- All participants can answer and see results

### Exporting to PDF

1. Click **Export to PDF** button in the room header
2. A formatted PDF will be downloaded with:
   - All notes with titles and content
   - All flashcards with Q&A pairs
   - All quizzes with correct answers marked

Perfect for reviewing after your study session!

## Project Structure

```
For Appwrite/
├── package.json
├── README.md
└── public/
    ├── index.html              # Main HTML file
    ├── css/
    │   └── style.css           # Styles
    └── js/
        ├── config.js           # Appwrite configuration
        └── app.js              # Main application logic
```

## Features in Detail

### Real-time Collaboration

When Appwrite is configured, the app uses Appwrite Realtime API to:
- Sync notes across all participants instantly
- Share flashcards in real-time
- Push quizzes to all room members
- Handle deletions and updates

### Offline Mode

If Appwrite is not configured, the app automatically falls back to localStorage:
- All features work locally
- Data persists in browser
- Great for solo study or development

### PDF Export

The PDF export includes:
- **Formatted Header**: Room code and date
- **Notes Section**: All notes with titles and content
- **Flashcards Section**: Q&A pairs clearly labeled
- **Quiz Section**: Questions with all options and correct answers highlighted in green
- **Smart Pagination**: Automatically adds pages as needed

## Security Considerations

⚠️ **Important Notes:**

1. **Room passwords are stored in plain text** - This is a simple MVP implementation. For production:
   - Use Appwrite Auth for proper authentication
   - Hash passwords before storing
   - Implement proper access control

2. **Permissions** - The current setup uses "Any" role permissions, meaning:
   - Anyone can create rooms and add content
   - Anyone can delete notes/flashcards
   - This is fine for a trusted study group
   - For public use, implement proper auth and permissions

## Troubleshooting

### "Appwrite is not configured" message
- Make sure you've updated `public/js/config.js` with your actual project IDs
- Check that all IDs are correct (no typos)
- Verify your platform hostname matches in Appwrite Console

### Content not syncing in real-time
- Check browser console for errors
- Verify all collection IDs are correct
- Make sure permissions are set correctly in Appwrite Console
- Check that you're using the same room code

### PDF export fails
- Check browser console for errors
- Make sure there's content to export (at least one note, flashcard, or quiz)
- Try with a different browser if issues persist

## Future Enhancements

- [ ] User authentication with Appwrite Auth
- [ ] Private study rooms with invitation links
- [ ] File uploads and image support
- [ ] Audio/video recording in notes
- [ ] Study timer and break reminders
- [ ] Participant cursors and presence indicators
- [ ] Chat functionality
- [ ] Mobile app versions
- [ ] Study analytics and progress tracking

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## License

MIT License - feel free to use this project for learning or building your own study platform!

## Acknowledgments

- Built with [Appwrite](https://appwrite.io) - Backend as a Service
- PDF generation by [jsPDF](https://github.com/parallax/jsPDF)
- Inspired by collaborative learning and the power of group study

---

Made with ❤️ for students everywhere. Happy studying!
