
const _subscribers = new Map();

const subscribe = (eventName, callback) => {
    if (!_subscribers.has(eventName)) {
        _subscribers.set(eventName, []);
    }
    _subscribers.get(eventName).push(callback);
    return ()=> {
        _subscribers.get(eventName).splice( _subscribers.get(eventName).indexOf(callback), 1);
    }
}

const emit = (eventName, eventValue) => {
    console.log(`Emit event {${eventName},${eventValue}}`);
    if (!_subscribers.has(eventName)) {
        return;
    }
    for (let callback of _subscribers.get(eventName)) {
        callback(eventValue);
    }
}

export {
    subscribe,
    emit
}