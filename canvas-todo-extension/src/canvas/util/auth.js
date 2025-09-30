// Canvas OAuth Authentication Utilities

import { get as idbGet, set as idbSet } from 'idb-keyval';
import { v4 as uuidv4 } from 'uuid';
import log from 'loglevel';

const logger = log.getLogger('Canvas');

const instanceId = uuidv4();
const messageSourceId = 'CanvasAuthProvider';

const cacheScope = 'canvas-todo';
const lastLoginKey = 'canvas-last-login';

// Generate a random string for PKCE
function generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    randomValues.forEach(v => {
        result += charset[v % charset.length];
    });
    return result;
}

// Create SHA256 hash for PKCE
async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return hashBuffer;
}

// Base64 URL encode
function base64urlencode(buffer) {
    const str = String.fromCharCode(...new Uint8Array(buffer));
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(new RegExp('=+$'), '');
}

// Generate code challenge for PKCE
async function generateCodeChallenge(codeVerifier) {
    const hashed = await sha256(codeVerifier);
    return base64urlencode(hashed);
}

function getCurrentExperienceUserId({ cacheStoreItem }) {
    cacheStoreItem({ key: 'store', data: 'something' });
    return localStorage.getItem('experience-user-id');
}

// Check if we're handling an OAuth callback
function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
        logger.error('OAuth error:', error);
        return null;
    }

    if (code && state) {
        // Clear the URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        return { code, state };
    }

    return null;
}

export async function login({ canvasBaseUrl, canvasClientId, canvasRedirectUri, cacheStoreItem, cacheGetItem }) {
    try {
        // First check if we're returning from OAuth
        const oauthCallback = handleOAuthCallback();
            if (oauthCallback) {
            // We're returning from Canvas OAuth
            const { code, state: returnedState } = oauthCallback;
            const storedState = await idbGet('canvas-oauth-state');
            const codeVerifier = await idbGet('canvas-code-verifier');

            if (returnedState !== storedState) {
                logger.error('OAuth state mismatch');
                return false;
            }

            // Exchange code for token
            const tokenResponse = await exchangeCodeForToken({
                canvasBaseUrl,
                canvasClientId,
                canvasRedirectUri,
                code,
                codeVerifier
            });

            if (tokenResponse) {
                const currentExperienceUserId = getCurrentExperienceUserId({ cacheStoreItem });
                await idbSet(lastLoginKey, {
                    lastExperienceUserId: currentExperienceUserId,
                    accessToken: tokenResponse.access_token,
                    refreshToken: tokenResponse.refresh_token,
                    expiresAt: Date.now() + (tokenResponse.expires_in * 1000)
                });

                // Clean up
                await idbSet('canvas-code-verifier', null);
                await idbSet('canvas-oauth-state', null);

                window.postMessage({
                    sourceId: messageSourceId,
                    sourceInstanceId: instanceId,
                    type: 'login'
                }, '*');

                return true;
            }
            return false;
        }

        // Generate PKCE parameters
        const codeVerifier = generateRandomString(128);
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const state = generateRandomString(32);

        // Store code verifier and state for later use
        await idbSet('canvas-code-verifier', codeVerifier);
        await idbSet('canvas-oauth-state', state);

        // Build authorization URL
        const authUrl = new URL(`${canvasBaseUrl}/login/oauth2/auth`);
        authUrl.searchParams.append('client_id', canvasClientId);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('redirect_uri', canvasRedirectUri);
        authUrl.searchParams.append('state', state);
        authUrl.searchParams.append('code_challenge', codeChallenge);
        authUrl.searchParams.append('code_challenge_method', 'S256');
        authUrl.searchParams.append('scope', 'url:GET|/api/v1/users/:user_id/todo url:GET|/api/v1/planner/items url:GET|/api/v1/courses url:PUT|/api/v1/planner_notes/:id');

        // Redirect to Canvas for OAuth (full page redirect, not popup)
        window.location.href = authUrl.toString();

        // Return false for now, will complete on callback
        return false;
    } catch (error) {
        logger.error('Login error:', error);
        return false;
    }
}

async function exchangeCodeForToken({ canvasBaseUrl, canvasClientId, canvasRedirectUri, code, codeVerifier }) {
    try {
        const tokenUrl = `${canvasBaseUrl}/login/oauth2/token`;
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                // eslint-disable-next-line camelcase
                grant_type: 'authorization_code',
                // eslint-disable-next-line camelcase
                client_id: canvasClientId,
                // eslint-disable-next-line camelcase
                redirect_uri: canvasRedirectUri,
                code: code,
                // eslint-disable-next-line camelcase
                code_verifier: codeVerifier
            })
        });

        if (!response.ok) {
            logger.error('Token exchange failed:', response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        logger.error('Token exchange error:', error);
        return null;
    }
}

export async function logout() {
    await idbSet(lastLoginKey, {});
    await idbSet('canvas-code-verifier', null);
    await idbSet('canvas-oauth-state', null);
    window.postMessage({
        sourceId: messageSourceId,
        sourceInstanceId: instanceId,
        type: 'logout'
    }, '*');
}

export async function getAccessToken({ canvasBaseUrl, canvasClientId, canvasRedirectUri, tryExisting = false }) {
    const loginData = await idbGet(lastLoginKey);
    if (!loginData || !loginData.accessToken) {
        return null;
    }

    // Check if token is expired
    if (loginData.expiresAt && Date.now() >= loginData.expiresAt - 60000) {
        // Token expired or expiring soon, try to refresh
        if (loginData.refreshToken) {
            const newToken = await refreshAccessToken({
                canvasBaseUrl,
                canvasClientId,
                refreshToken: loginData.refreshToken
            });
           if (newToken) {
                return newToken;
            }
        }
        return null;
    }

    return loginData.accessToken;
}

async function refreshAccessToken({ canvasBaseUrl, canvasClientId, refreshToken }) {
    try {
        const tokenUrl = `${canvasBaseUrl}/login/oauth2/token`;
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                // eslint-disable-next-line camelcase
                grant_type: 'refresh_token',
                // eslint-disable-next-line camelcase
                client_id: canvasClientId,
                // eslint-disable-next-line camelcase
                refresh_token: refreshToken
            })
        });

        if (!response.ok) {
            logger.error('Token refresh failed:', response.status);
            return null;
        }

        const tokenResponse = await response.json();

        await idbSet(lastLoginKey, {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token || refreshToken,
            expiresAt: Date.now() + (tokenResponse.expires_in * 1000)
        });

        return tokenResponse.access_token;
    } catch (error) {
        logger.error('Token refresh error:', error);
        return null;
    }
}

export function initializeAuthEvents({ setState }) {
    function onCanvasAuthEvent(event) {
        const { data, source } = event;
        if (source === window) {
            const { sourceId, sourceInstanceId, type } = data;
            if (sourceId === messageSourceId && sourceInstanceId !== instanceId) {
                if (type === 'login') {
                    setState('event-login');
                } else if (type === 'logout') {
                    setState('event-logout');
                }
            }
        }
    }

    window.addEventListener('message', onCanvasAuthEvent);
}

export async function checkExistingAuth() {
    const loginData = await idbGet(lastLoginKey);
    return Boolean(loginData && loginData.accessToken && Date.now() < loginData.expiresAt);
}