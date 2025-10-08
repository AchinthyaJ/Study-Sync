// Appwrite Configuration
// Replace these values with your own Appwrite project details

const appwriteConfig = {
    endpoint: 'https://cloud.appwrite.io/v1', // Your Appwrite endpoint
    projectId: 'YOUR_PROJECT_ID', // Your project ID from Appwrite Console
    databaseId: 'YOUR_DATABASE_ID', // Your database ID

    // Collection IDs for the new canvas-based system
    roomsCollectionId: 'YOUR_ROOMS_TABLE_ID', // Collection ID for rooms
    nodesCollectionId: 'YOUR_NODES_TABLE_ID', // Collection ID for canvas nodes
    connectionsCollectionId: 'YOUR_CONNECTIONS_TABLE_ID', // Collection ID for node connections
    messagesCollectionId: 'YOUR_MESSAGES_TABLE_ID' // Collection ID for chat messages
};

// Export for use in app.js
window.appwriteConfig = appwriteConfig;
