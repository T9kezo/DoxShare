# 🗂️ Dox-Share

A secure, lightweight web app to **store and share government documents** (Aadhaar, PAN, Passport, Marksheets) — built with vanilla JS and [PocketBase](https://pocketbase.io) as the backend.

---

## ✨ Features

- 📤 Upload documents (PDF, JPG, PNG — up to 10MB)
- 🪪 Automatic Aadhaar masking (only last 4 digits stored)
- 🔍 OCR-powered document type detection (Tesseract.js)
- 🔗 Share documents with other users by User ID
- 👁️ Secure in-app document preview
- 🔎 Search & filter your documents
- 🔐 Email/Password authentication via PocketBase

---

## 🛠️ Tech Stack

| Layer     | Technology              |
|-----------|-------------------------|
| Frontend  | Vanilla JS (ES Modules) |
| Backend   | PocketBase              |
| OCR       | Tesseract.js (CDN)      |
| Hosting   | Netlify (frontend) + Railway (backend) |

---

## 🚀 Live Demo

- **Frontend:** Deploy to Netlify
- **Backend:** [Railway PocketBase](https://pocketbase-production-c772.up.railway.app)

---

## ⚙️ Setup

### 1. Clone the repo

```bash
git clone https://github.com/T9kezo/Dox-Share.git
cd Dox-Share
```

### 2. Configure PocketBase URL

Edit `js/config.js`:

```js
const config = {
    pbUrl: 'https://your-pocketbase-url.com', // your PocketBase instance
};
```

### 3. PocketBase Collections

Create two collections in your PocketBase admin dashboard:

#### `documents` (Base collection)

| Field            | Type   | Required |
|------------------|--------|----------|
| `user_id`        | Text   | ✅       |
| `file`           | File   | ✅ (max 10MB, pdf/jpg/png) |
| `file_name`      | Text   | ✅       |
| `file_size`      | Number | ✅       |
| `file_type`      | Text   | ✅       |
| `doc_type`       | Text   | ✅       |
| `aadhaar_masked` | Text   | ❌       |
| `ocr_suggestion` | Text   | ❌       |

**API Rules:**
```
List/View/Update/Delete: user_id = @request.auth.id
Create: @request.auth.id != ""
```

#### `shares` (Base collection)

| Field            | Type | Required |
|------------------|------|----------|
| `document_id`    | Text | ✅       |
| `owner_id`       | Text | ✅       |
| `shared_with_id` | Text | ✅       |
| `shared_at`      | Text | ✅       |

**API Rules:**
```
List/View: shared_with_id = @request.auth.id || owner_id = @request.auth.id
Create: @request.auth.id != ""
Update/Delete: owner_id = @request.auth.id
```

### 4. Enable Email/Password Auth

In PocketBase Admin → Collections → `users` → Auth options → enable **Email/Password**.

### 5. Serve the frontend

Open `index.html` directly in your browser, or deploy to Netlify by dragging the project folder onto [netlify.com](https://netlify.com).

---

## 📁 Project Structure

```
Dox-Share/
├── index.html          # Main app (single page)
├── css/
│   └── styles.css      # All styles
└── js/
    ├── config.js       # PocketBase URL config
    ├── auth.js         # Login, register, logout
    ├── storage.js      # Document upload, share, delete
    ├── main.js         # App logic & UI
    └── logger.js       # Dev logging utility
```

---

## 🔒 Security

- Raw Aadhaar numbers are **never stored** — masked to last 4 digits before any DB write
- File access is **owner-only** via PocketBase collection rules
- Secure file preview uses PocketBase short-lived file tokens
- Auth sessions are managed by PocketBase and stored in `localStorage`

---

## 📄 License

MIT — free to use and modify.
