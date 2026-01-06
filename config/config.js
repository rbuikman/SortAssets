module.exports = {
    // Add your WoodWing Assets Server URL(s) here
    // Examples: 'https://your-assets-server.com'
    CLIENT_URL_WHITELIST: [
        'https://shared-poc-dam.qonqord.cloud',  // Your WoodWing Assets URL
        'http://localhost:8080',
    ],

    // Configure which columns to show in the table view per WoodWing Assets URL
    // Use '*' to show all asset properties dynamically, or specify an array of property names
    // Property names can use dot notation for nested properties: 'metadata.status'
    COLUMN_CONFIG: {
        'default': ['name', 'status', 'fileSize', 'explicitSortOrder'], // Default columns for any other URL
        'https://shared-poc-dam.qonqord.cloud': ['name', 'status', 'explicitSortOrder'], // Show all properties for this URL
    }
};
