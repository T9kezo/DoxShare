// main.js — Application logic for Dox-Share (PocketBase edition)
import auth    from './auth.js';
import storage from './storage.js';
import logger  from './logger.js';

// ── Tesseract OCR (loaded from CDN via script tag in index.html) ─────────────
// Accessed via window.Tesseract

// ── Document type keyword map for OCR suggestions ───────────────────────────
const OCR_KEYWORDS = {
    'pan':      ['income tax', 'permanent account', 'pan', 'पैन'],
    'aadhaar':  ['aadhaar', 'आधार', 'unique identification', 'uidai'],
    'passport': ['passport', 'republic of india', 'pासपोर्ट'],
    'marksheet':['marksheet', 'mark sheet', 'university', 'board of', 'cgpa', 'sgpa'],
};

function suggestDocType(ocrText) {
    const lower = ocrText.toLowerCase();
    for (const [type, keywords] of Object.entries(OCR_KEYWORDS)) {
        if (keywords.some(kw => lower.includes(kw))) return type;
    }
    return null;
}

// ── App class ────────────────────────────────────────────────────────────────
class App {
    constructor() {
        this.currentPage   = 'login';
        this.allDocs       = [];
        this.allSharedDocs = [];
        this.init();
    }

    // ── Initialisation ──────────────────────────────────────────────────────
    async init() {
        logger.info('Initialising application');
        this.bindEvents();
        const user = await auth.restoreSession();
        if (user) {
            this.showPage('dashboard');
        } else {
            this.showPage('login');
        }
    }

    // ── Event bindings ──────────────────────────────────────────────────────
    bindEvents() {
        document.querySelectorAll('nav button[data-page]').forEach(btn => {
            btn.addEventListener('click', e => this.showPage(e.target.dataset.page));
        });
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
        document.getElementById('registerForm').addEventListener('submit', e => this.handleRegister(e));
        document.getElementById('loginForm').addEventListener('submit',    e => this.handleLogin(e));
        document.getElementById('uploadForm').addEventListener('submit', e => this.handleUpload(e));
        document.getElementById('shareForm').addEventListener('submit',  e => this.handleShare(e));
        document.getElementById('searchBar').addEventListener('input', e => this.filterDocs(e.target.value));
        document.getElementById('docFile').addEventListener('change', e => this.runOCR(e.target.files[0]));
        document.getElementById('closePreview').addEventListener('click', () => this.closePreview());
    }

    // ── Page routing ────────────────────────────────────────────────────────
    showPage(page) {
        logger.info('Switching to page', { page });
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const el = document.getElementById(page);
        if (el) el.classList.add('active');
        this.currentPage = page;
        this.updateNav();
        if (page === 'dashboard') this.loadDocuments();
        if (page === 'profile')   this.loadProfile();
    }

    updateNav() {
        const user = auth.getCurrentUser();
        document.querySelector('button[data-page="login"]').style.display    = user ? 'none' : 'inline-block';
        document.querySelector('button[data-page="register"]').style.display = user ? 'none' : 'inline-block';
        document.getElementById('dashboardBtn').style.display = user ? 'inline-block' : 'none';
        document.getElementById('profileBtn').style.display   = user ? 'inline-block' : 'none';
        document.getElementById('logoutBtn').style.display    = user ? 'inline-block' : 'none';
        if (user) {
            document.getElementById('userIdDisplay').textContent = user.id;
        }
    }

    // ── Auth handlers ───────────────────────────────────────────────────────
    async handleRegister(e) {
        e.preventDefault();
        const email    = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const name     = document.getElementById('regName')?.value.trim() || '';
        try {
            await auth.register(email, password, name);
            this.showPage('dashboard');
        } catch (err) {
            alert('Registration failed: ' + err.message);
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const email    = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        try {
            await auth.login(email, password);
            this.showPage('dashboard');
        } catch (err) {
            alert('Login failed: ' + err.message);
        }
    }

    async handleLogout() {
        try {
            await auth.logout();
            this.showPage('login');
        } catch (err) {
            alert('Logout failed: ' + err.message);
        }
    }

    // ── OCR ─────────────────────────────────────────────────────────────────
    async runOCR(file) {
        if (!file) return;
        const ocrStatus = document.getElementById('ocrStatus');
        ocrStatus.textContent = '🔍 Scanning document for type suggestion…';
        try {
            if (!window.Tesseract) { ocrStatus.textContent = ''; return; }
            const { data: { text } } = await window.Tesseract.recognize(file, 'eng+hin', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        ocrStatus.textContent = `🔍 OCR: ${Math.round(m.progress * 100)}%`;
                    }
                }
            });
            const suggestion = suggestDocType(text);
            if (suggestion) {
                document.getElementById('docType').value = suggestion;
                ocrStatus.textContent = `✅ Suggested type: "${suggestion}" (based on OCR). You can change it.`;
            } else {
                ocrStatus.textContent = '✅ OCR complete — could not auto-detect type.';
            }
            this._ocrSuggestion = suggestion;
            this._ocrText       = text;
        } catch (err) {
            logger.warn('OCR failed', { error: err.message });
            ocrStatus.textContent = '⚠️ OCR unavailable for this file.';
        }
    }

    // ── Upload ──────────────────────────────────────────────────────────────
    async handleUpload(e) {
        e.preventDefault();
        const file       = document.getElementById('docFile').files[0];
        const docType    = document.getElementById('docType').value;
        const aadhaarRaw = document.getElementById('aadhaarNumber').value.trim();
        const submitBtn  = e.target.querySelector('button[type="submit"]');
        if (!file) { alert('Please select a file.'); return; }
        submitBtn.disabled    = true;
        submitBtn.textContent = 'Uploading…';
        try {
            const user = auth.getCurrentUser();
            await storage.uploadDocument(file, user.id, {
                type:          docType,
                aadhaarRaw,
                ocrSuggestion: this._ocrSuggestion || null,
            });
            alert('Document uploaded successfully!');
            e.target.reset();
            document.getElementById('ocrStatus').textContent = '';
            this._ocrSuggestion = null;
            this.loadDocuments();
        } catch (err) {
            alert('Upload failed: ' + err.message);
        } finally {
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Upload';
        }
    }

    // ── Share ───────────────────────────────────────────────────────────────
    async handleShare(e) {
        e.preventDefault();
        const docId        = document.getElementById('shareDocId').value;
        const sharedWithId = document.getElementById('shareUserId').value.trim();
        try {
            const user = auth.getCurrentUser();
            await storage.shareDocument(docId, user.id, sharedWithId);
            alert('Document shared successfully!');
            this.showPage('dashboard');
        } catch (err) {
            alert('Sharing failed: ' + err.message);
        }
    }

    // ── Load & render documents ─────────────────────────────────────────────
    async loadDocuments() {
        try {
            const user = auth.getCurrentUser();
            if (!user) return;
            this.allDocs       = await storage.getDocuments(user.id);
            this.allSharedDocs = await storage.getSharedDocuments(user.id);
            this.renderDocs(this.allDocs, 'docsList');
            this.renderDocs(this.allSharedDocs, 'sharedDocsList', true);
        } catch (err) {
            logger.error('Failed to load documents', { error: err.message });
        }
    }

    renderDocs(docs, containerId, isShared = false) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        if (!docs.length) {
            container.innerHTML = `<p class="empty-msg">No documents found.</p>`;
            return;
        }
        docs.forEach(doc => {
            const card = document.createElement('div');
            card.className    = 'doc-card';
            card.dataset.name = (doc.file_name || '').toLowerCase();
            card.dataset.type = (doc.doc_type  || '').toLowerCase();

            const sizeKB     = (doc.file_size / 1024).toFixed(1);
            const aadhaarRow = doc.aadhaar_masked
                ? `<span class="doc-meta">🪪 Aadhaar: ${doc.aadhaar_masked}</span>`
                : '';
            const sharedBy = isShared
                ? `<span class="doc-meta shared-tag">📤 Shared by: ${doc.user_id}</span>`
                : '';

            card.innerHTML = `
                <div class="doc-card-header">
                    <span class="doc-icon">${this.getDocIcon(doc.doc_type)}</span>
                    <div class="doc-info">
                        <h4 class="doc-name">${doc.file_name}</h4>
                        <span class="doc-meta">📂 ${doc.doc_type || 'Unknown'} · ${sizeKB} KB</span>
                        ${aadhaarRow}
                        ${sharedBy}
                    </div>
                </div>
                <div class="doc-actions">
                    <button class="btn-icon" title="Preview"
                        onclick="app.previewDocument('${doc.id}')">👁 View</button>
                    ${!isShared ? `
                    <button class="btn-icon" title="Share"
                        onclick="app.openSharePanel('${doc.id}')">🔗 Share</button>
                    <button class="btn-icon btn-danger" title="Delete"
                        onclick="app.deleteDocument('${doc.id}')">🗑 Delete</button>
                    ` : ''}
                </div>
            `;
            container.appendChild(card);
        });
    }

    getDocIcon(type) {
        const icons = { aadhaar:'🪪', pan:'💳', passport:'🛂', marksheet:'📋', other:'📄' };
        return icons[type] || '📄';
    }

    // ── Search / Filter ─────────────────────────────────────────────────────
    filterDocs(query) {
        const q = query.toLowerCase();
        document.querySelectorAll('#docsList .doc-card').forEach(card => {
            const match = card.dataset.name.includes(q) || card.dataset.type.includes(q);
            card.style.display = match ? '' : 'none';
        });
    }

    // ── In-App Previewer ────────────────────────────────────────────────────
    /**
     * Fetches a secure file token from PocketBase then opens the preview overlay.
     * @param {string} docId — PocketBase record id
     */
    async previewDocument(docId) {
        const doc = [...this.allDocs, ...this.allSharedDocs].find(d => d.id === docId);
        if (!doc) { alert('Document not found.'); return; }

        const url     = await storage.getSecureFileUrl(doc);
        const overlay = document.getElementById('previewOverlay');
        const frame   = document.getElementById('previewFrame');
        const img     = document.getElementById('previewImage');

        if (doc.file_type?.startsWith('image/')) {
            frame.style.display = 'none';
            img.style.display   = 'block';
            img.src             = url;
        } else {
            img.style.display   = 'none';
            frame.style.display = 'block';
            frame.src           = url;
        }
        overlay.classList.add('active');
    }

    closePreview() {
        document.getElementById('previewOverlay').classList.remove('active');
        document.getElementById('previewFrame').src = '';
        document.getElementById('previewImage').src = '';
    }

    // ── Delete ──────────────────────────────────────────────────────────────
    async deleteDocument(docId) {
        if (!confirm('Are you sure you want to delete this document?')) return;
        try {
            await storage.deleteDocument(docId);
            alert('Document deleted.');
            this.loadDocuments();
        } catch (err) {
            alert('Deletion failed: ' + err.message);
        }
    }

    // ── Share panel ─────────────────────────────────────────────────────────
    openSharePanel(docId) {
        document.getElementById('shareDocId').value = docId;
        this.showPage('share');
    }

    // ── Profile ─────────────────────────────────────────────────────────────
    loadProfile() {
        const user = auth.getCurrentUser();
        if (!user) return;
        document.getElementById('profileInfo').innerHTML = `
            <p><strong>Name:</strong>  ${user.name  || '—'}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>User ID:</strong> <code>${user.id}</code></p>
            <p class="tip">💡 Share your User ID with family members so they can share documents with you.</p>
        `;
    }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const app = new App();
window.app = app;
