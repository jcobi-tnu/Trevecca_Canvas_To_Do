// Canvas To Do Context Provider

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import log from 'loglevel';
import { useAuth } from '../../context-hooks/auth-context-hooks';
import { ToDoContext } from '../../context-hooks/todo-context-hooks';

const logger = log.getLogger('Canvas');
const refreshInterval = 60000;
// 60 seconds

function sortTasks(a, b) {
    // Sort by due date (nulls last), then by importance
    const aDue = a.due ? new Date(a.due).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.due ? new Date(b.due).getTime() : Number.POSITIVE_INFINITY;

    if (aDue !== bDue) {
        return aDue - bDue;
    }

    // Sort by importance (high priority first)
    const impRank = (v) => (v ? 0 : 1);
    return impRank(a.important) - impRank(b.important);
}

export function CanvasToDoProvider({ children }) {
    const { accessToken, canvasBaseUrl, loggedIn, getAccessToken } = useAuth();

    const [error, setError] = useState(false);
    const [state, setState] = useState('load');
    const [tasks, setTasks] = useState([]);
    const [renderCount, setRenderCount] = useState(0);

    const fetchTasks = useCallback(async () => {
        if (!loggedIn || !accessToken) {
            return;
        }

        if (state === 'refresh' && document.hidden) {
            return;
        }

        logger.debug(`${tasks.length === 0 ? 'loading' : 'refreshing'} Canvas to-do items`);

        try {
            // Get fresh token
            const token = await getAccessToken();
            if (!token) {
                setError(true);
                setState('loaded');
                return;
            }

            // Fetch to-do items
            const todoResponse = await fetch(`${canvasBaseUrl}/api/v1/users/self/todo`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!todoResponse.ok) {
                throw new Error(`Canvas API error: ${todoResponse.status}`);
            }

            const todoItems = await todoResponse.json();

            // Fetch planner items
            const plannerResponse = await fetch(`${canvasBaseUrl}/api/v1/planner/items`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            let plannerItems = [];
            if (plannerResponse.ok) {
                plannerItems = await plannerResponse.json();
            }

            // Combine and format tasks
            const allTasks = [];

            // Process to-do items (assignments, quizzes, discussions)
            if (Array.isArray(todoItems)) {
                todoItems.forEach(item => {
                    const task = {
                        id: `todo-${item.assignment?.id || item.id}`,
                        title: item.assignment?.name || item.title || 'Untitled',
                        type: item.type || 'assignment',
                        due: item.assignment?.due_at || null,
                        courseName: item.context_name || item.course_name || '',
                        status: item.assignment?.submission?.workflow_state === 'submitted' ? 'completed' : 'notStarted',
                        important: item.assignment?.important || false,
                        link: item.html_url || item.assignment?.html_url || null,
                        points: item.assignment?.points_possible || null,
                        submissionTypes: item.assignment?.submission_types || [],
                        completed: item.assignment?.submission?.submitted_at || null,
                        plannable: false
                    };
                    allTasks.push(task);
                });
            }

            // Process planner items
            if (Array.isArray(plannerItems)) {
                plannerItems.forEach(item => {
                    if (item.plannable_type === 'planner_note') {
                        const task = {
                            id: `planner-${item.plannable_id}`,
                            title: item.plannable?.title || 'Untitled',
                            type: 'planner_note',
                            due: item.plannable_date || null,
                            courseName: item.context_name || 'Personal',
                            status: item.planner_override?.marked_complete ? 'completed' : 'notStarted',
                            important: false,
                            link: null,
                            points: null,
                            submissionTypes: [],
                            completed: item.planner_override?.marked_complete ? item.planner_override.updated_at : null,
                            plannable: true,
                            plannableId: item.plannable_id
                        };
                        allTasks.push(task);
                    }
                });
            }

            // Sort and limit to 20 items
            const sortedTasks = allTasks.sort(sortTasks).slice(0, 20);

            setTasks(sortedTasks);
            setError(false);
            setState('loaded');
            setRenderCount(c => c + 1);
        } catch (e) {
            logger.error('Error loading Canvas to-do items:', e);
            setError(true);
            setState('loaded');
            setRenderCount(c => c + 1);
        }
    }, [accessToken, canvasBaseUrl, loggedIn, state, tasks.length, getAccessToken]);

    const toggleComplete = useCallback(async (task) => {
        const currentlyCompleted = task.status === 'completed';
        const nextStatus = currentlyCompleted ? 'notStarted' : 'completed';

        // Optimistic update
        setTasks(prev =>
            prev.map(t => (t.id === task.id ? { ...t, status: nextStatus } : t))
        );

        try {
            const token = await getAccessToken();
            if (!token) {
                throw new Error('No access token');
            }

            if (task.plannable && task.plannableId) {
                // Update planner item
                const response = await fetch(
                    `${canvasBaseUrl}/api/v1/planner_notes/${task.plannableId}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            // eslint-disable-next-line camelcase
                            marked_complete: !currentlyCompleted
                        })
                    }
                );

                if (!response.ok) {
                    throw new Error(`Failed to update planner item: ${response.status}`);
                }
            } else {
                // For assignments, we can mark as done in planner override
                logger.warn('Cannot mark assignment as complete via API - user must submit');
                // Revert the optimistic update for assignments
                setTasks(prev =>
                    prev.map(t => (t.id === task.id ? { ...t, status: task.status } : t))
                );
            }

            // Refresh to get server truth
            setState('refresh');
        } catch (e) {
            logger.error('Error updating Canvas item:', e);
            // Revert on failure
            setTasks(prev =>
                prev.map(t => (t.id === task.id ? { ...t, status: task.status } : t))
            );
            setError(true);
        }
    }, [canvasBaseUrl, getAccessToken]);

    // Initial load and refresh
    useEffect(() => {
        if (loggedIn && (state === 'load' || state === 'refresh')) {
            fetchTasks();
        }

        if (!loggedIn && state === 'loaded') {
            setTasks([]);
            setState('load');
        }
    }, [loggedIn, state, fetchTasks]);

    // Auto-refresh interval
    useEffect(() => {
        let timerId;

        const startInterval = () => {
            stopInterval();
            if (!document.hidden) {
                timerId = setInterval(() => setState('refresh'), refreshInterval);
            }
        };

        const stopInterval = () => {
            if (timerId) {
                clearInterval(timerId);
                timerId = undefined;
            }
        };

        const onVisibilityChange = () => {
            logger.debug('Canvas To Do visibility changed');
            if (document.hidden) {
                stopInterval();
            } else {
                setState(s => (s === 'loaded' ? 'refresh' : s));
                startInterval();
            }
        };

        if (loggedIn) {
            document.addEventListener('visibilitychange', onVisibilityChange);
            startInterval();
        }

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            stopInterval();
        };
    }, [loggedIn]);

    const contextValue = useMemo(
        () => ({
            error,
            tasks,
            refresh: () => setState('refresh'),
            toggleComplete,
            state
        }),
        [error, tasks, state, toggleComplete, renderCount]
    );

    useEffect(() => {
        logger.debug('CanvasToDoProvider mounted');
        return () => logger.debug('CanvasToDoProvider unmounted');
    }, []);

    return <ToDoContext.Provider value={contextValue}>{children}</ToDoContext.Provider>;
}

CanvasToDoProvider.propTypes = {
    children: PropTypes.node.isRequired
};