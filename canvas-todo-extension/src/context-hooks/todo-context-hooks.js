import { createContext, useContext } from 'react';

export const ToDoContext = createContext({
    state: 'load',
    tasks: [],
    error: false
});

export const useToDo = () => useContext(ToDoContext);