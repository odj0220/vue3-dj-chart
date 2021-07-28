import * as d3 from 'd3';

export class AxisOption {
    axisLabel;
    color;
    domain;
    hide;
    series;
    errorBar;
    type;
    size;
    tickFormat;
    ticks;
    renderArea;
    smooth;
    dashStyle;
    lineWidth;

    constructor(fields) {
        const fieldList = ['axisLabel', 'color', 'domain', 'hide', 'series', 'errorBar', 'type', 'size', 'tickFormat',
            'ticks', 'renderArea', 'smooth', 'dashStyle', 'lineWidth'];
        fieldList.forEach(key => {
            if (fields[key] !== undefined) {
                this[key] = fields[key];
            }
        });
    }

    setDomain(data) {
        this.domain = [d3.min(data, d => d.value), d3.max(data, d => d.value)];
    }

    setAxisLabel(axisLabel) {
        this.axisLabel = axisLabel;
    }
}
