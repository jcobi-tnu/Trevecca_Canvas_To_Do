// Canvas Authentication Context Provider

import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useCache, useCardInfo } from '@ellucian/experience-extension-utils';
import { Context } from '../../context-hooks/auth-context-hooks';
import {
    login,
    logout,
    getAccessToken,
    initializeAuthEvents,
    checkExistingAuth
} from '../util/auth';
import log from 'loglevel';

const logger = log.getLogger('Canvas');

export function CanvasAuthProvider({ children }) {
    const { getItem: cacheGetItem, storeItem: cacheStoreItem } = useCache();
    const { configuration: { canvasBaseUrl, canvasClientId } } = useCardInfo();

    // Redirect URI is always the current Experience dashboard URL
    const canvasRedirectUri = `${window.location.origin}${window.location.pathname}`;

    const [accessToken, setAccessToken] = useState(null);
    const [error, setError] = useState(false);
    const [loggedIn, setLoggedIn] = useState(false);
    const [state, setState] = useState('initialize');

    // Initialize auth events
    useEffect(() => {
        initializeAuthEvents({ setState });
    }, []);

    // Check for existing authentication on mount
    useEffect(() => {
        if (state === 'initialize') {
            (async () => {
                // First check if we're handling an OAuth callback
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('code') && urlParams.get('state')) {
                    // We're returning from Canvas OAuth, trigger login completion
                    logger.debug('Detected OAuth callback, completing login');
                    setState('do-login');
                    return;
                }

                // Otherwise check for existing auth
                const hasAuth = await checkExistingAuth();
                if (hasAuth) {
                    const token = await getAccessToken({
                        canvasBaseUrl,
                        canvasClientId,
                        canvasRedirectUri,
                        tryExisting: true
                    });
                    if (token) {
                        setAccessToken(token);
                        setLoggedIn(true);
                    }
                }
                setState('ready');
            })();
        }
    }, [state, canvasBaseUrl, canvasClientId, canvasRedirectUri]);

    // Handle state changes
    useEffect(() => {
        switch (state) {
            case 'do-login':
                (async () => {
                    try {
                        const success = await login({
                            canvasBaseUrl,
                            canvasClientId,
                            canvasRedirectUri,
                            cacheGetItem,
                            cacheStoreItem
                        });
                        if (success) {
                            const token = await getAccessToken({
                                canvasBaseUrl,
                                canvasClientId,
                                canvasRedirectUri
                            });
                            if (token) {
                                setAccessToken(token);
                                setLoggedIn(true);
                            }
                        }
                        setState('ready');
                    } catch (err) {
                        logger.error('Login failed:', err);
                        setError(true);
                        setState('ready');
                    }
                })();
                break;

            case 'do-logout':
                (async () => {
                    await logout();
                    setAccessToken(null);
                    setLoggedIn(false);
                    setState('ready');
                })();
                break;

            case 'event-login':
                (async () => {
                    const token = await getAccessToken({
                        canvasBaseUrl,
                        canvasClientId,
                        canvasRedirectUri
                    });
                    if (token) {
                        setAccessToken(token);
                        setLoggedIn(true);
                    }
                    setState('ready');
                })();
                break;

            case 'event-logout':
                setAccessToken(null);
                setLoggedIn(false);
                setState('ready');
                break;

            default:
                break;
        }
    }, [state, canvasBaseUrl, canvasClientId, canvasRedirectUri, cacheGetItem, cacheStoreItem]);

    const contextValue = useMemo(() => ({
        accessToken,
        canvasBaseUrl,
        error,
        login: () => setState('do-login'),
        logout: () => setState('do-logout'),
        loggedIn,
        setLoggedIn,
        state: state === 'ready' || state === 'do-logout' ? 'ready' : 'not-ready',
        getAccessToken: () => getAccessToken({
            canvasBaseUrl,
            canvasClientId,
            canvasRedirectUri
        })
    }), [accessToken, canvasBaseUrl, error, loggedIn, state, canvasClientId, canvasRedirectUri]);

    useEffect(() => {
        logger.debug('CanvasAuthProvider mounted');
        return () => {
            logger.debug('CanvasAuthProvider unmounted');
        };
    }, []);

    return (
        <Context.Provider value={contextValue}>
            {children}
        </Context.Provider>
    );
}

CanvasAuthProvider.propTypes = {
    children: PropTypes.node.isRequired
};