module.exports = {
    // Add your WoodWing Assets Server URL(s) here
    // Examples: 'https://your-assets-server.com', 'http://localhost:8080'
    CLIENT_URL_WHITELIST: [
        'https://shared-poc-dam.qonqord.cloud',  // Your WoodWing Assets URL
        'http://localhost:50',
        'http://localhost:8080',
        'https://*.woodwing.com',
        '*' // Allow all origins for testing - restrict this in production!
    ],

    // Configure which columns to show in the table view per WoodWing Assets URL
    // Use '*' to show all asset properties dynamically, or specify an array of property names
    // Property names can use dot notation for nested properties: 'metadata.status'
    COLUMN_CONFIG: {
        'https://shared-poc-dam.qonqord.cloud': ['name', 'status', 'explicitSortOrder'], // Show all properties for this URL
        'default': ['name', 'status', 'fileSize', 'explicitSortOrder'] // Default columns for any other URL
    }
};
