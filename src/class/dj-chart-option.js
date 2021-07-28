import * as _moment from 'moment';
import * as d3 from 'd3';
import * as _ from 'lodash';
import {AxisOption} from './axis-option';
const moment = _moment;

const DjChartType = {
    PIE_CHART: 'pieChart',
    CLOUD_CHART: 'cloudChart',
    COMPOSITE: 'composite',
    HEATMAP: 'heatmap',
    DC_CHART: 'dcChart',
    STACKED_BAR: 'stackedBar'
}

/*
const AxisOptionType = {
    DATE: 'date', // x축이 date 타입일때 지정
    LINEAR: 'linear', // x축이 number 속성으로 range 표기가 필요할때 지정, domain 옵션 필요
    ORDINAL: 'ordinal' // x축을 있는 그대로 표기할때 사용
}


interface BasicAxisOption {
    axisLabel: string; // x축에 표기될 label 설정
    domain: Array<number>; // 제외 가능하며 제외시 value 의 min, max
    prevTickText: string; // tick의 앞쪽에 나타날 문자를 지정 tickFormat 지정시 tickFormat 우선
    nextTickText: string; // tick의 뒤쪽에 나타날 문자를 지정 tickFormat 지정시 tickFormat 우선
    tickFormat: (value: any, index?: any, size?: any) => string; // tick 표기를 변경하고 싶을때 사용 해당옵션 적용시 최우선으로 적용
    ticks: number; // x축에 몇개의 tick을 표기할지 설정
}

interface XAxisOption extends BasicAxisOption {
    type: AxisOptionType;
    dateFormat: string; // type이 date 일때 필요 하며 data의 date format 형식 ex) YYYYMMDD
    dateTickFormat: string; // type이 date 일때 필요 chart의 x축에 표기될 형식
}

interface YAxisOption extends BasicAxisOption {
    keys: Array<string>; // data의 key를 group 하여 축에 표기 ["itemLarge/top", "itemLarge/bottom", "itemLarge/sportswear"]
    size: number; // seriesType 에 symbole이 포함되어 있을때 symbole의 크기
    divideFactor: number;
}

interface ChartOption {
    data?: Array<any>;
    type?: DjChartType;
    onClick?: (data: any, event: any) => void;
    onClickEvent?: any;
    onFilterChanged?: (chart: any) => void;
    legends?: { [key: string]: string; };
    colors?: { [key: string]: string; };
    seriesTypes?: { [key: string]: string; };
    yAxisOptions?: Array<YAxisOption>;
    yAxisLabel?: string;
    xAxisOption?: XAxisOption;
    xAxisLabel?: string;
    dimension?: any;
    group?: any;
    tooltip?: any;
    seriesOptions?:  {
        [key: string]: {
        renderArea: boolean; // default: false
        smooth: boolean; // default: false
        lineWidth: number; // default: 1.5, 선 굵기
        dashStyle: string; // default: null
        /!*
        * (선, 공백) repeat
        * (5, 3, 2, 3) 이런식으로 가능
        *!/
    };
};
    margins?: any;
    highlight?: Array<{
        domain: Array<any>; // [min, max]
        color: string; // default: blue
        label: string; // default: '',  highlight label
        opacity: number; // (0~1, default: .3): 투명도
    }>;
    elasticLeftMargin: boolean;
    elasticRightMargin: boolean;
    innerRadius?: number;
    externalLabels?: number;
    slicesCap?: number;
    slicesPercent?: number;
    radius?: number;
    padding?: any;
}
*/

export class DjChartOption {
    data;
    type;
    dcChart;
    legends;
    colors;
    slicesCap;
    slicesPercent;
    radius;
    externalLabels;
    innerRadius;
    padding;
    seriesTypes;
    seriesOptions;
    yAxisOptions;
    yAxisLabel;
    xAxisOption;
    xAxisLabel;
    onClick;
    onFilterChanged;
    onClickEvent;
    dimension;
    group;
    tooltip;
    highlight;
    elasticLeftMargin = true;
    elasticRightMargin = true;
    chart;
    gap;
    order;
    height;
    width;
    margins;
    axisOption;
    filters;
    _legendObj;

    constructor(chartOption) {
        console.log(chartOption);
        if (chartOption) {
            const defaultOption = {
                cloudChart: ['type', 'onClick', 'onClickEvent', 'onFilterChanged', 'legends', 'colors', 'padding', 'dimension', 'group', 'tooltip'],
                pieChart: ['type', 'onClick', 'onClickEvent', 'onFilterChanged', 'legends', 'colors', 'slicesCap', 'slicesPercent', 'radius',
                    'externalLabels', 'innerRadius', 'dimension', 'group', 'tooltip'],
                composite: ['type', 'onClick', 'onClickEvent', 'onFilterChanged', 'legends', 'colors', 'seriesTypes', 'yAxisOptions', 'yAxisLabel',
                    'xAxisOption', 'xAxisLabel', 'dimension', 'group', 'tooltip', 'seriesOptions', 'margins', 'highlight', 'elasticLeftMargin',
                    'elasticRightMargin']
            };

            if (chartOption && chartOption.type) {
                if (defaultOption[chartOption.type]) {
                    defaultOption[chartOption.type].forEach(field => {
                        if (chartOption[field] !== undefined) {
                            this[field] = chartOption[field];
                        }
                    })
                }
                if (chartOption.type === DjChartType.DC_CHART) {
                    Object.keys(chartOption).forEach(key => {
                        this[key] = chartOption[key];
                    });
                }
                if (chartOption.data) {
                    this.setData(chartOption.data);
                }
            }
        }
    }

    setData(data) {
        if (this.type === DjChartType.COMPOSITE && this.xAxisOption && this.xAxisOption.type === 'date') {
            this.data = data;
            this.data.forEach( d => {
                d.key[1] = moment(d.key[1], this.xAxisOption.dateFormat).toDate();
            });
        } else {
            this.data = data;
        }
    }

    setAxisOption() {
        if (this.yAxisOptions) {
            let data;
            const seriesTypes = this.seriesTypes || {};
            const axisOption = [];
            if (this.data !== undefined) {
                data = this.data;
            } else {
                data = this.group().all();
            }

            this.yAxisOptions.forEach(axis => {
                const filterData = data.filter( d => {
                    if (axis.keys.indexOf(d.key[0]) > -1) {
                        return true;
                    }
                });

                const max = d3.max(filterData, d => d.value);
                const min = d3.min(filterData, d => d.value) || 0;

                axis.keys.forEach((key, i) => {
                    const _option = {
                        axisLabel: axis.axisLabel,
                        domain: axis.domain ? axis.domain : [min, max],
                        hide: i,
                        series: key,
                        type: seriesTypes[key] || 'line',
                        size: axis.size || 6,
                    };

                    if (this.seriesOptions && this.seriesOptions[key]) {
                        Object.keys(this.seriesOptions[key]).forEach(op => {
                            _option[op] = this.seriesOptions[key][op];
                        });
                    }

                    if (this.colors && this.colors[key]) {
                        _option['color'] = this.colors[key];
                    }
                    if (axis.prevTickText || axis.nextTickText) {
                        _option['tickFormat'] = d => {
                            let tick = '';
                            if (axis.prevTickText) {
                                tick += axis.prevTickText;
                            }
                            tick += this.commaSeparateNumber(d) || 0;
                            if (axis.nextTickText) {
                                tick += axis.nextTickText;
                            }

                            return tick;
                        };
                    }
                    if (axis.tickFormat) {
                        _option['tickFormat'] = axis.tickFormat;
                    }

                    axisOption.push(new AxisOption(_option));
                });
            });

            return this.axisOption = axisOption;
        }

        return this.axisOption = [];
    }

    getKeys() {
        const keys = this.data.map( d => {
            if (Array.isArray(d.key)) {
                return d.key[0];
            }
            return d.key;
        });
        return _.uniq(keys);
    }

    getLegends() {
        if (!this._legendObj) {
        this.setLegendObj();
    }
        return this._legendObj;
    }

    setFilters() {
        this.setLegendObj();
    }

    filterAll() {
        this.chart.filterAll();
    }

    setLegendObj() {
        this._legendObj = [];
        this.getKeys().forEach(key => {
            const legend = {
                key: key,
                name: this.legends[key] || key,
                filter: () => this.chart.filter(key),
                color: () => {
                    const defaultColor = this.chart.getColor(key);
                    return this.colors ? this.colors[key] || defaultColor : defaultColor;
                }
            };
            this._legendObj.push(legend);
        });
    }

    commaSeparateNumber (value) {
        if (!value) {
            return '';
        }
        while (/(\d+)(\d{3})/.test(value.toString())) {
            value = value.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
        }
        return value;
    }
}
