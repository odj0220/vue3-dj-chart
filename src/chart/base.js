import * as dc from 'dc';

export class Base {
    constructor() {
        Object.keys(dc).forEach(key => {
            this[key] = dc[key];
        });
    }
}
