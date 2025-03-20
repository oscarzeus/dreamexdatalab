// ...existing require statements...
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
admin.initializeApp({
  // If using service account, ensure your initialization is correct.
  // ...admin initialization code...
});

exports.listAllUsers = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      // Handle CORS preflight
      res.set('Access-Control-Allow-Methods', 'GET, POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }
    let users = [];
    let nextPageToken = undefined;
    try {
      do {
        const result = await admin.auth().listUsers(1000, nextPageToken);
        users = users.concat(result.users);
        nextPageToken = result.pageToken;
      } while (nextPageToken);
      res.status(200).json(users.map(user => ({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "N/A"
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});
// ...existing code...