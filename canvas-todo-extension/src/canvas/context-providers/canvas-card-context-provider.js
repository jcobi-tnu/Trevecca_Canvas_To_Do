// Canvas Card Context Provider

import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Context } from '../../context-hooks/card-context-hooks';
import buttonImage from '../images/canvas-logo.svg';
import log from 'loglevel';

const logger = log.getLogger('Canvas');

export function CanvasCardProvider({ children, intl }) {
    const contextValue = useMemo(() => {
        return {
            intl,
            components: {
                buttonImage,
                noEmail: {
                    titleId: 'canvas.noEmailTitle',
                    messageId: 'canvas.noEmailMessage'
                },
                noFiles: {
                    titleId: 'canvas.noFilesTitle',
                    messageId: 'canvas.noFilesMessage'
                },
                noTasks: {
                    titleId: 'canvas.noTasksTitle',
                    messageId: 'canvas.noTasksMessage'
                },
                noActiveTasks: {
                    titleId: 'canvas.noActiveTasksTitle',
                    messageId: 'canvas.noActiveTasksMessage'
                }
            }
        };
    }, [intl]);

    useEffect(() => {
        logger.debug('CanvasCardProvider mounted');
        return () => {
            logger.debug('CanvasCardProvider unmounted');
        };
    }, []);

    return (
        <Context.Provider value={contextValue}>
            {children}
        </Context.Provider>
    );
}

CanvasCardProvider.propTypes = {
    children: PropTypes.node.isRequired,
    intl: PropTypes.object.isRequired
};