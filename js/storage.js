// storage.js — Document storage module using PocketBase Collections + Files
import { pb } from './auth.js';
import logger from './logger.js';

// ── Aadhaar masking helper ──────────────────────────────────────────────────
/**
 * Returns only the last 4 digits of an Aadhaar number.
 * Full number is NEVER stored in the database.
 *
 * @param {string} raw — raw Aadhaar input from the user
 * @returns {string} — e.g. "XXXX-XXXX-6789"
 */
function maskAadhaar(raw) {
    const digits = (raw || '').replace(/\D/g, '');
    if (digits.length < 4) return 'XXXX';
    const last4 = digits.slice(-4);
    return `XXXX-XXXX-${last4}`;
}

// ── Storage class ────────────────────────────────────────────────────────────
class StorageService {

    /**
     * Upload a file to PocketBase and save metadata as a record in `documents`.
     *
     * PocketBase stores the file directly on the record — no separate bucket needed.
     *
     * @param {File}   file
     * @param {string} userId
     * @param {Object} metadata  — { type, aadhaarRaw, ocrSuggestion }
     * @returns {Object} — the created PocketBase record
     */
    async uploadDocument(file, userId, metadata = {}) {
        try {
            logger.info('Uploading document', { userId, fileName: file.name });

            const maskedAadhaar = metadata.aadhaarRaw
                ? maskAadhaar(metadata.aadhaarRaw)
                : null;

            // PocketBase file uploads use FormData
            const formData = new FormData();
            formData.append('file',           file);
            formData.append('user_id',        userId);
            formData.append('file_name',      file.name);
            formData.append('file_size',      file.size);
            formData.append('file_type',      file.type);
            formData.append('doc_type',       metadata.type || 'other');
            if (maskedAadhaar)               formData.append('aadhaar_masked',  maskedAadhaar);
            if (metadata.ocrSuggestion)      formData.append('ocr_suggestion',  metadata.ocrSuggestion);

            const record = await pb.collection('documents').create(formData);
            logger.info('Document uploaded', { docId: record.id });
            return record;
        } catch (error) {
            logger.error('Upload failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Fetch all documents owned by userId.
     */
    async getDocuments(userId) {
        try {
            logger.info('Fetching own documents', { userId });
            return await pb.collection('documents').getFullList({
                filter: `user_id = "${userId}"`,
                sort:   '-created',
            });
        } catch (error) {
            logger.error('Failed to fetch documents', { error: error.message });
            throw error;
        }
    }

    /**
     * Fetch documents shared with userId.
     */
    async getSharedDocuments(userId) {
        try {
            logger.info('Fetching shared documents', { userId });

            // 1. Find all share records for this user
            const shares = await pb.collection('shares').getFullList({
                filter: `shared_with_id = "${userId}"`,
            });

            // 2. Fetch each referenced document (skip deleted ones)
            const docs = await Promise.all(
                shares.map(share =>
                    pb.collection('documents').getOne(share.document_id).catch(() => null)
                )
            );

            return docs.filter(Boolean);
        } catch (error) {
            logger.error('Failed to fetch shared documents', { error: error.message });
            throw error;
        }
    }

    /**
     * Delete a document record (PocketBase also removes the attached file).
     * Cleans up related share records too.
     */
    async deleteDocument(docId) {
        try {
            logger.info('Deleting document', { docId });

            // Clean up share records first
            const shares = await pb.collection('shares').getFullList({
                filter: `document_id = "${docId}"`,
            });
            await Promise.all(shares.map(s => pb.collection('shares').delete(s.id)));

            // Delete the document record (PocketBase deletes the attached file automatically)
            await pb.collection('documents').delete(docId);
            logger.info('Document deleted successfully', { docId });
        } catch (error) {
            logger.error('Deletion failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Share a document with another user by creating a share record.
     */
    async shareDocument(docId, ownerId, sharedWithId) {
        try {
            logger.info('Sharing document', { docId, sharedWithId });

            await pb.collection('shares').create({
                document_id:    docId,
                owner_id:       ownerId,
                shared_with_id: sharedWithId,
                shared_at:      new Date().toISOString(),
            });

            logger.info('Document shared successfully', { docId, sharedWithId });
        } catch (error) {
            logger.error('Sharing failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Returns a secure, authenticated file URL for previewing.
     * PocketBase requires a short-lived file token for protected files.
     *
     * @param {Object} record    — the full PocketBase document record
     * @returns {string} URL
     */
    async getSecureFileUrl(record) {
        try {
            // Get a short-lived file access token (valid ~5 min)
            const token = await pb.files.getToken();
            return pb.getFileUrl(record, record.file, { token });
        } catch {
            // Fallback: unauthenticated URL (works if collection rule allows it)
            return pb.getFileUrl(record, record.file);
        }
    }
}

const storageService = new StorageService();
export default storageService;

