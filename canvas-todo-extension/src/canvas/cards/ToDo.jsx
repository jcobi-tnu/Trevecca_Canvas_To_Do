// Canvas To Do Card Component

import React from 'react';
import { withIntl } from '../../components/ReactIntProviderWrapper';
import { CanvasCardProvider } from '../context-providers/canvas-card-context-provider';
import { CanvasAuthProvider } from '../context-providers/canvas-auth-context-provider';
import { CanvasToDoProvider } from '../context-providers/canvas-todo-context-provider';
import ToDo from '../../components/ToDo';
import { initializeLogging } from '../../util/log-level';

initializeLogging('Canvas');

function CanvasToDoCard(props) {
    return (
        <CanvasCardProvider {...props}>
            <CanvasAuthProvider>
                <CanvasToDoProvider>
                    <ToDo />
                </CanvasToDoProvider>
            </CanvasAuthProvider>
        </CanvasCardProvider>
    );
}

export default withIntl(CanvasToDoCard);