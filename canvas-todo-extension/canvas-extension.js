
module.exports = {
    name: 'Canvas To Do',
    publisher: 'Trevecca Nazarene University',
    configuration: {
        client: [{
            key: 'canvasBaseUrl',
            label: 'Canvas Base URL',
            type: 'url',
            required: true
        }, {
            key: 'canvasClientId',
            label: 'Canvas Developer Key Client ID',
            type: 'text',
            required: true
        }]
    },
    cards: [{
        type: 'CanvasToDoCard',
        source: './src/canvas/cards/ToDo',
        title: 'Canvas To Do',
        displayCardType: 'Canvas To Do',
        description: 'This card displays your Canvas assignments and to-do items'
    }]
};