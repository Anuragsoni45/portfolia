# B.Tech Portfolio & Secured Data Hub

A client-side portfolio application featuring Google Authentication, server-side data isolation, and anti-tamper security headers.

---

## 1. Firebase Setup Instructions

1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add Project**.
2. Under **Build > Authentication**, click **Get Started**, choose **Google**, and enable it.
3. Under **Build > Firestore Database**, click **Create Database** (start in Production mode).
4. Go to **Project Settings** (gear icon) > **General** > **Your apps** > select the **Web (`</>`)** icon to register the application.
5. Copy the configuration object and replace the `firebaseConfig` credentials inside `js/app.js`.

---

## 2. Security Rules (Strict Data Isolation)

To ensure users cannot view, edit, or delete another user's projects, go to **Firestore Database > Rules** tab in your Firebase Console and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      // Allow read/delete only if logged-in user owns the document
      allow read, delete: if request.auth != null && request.auth.uid == resource.data.userId;
      
      // Allow create only if the user stamps it with their own UID
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      
      // Prevent tampering of documents
      allow update: if request.auth != null && request.auth.uid == resource.data.userId && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

---

## 3. Running Locally

Google OAuth requires the site to run over `http://localhost` or `https://` (it will reject raw `file:///` protocols).

Run a quick local web server using Python or VS Code Live Server:

```bash
# If using Python 3
python -m http.server 8000
```

Open `http://localhost:8000` in your web browser.