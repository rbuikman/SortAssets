module.exports = {
    // Add your WoodWing Assets Server URL(s) here
    // Examples: 'https://your-assets-server.com', 'http://localhost:8080'
    CLIENT_URL_WHITELIST: [
        'https://shared-poc-dam.qonqordx.cloud',  // Your WoodWing Assets URL
        'http://localhost:50',
        'http://localhost:8080',
        'https://*.woodwing.com',
        '*' // Allow all origins for testing - restrict this in production!
    ],
    NEW_STATUS: ['Send To Cold Storage', 'Restore from Cold Storage']
};
