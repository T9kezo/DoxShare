// auth.js — Authentication module using PocketBase
import PocketBase from 'https://cdn.jsdelivr.net/npm/pocketbase/dist/pocketbase.es.mjs';
import logger from './logger.js';
import config from './config.js';

// ── PocketBase client (shared singleton) ────────────────────────────────────
export const pb = new PocketBase(config.pbUrl);

// Silence the auto-cancel warning for overlapping requests
pb.autoCancellation(false);

// ── Auth class ───────────────────────────────────────────────────────────────
class Auth {

    /**
     * Register a new user and auto-login.
     */
    async register(email, password, name = '') {
        try {
            logger.info('Attempting user registration', { email });
            await pb.collection('users').create({
                email,
                password,
                passwordConfirm: password,
                name: name || email.split('@')[0],
            });
            // Auto-login after registration
            await pb.collection('users').authWithPassword(email, password);
            logger.info('User registered and logged in', { userId: pb.authStore.model?.id });
            return pb.authStore.model;
        } catch (error) {
            logger.error('Registration failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Login with email + password.
     */
    async login(email, password) {
        try {
            logger.info('Attempting user login', { email });
            await pb.collection('users').authWithPassword(email, password);
            logger.info('User logged in successfully', { userId: pb.authStore.model?.id });
            return pb.authStore.model;
        } catch (error) {
            logger.error('Login failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Logout — clears the local auth store.
     */
    async logout() {
        try {
            logger.info('User logging out', { userId: pb.authStore.model?.id });
            pb.authStore.clear();
            logger.info('User logged out successfully');
        } catch (error) {
            logger.error('Logout failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Restore session from localStorage (PocketBase does this automatically).
     * Refreshes the token if valid to confirm it's still live.
     */
    async restoreSession() {
        try {
            if (!pb.authStore.isValid) return null;
            await pb.collection('users').authRefresh();
            logger.info('Session restored', { userId: pb.authStore.model?.id });
            return pb.authStore.model;
        } catch {
            pb.authStore.clear();
            return null;
        }
    }

    getCurrentUser() {
        return pb.authStore.isValid ? pb.authStore.model : null;
    }
}

const auth = new Auth();
export default auth;

