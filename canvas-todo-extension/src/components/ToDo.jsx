// Canvas To Do Display Component

import React, { useEffect, useMemo, useState } from 'react';
import { useIntl as useCardIntl } from '../context-hooks/card-context-hooks';
import { useAuth } from '../context-hooks/auth-context-hooks';
import { useExtensionControl, useUserInfo } from '@ellucian/experience-extension-utils';
import PropTypes from 'prop-types';
import { withStyles } from '@ellucian/react-design-system/core/styles';
import {
    colorBrandNeutral250,
    colorBrandNeutral300,
    fontWeightNormal,
    spacing30,
    spacing40
} from '@ellucian/react-design-system/core/styles/tokens';
import {
    Checkbox,
    Illustration,
    IMAGES,
    Typography,
    Divider,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Chip
} from '@ellucian/react-design-system/core';
import { Icon } from '@ellucian/ds-icons/lib';
import CanvasSignInButton from './CanvasSignInButton';
import CanvasSignOutButton from './CanvasSignOutButton';
import { useToDo } from '../context-hooks/todo-context-hooks';

const customId = 'ToDoCard';

const styles = () => ({
    card: {
        flex: '1 0 auto',
        width: '100%',
        display: 'flex',
        padding: `0 ${spacing40} ${spacing40} ${spacing40}`,
        flexFlow: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        '& > *': {
            marginBottom: spacing40
        }
    },
    topBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingTop: spacing40
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        '& :first-child': {
            paddingTop: '0px'
        },
        '& hr:last-of-type': {
            display: 'none'
        }
    },
    row: {
        display: 'flex',
        alignItems: 'flex-start',
        paddingTop: spacing30,
        paddingBottom: spacing30,
        paddingLeft: spacing30,
        paddingRight: spacing30,
        '&:hover': {
            backgroundColor: colorBrandNeutral250
        }
    },
    noWrap: {
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis'
    },
    fontWeightNormal: {
        fontWeight: fontWeightNormal
    },
    divider: {
        marginTop: '0px',
        marginBottom: '0px',
        backgroundColor: colorBrandNeutral300
    },
    logoutBox: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing40,
        marginBottom: spacing40
    },
    refreshButton: {
        marginLeft: spacing30
    },
    taskMeta: {
        display: 'flex',
        gap: spacing30,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: '4px'
    },
    chip: {
        height: '20px',
        fontSize: '0.75rem'
    }
});

function ToDo({ classes }) {
    const { intl, components } = useCardIntl();
    const { setErrorMessage, setLoadingStatus } = useExtensionControl();
    const { locale } = useUserInfo();
    const { error: authError, login, loggedIn, logout, state: authState } = useAuth();
    const { tasks, state, error: todoError, refresh, toggleComplete } = useToDo();

    const [showCompleted, setShowCompleted] = useState(false);
    const [displayState, setDisplayState] = useState('loading');

    const isLoading = state === 'load' || state === 'refresh';

    const formatter = useMemo(
        () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
        [locale]
    );

    const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);

    const visible = useMemo(
        () => (showCompleted ? safeTasks : safeTasks.filter(t => t?.status !== 'completed')),
        [safeTasks, showCompleted]
    );

    useEffect(() => {
        if (authError || todoError) {
            setErrorMessage({
                headerMessage: intl.formatMessage({ id: 'error.contentNotAvailable' }),
                textMessage: intl.formatMessage({ id: 'error.contactYourAdministrator' }),
                iconName: 'warning'
            });
        } else if (loggedIn === false && authState === 'ready') {
            setDisplayState('loggedOut');
        } else if (state === 'load') {
            setDisplayState('loading');
        } else if ((state === 'loaded' || state === 'refresh') && loggedIn) {
            setDisplayState('loaded');
        } else if (state && state.error) {
            setDisplayState('error');
        }
    }, [authError, todoError, loggedIn, authState, state, intl, setErrorMessage]);

    useEffect(() => {
        setLoadingStatus(displayState === 'loading');
    }, [displayState, setLoadingStatus]);

    // --- Different UI states ---
    if (displayState === 'loggedOut') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: spacing40 }}>
                <Illustration name={IMAGES.ID_BADGE} />
                <Typography variant="h3" component="div" style={{ margin: '12px 0' }}>
                    {intl.formatMessage({ id: 'canvas.permissionsRequested' })}
                </Typography>
                <Typography variant="body2" component="div" style={{ marginBottom: spacing30, textAlign: 'center' }}>
                    Sign in to view your Canvas assignments and to-do items
                </Typography>
                <CanvasSignInButton onClick={login} />
            </div>
        );
    }

    if ((authError || todoError) && !isLoading) {
        return (
            <div style={{ padding: spacing40 }}>
                <Typography variant="body2">
                    {intl.formatMessage({ id: 'common.error' })}
                </Typography>
                <div style={{ marginTop: spacing30 }}>
                    <IconButton
                        color="gray"
                        id={`${customId}_RetryButton`}
                        onClick={refresh}
                        aria-label={intl.formatMessage({ id: 'common.retry' })}
                        disabled={isLoading}
                    >
                        <Icon name="refresh" />
                    </IconButton>
                </div>
            </div>
        );
    }

    if (displayState === 'loading') {
        return (
            <div style={{ padding: spacing40 }}>
                <Typography variant="body2">
                    {intl.formatMessage({ id: 'common.loading' })}
                </Typography>
            </div>
        );
    }

    const emptyMsg = showCompleted ? components?.noTasks || {} : components?.noActiveTasks || {};

    if (displayState === 'loaded' && visible.length === 0) {
        return (
            <div className={classes.card}>
                <div className={classes.topBar}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing30 }}>
                        <Checkbox
                            checked={showCompleted}
                            onChange={e => setShowCompleted(e.target?.checked ?? false)}
                        />
                        <Typography variant="body2">
                            {intl.formatMessage({ id: 'canvas.todo.showCompleted' })}
                        </Typography>
                    </div>
                    <IconButton
                        color="gray"
                        id={`${customId}_RefreshButton`}
                        onClick={refresh}
                        aria-label={intl.formatMessage({ id: 'common.refresh' })}
                        disabled={isLoading}
                        className={classes.refreshButton}
                    >
                        <Icon name="refresh" />
                    </IconButton>
                </div>

                <div style={{ textAlign: 'center', padding: spacing40 }}>
                    <Illustration name={IMAGES.CHECKLIST} />
                    <Typography variant="h4" component="div" style={{ marginTop: spacing30 }}>
                        {intl.formatMessage({ id: emptyMsg.titleId || 'canvas.noTasksTitle' })}
                    </Typography>
                    <Typography variant="body2" style={{ opacity: 0.75, marginTop: spacing30 }}>
                        {intl.formatMessage({ id: emptyMsg.messageId || 'canvas.noTasksMessage' })}
                    </Typography>
                </div>

                <Divider className={classes.divider} />
                <div className={classes.logoutBox}>
                    <CanvasSignOutButton onClick={logout} />
                </div>
            </div>
        );
    }

    // --- Main UI ---
    return (
        <div className={classes.card}>
            <div className={classes.topBar}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing30 }}>
                    <Checkbox
                        checked={showCompleted}
                        onChange={e => setShowCompleted(e.target?.checked ?? false)}
                    />
                    <Typography variant="body2">
                        {intl.formatMessage({ id: 'canvas.todo.showCompleted' })}
                    </Typography>
                </div>
                <IconButton
                    color="gray"
                    id={`${customId}_RefreshButton`}
                    onClick={refresh}
                    aria-label={intl.formatMessage({ id: 'common.refresh' })}
                    disabled={isLoading}
                    className={classes.refreshButton}
                >
                    <Icon name="refresh" />
                </IconButton>
            </div>

            <div className={classes.content}>
                <List dense>
                    {visible.map(t => {
                        if (!t?.id) {return null;}

                        const labelId = `canvas-todo-item-${t.id}`;
                        const primary = t.link ? (
                            <a
                                href={t.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                {t.title || 'Untitled'}
                            </a>
                        ) : (
                            t.title || 'Untitled'
                        );

                        const dueText = t.due
                            ? `${intl.formatMessage({ id: 'canvas.todo.due' })}: ${formatter.format(new Date(t.due))}`
                            : intl.formatMessage({ id: 'canvas.todo.noDue' });

                        return (
                            <React.Fragment key={t.id}>
                                <ListItem>
                                    <ListItemText
                                        id={labelId}
                                        primary={
                                            <div>
                                                <Typography variant="body2" style={{ fontWeight: 500 }}>
                                                    {primary}
                                                </Typography>
                                                <div className={classes.taskMeta}>
                                                    <Typography variant="caption" color="textSecondary">
                                                        {dueText}
                                                    </Typography>
                                                    {t.courseName && (
                                                        <Chip
                                                            label={t.courseName}
                                                            size="small"
                                                            className={classes.chip}
                                                        />
                                                    )}
                                                    {t.points && (
                                                        <Typography variant="caption" color="textSecondary">
                                                            {`${t.points} ${intl.formatMessage({ id: 'canvas.todo.points' })}`}
                                                        </Typography>
                                                    )}
                                                </div>
                                            </div>
                                        }
                                    />
                                    {t.plannable && (
                                        <Checkbox
                                            checked={t.status === 'completed'}
                                            onChange={() => toggleComplete(t)}
                                            inputProps={{ 'aria-labelledby': labelId }}
                                        />
                                    )}
                                </ListItem>
                                <Divider className={classes.divider} />
                            </React.Fragment>
                        );
                    })}
                </List>
            </div>

            <div className={classes.logoutBox}>
                <CanvasSignOutButton onClick={logout} />
            </div>
        </div>
    );
}

ToDo.propTypes = {
    classes: PropTypes.object.isRequired
};

export default withStyles(styles)(ToDo);