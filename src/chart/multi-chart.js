import {CoordinateGridMixin, transition, utils, filters, pluck, events, constants} from "dc";
import * as _ from 'lodash';
import * as d3 from 'd3';

export default class MultiChart extends CoordinateGridMixin {

    _gap = 2;
    MIN_BAR_WIDTH = 1;
    _centerBar = true;
    _symbol = d3.symbol();
    _click = null;
    _dashStyle;
    _defined;
    _barWidth;
    _locator;
    _annotateLocation;
    _highlightedSize = 7;
    _symbolSize = 5;
    _excludedSize = 3;
    _excludedColor = null;
    _excludedOpacity = 1.0;
    __filter;
    _emptySize = 0;
    _filtered = [];
    _existenceAccessor;
    lines;
    originalKeyAccessor;
    multiOption;
    _tooltip;

    constructor(element, option) {
        super();
        this.multiOption = option;
        this.originalKeyAccessor = this.keyAccessor();
        this.keyAccessor(d => this.originalKeyAccessor(d)[0]);
        this.valueAccessor(d => this.originalKeyAccessor(d)[1]);
        this.colorAccessor(() => this._groupName);
        this.lines = () => this;
        this._existenceAccessor = (d) => {
            return d.value ? d.value : d.y;
        };

        this._symbol.size((d, i) => {
            if (!this._existenceAccessor(d)) {
                return this._emptySize;
            } else if (this._filtered[i]) {
                return Math.pow(this._symbolSize, 2);
            } else {
                return Math.pow(this._excludedSize, 2);
            }
        });
    }

    _filter(filter) {
        if (!filter) {
            return this.__filter();
        }
        return this.__filter(filters.RangedTwoDimensionalFilter(filter));
    }

    plotData(zoomX, zoomY) {
        const chartList = [];
        let type;
        let axisLabel;
        let yAxisLabel;
        // eslint-disable-next-line no-unused-vars
        let errorBar;
        let chartOption;
        let axisWidth;
        let clipPath;
        if (this.svg()) {
            clipPath = this.svg().select('.chart-body').attr('clip-path');
        } else {
            clipPath = this.g().select('.chart-body').attr('clip-path');
        }
        this.chartBodyG().attr('clip-path', clipPath);

        this.multiOption.axisOption.forEach(v => {
            if (v.series) {
                chartList.push(v.series);
                if (this.data()[0].key[0].toString() === v.series.toString()) {
                    type = v.type;
                    axisLabel = v.axisLabel;
                }
                if (this._groupName === v.series) {
                    yAxisLabel = v.axisLabel;
                    errorBar = v.errorBar;
                    chartOption = v;
                }
            }
        });

        if (chartOption) {
            // stacks 가 있으면 stack 설정
            if (chartOption.stacks) {
                const _stacks = [];
                const sel_stack = (key => d => d.value[key]);
                chartOption.stacks.forEach(d => {
                    const layer = {group: this.group(), name: d, accessor: sel_stack};
                    _stacks.push(layer);
                });
                this.data = () => {
                    const layers = _stacks.filter(l => !l.hidden);
                    if (!layers.length) {
                        return [];
                    }
                    layers.forEach((layer, layerIdx) => {
                        layer.name = String(layer.name || layerIdx);
                        const allValues = layer.group.all().map((d, i) => {
                            return {
                                x: this.keyAccessor()(d, i),
                                y: layer.hidden ? null : sel_stack(layer.name)(d),
                                data: d,
                                layer: layer.name,
                                hidden: layer.hidden
                            };
                        });
                        layer.domainValues = allValues;
                        layer.values = allValues;
                        layer['key'] = layer.group.all()[0].key;
                    });

                    const v4data = layers[0].values.map((v, i) => {
                        const col = {x: v.x};
                        layers.forEach(layer => {
                            col[layer.name] = layer.values[i].y;
                        });
                        return col;
                    });
                    const keys = layers.map(layer => layer.name);
                    const v4result = d3.stack().keys(keys)(v4data);
                    v4result.forEach((series, i) => {
                        series.forEach((ys, j) => {
                            layers[i].values[j].y0 = ys[0];
                            layers[i].values[j].y1 = ys[1];
                        });
                    });
                    return layers;
                };
            }

            // boolean 일때 설정
            if (type === 'boolean') {
                if (!chartOption.symbol) {
                    chartOption.symbol = 'square';
                }
                if (!chartOption.symbol) {
                    chartOption.symbol = 'square';
                }
                if (!chartOption.gap) {
                    chartOption.gap = 5;
                }
                if (!chartOption.size) {
                    chartOption.size = 7;
                }
                if (!chartOption.lineWidth) {
                    chartOption.lineWidth = 1.5;
                }
            }

            const y = d3.scaleLinear().range([this.yAxisHeight(), 0]);
            const yAxis = d3.axisRight(y).ticks(10);
            if (chartOption.tickFormat) {
                yAxis.tickFormat(chartOption.tickFormat);
            }
            if (chartOption.ticks) {
                yAxis.ticks(chartOption.ticks);
            }

            // x domain 설정
            if (zoomX) {
                this.x().domain(zoomX);
            }

            // 도메인에 해당하는 데이터만 찾기기
            const data = [];
            let domain = this.x().domain();
            this.data().forEach(v => {
                const x = v.key[0];
                if (domain[0] <= x && domain[1] >= x) {
                    data.push(v);
                }
            });

            // y domain 설정
            let yDomain;
            if (zoomY) { // zoom in 일때
                domain = this._groupScale[this._groupName];
                const area = (domain[0] - domain[0]) + (domain[1] - domain[0]);

                if (type === 'boolean') {
                    y.domain([-0.5, 1.5]);
                    yAxis.ticks(2).tickFormat(d => {
                        if (!d) {
                            return 'FAIL';
                        } else if (d === 1) {
                            return 'PASS';
                        } else {
                            return null;
                        }
                    });
                } else if (axisLabel === 'EVENT') {
                    y.domain(domain);
                } else {
                    yDomain = [
                        (area / zoomY[0]) + domain[0] + (chartOption.gap ? -chartOption.gap : 0),
                        (area / zoomY[1]) + domain[0] + (chartOption.gap ? chartOption.gap : 0)
                    ];
                    y.domain([
                        (area / zoomY[0]) + domain[0] + (chartOption.gap ? -chartOption.gap : 0),
                        (area / zoomY[1]) + domain[0] + (chartOption.gap ? chartOption.gap : 0)
                    ]);
                }
            } else if (!zoomX && !zoomY && this.yOriginalDomain && this.yOriginalDomain()) {
                y.domain(this.yOriginalDomain());
            } else { // zoom out 일때
                if (this.multiOption.axisOption) {
                    this.multiOption.axisOption.forEach(v => {
                        if (this._groupName === v.series) {
                            domain = v.domain;
                        }
                    });
                }
                if (type === 'boolean') {
                    y.domain([-0.5, 1.5]);
                    yAxis.ticks(2).tickFormat(d => {
                        if (!d) {
                            return 'FAIL';
                        } else if (d === 1) {
                            return 'PASS';
                        } else {
                            return null;
                        }
                    });
                } else if (axisLabel === 'EVENT') {
                    y.domain(domain);
                } else if (domain) {
                    const dom = [domain[0] + (chartOption.gap ? -chartOption.gap : 0), domain[1] + (chartOption.gap ? chartOption.gap : 0)];
                    y.domain(dom);
                } else {
                    const dom = [
                        d3.min(data, d =>  typeof d.value === 'object' ? d.value.value : d.value) + (chartOption.gap ? -chartOption.gap : 0),
                        d3.max(data, d => typeof d.value === 'object' ? d.value.value : d.value) + (chartOption.gap ? chartOption.gap : 0)
                    ];
                    y.domain(dom);
                }
            }

            this._locator = d => {
                let rotate = '';
                if (chartOption.symbolRotate) {
                    rotate = ' rotate(' + chartOption.symbolRotate + ')';
                }
                let bandwidth = 0;
                if (this.x().bandwidth) {
                    bandwidth = this.x().bandwidth() / 2;
                }

                if (d.key) {
                    let check = this.y()(this.valueAccessor()(d));
                    if (isNaN(check)) {
                        check = 0;
                    }
                    return 'translate(' + (this.x()(this.keyAccessor()(d)) + bandwidth) + ',' + check + ')' + rotate;
                } else {
                    let check = y(d.y);
                    if (isNaN(check)) {
                        check = 0;
                    }
                    return 'translate(' + (this.x()(d.x) + bandwidth) + ',' + check + ')' + rotate;
                }
            };

            this._annotateLocation = d => {
                let rotate = '';
                if (chartOption.symbolRotate) {
                    rotate = ' rotate(' + chartOption.symbolRotate + ')';
                }
                if (d.key) {
                    let check = this.y()(this.valueAccessor()(d));
                    if (isNaN(check)) {
                        check = 0;
                    }
                    return 'translate(' + this.x()(this.keyAccessor()(d)) + ',' + check + ')' + rotate;
                } else {
                    let check = y(d.y);
                    if (isNaN(check)) {
                        check = 0;
                    }
                    return 'translate(' + (this.x()(d.x) - 7) + ',' + (check - 10) + ')' + rotate;
                }
            };

            if (!this._groupScale) {
                this._groupScale = {};
            }
            this._groupScale[this._groupName] = y.domain();

            // Y Axis 그리기
            let axisPadding = 0;
            for (let i = 0; i < chartList.indexOf(this._groupName); i++) {
                if (i) {
                    axisPadding += this.multiOption.axisOption[i].width ? this.multiOption.axisOption[i].width + 35 : 0;
                }
            }

            // chart 그리기
            const valAccessor = this.valueAccessor();
            let drawData = this.data();
            if (!chartOption.stacks) {
                drawData = [{
                    group: {
                        all: () => this.data()
                    },
                    name: this.data()[0].key[1].toString(),
                    values: this.data().map((d, i) => {
                        return {
                            x: this.keyAccessor()(d, i),
                            y: valAccessor(d, i),
                            z: d.value.z,
                            data: d,
                            layer: d.key[1],
                            hidden: undefined
                        };
                    })
                }];
            }

            this.drawChart(type, y, drawData, chartOption, zoomX, yDomain);

            if (!chartOption.hide) {
                const axis = chartList.indexOf(this._groupName) ? yAxis : d3.axisLeft(y).ticks(10);
                if (chartOption.tickFormat) {
                    axis.tickFormat(chartOption.tickFormat);
                }
                if (chartOption.ticks) {
                    axis.ticks(chartOption.ticks);
                }
                const axisClass = this.multiOption.axisOption.filter(d => !d.hide).map(d => d.series).indexOf(this._groupName);

                this.renderYAxisAt(axisClass, axis, this.width() - this.margins().right + axisPadding);


                axisWidth = this.renderYAxisAt(axisClass
                    , axis
                    , this.width() - this.margins().right + axisPadding) || 0;

                // label
                this.renderYAxisLabel(axisClass
                    , yAxisLabel
                    , 90
                    , this.width() - this.margins().right + axisWidth + 5 + axisPadding);
            }

            // set y right axis width
            this.multiOption.axisOption.forEach(v => {
                if (this._groupName === v.series) {
                    v.width = axisWidth;
                }
            });
        }

        if (!this.yOriginalDomain) {
            this.yOriginalDomain = () => {
                let domain;
                this.multiOption.axisOption.forEach(v => {
                    if (this._groupName === v.series) {
                        domain = v.domain;
                    }
                });
                return domain;
            };
        }
    }

    click(click) {
        if (!click) {
            return this._click;
        }
        this._click = click;
        return this;
    }

    defined(defined) {
        if (!defined) {
            return this._defined;
        }
        this._defined = defined;
        return this;
    }

    dashStyle(dashStyle) {
        if (!dashStyle) {
            return this._dashStyle;
        }
        this._dashStyle = dashStyle;
        return this;
    }

    renderYAxisLabel(axisClass, text, rotation, labelXPosition) {
        labelXPosition = labelXPosition || 0;
        if (axisClass && this.svg()) {
            let axisYLab = this.svg().selectAll('text.' + 'y-axis-label' + '.y' + axisClass + '-label');
            const labelYPosition = ((this.margins().top + this.yAxisHeight()) / 2);
            if (axisYLab.empty() && text) {
                axisYLab = d3.select(this.g()._groups[0][0].parentNode).append('text')
                    .attr('transform', 'translate(' + labelXPosition + ',' + labelYPosition + '),rotate(' + rotation + ')')
                    .attr('class', 'y-axis-label' + ' y' + axisClass + '-label')
                    .attr('text-anchor', 'middle')
                    .text(text);
            }
            if (text && axisYLab.text() !== text) {
                axisYLab.text(text);
            }
            transition(axisYLab, this.transitionDuration(), this.transitionDelay())
                .attr('transform', 'translate(' + labelXPosition + ',' + labelYPosition + '),rotate(' + rotation + ')');
        }
    }

    renderYAxisAt(axisClass, axis, position) {
        let axisYG;
        if (axisClass && this.svg()) {
            axisYG = this.svg().selectAll('g.' + 'y' + axisClass);
            if (axisYG.empty()) {
                axisYG = d3.select(this.g()._groups[0][0].parentNode).append('g')
                    .attr('class', 'axis y-axis-at ' + 'y' + axisClass)
                    .attr('transform', 'translate(' + position + ',' + this.margins().top + ')');
            }

            transition(axisYG, this.transitionDuration(), this.transitionDelay())
                .attr('transform', 'translate(' + position + ',' + this.margins().top + ')')
                .call(axis);
        } else {
            if (this.svg()) {
                axisYG = this.svg().select('g.' + 'y');
            } else {
                axisYG = d3.select(this.g()._groups[0][0].parentNode).select('g.' + 'y');
            }

            transition(axisYG, this.transitionDuration(), this.transitionDelay()).call(axis);
        }

        if (axisYG && axisYG._groups[0][0]) {
            return axisYG._groups[0][0].getBoundingClientRect().width;
        } else {
            return 0;
        }
    }

    drawChart(chart, y, data, option, zoomX, zoomY) {
        if (chart === 'lineSymbol') {
            /*--------- line Start----------*/
            const chartBody = this.chartBodyG();
            let layersList = chartBody.selectAll('g.stack-list');
            if (layersList.empty()) {
                layersList = chartBody.append('g').attr('class', 'stack-list');
            }
            const layers = layersList.selectAll('g.stack').data(data);
            const layersEnter = layers.enter().append('g').attr('class', (d, i) => 'stack ' + '_' + i);
            this.drawLine(layersEnter, layers, y, option, option.smooth);
            /*--------- line End----------*/

            /*--------- symbol Start----------*/
            const layers2 = this.chartBodyG().selectAll('path.symbol').data(data);
            layers2.enter()
                .append('g')
                .attr('class', (d, i) => {
                    return 'stack ' + '_' + i;
                });

            data.forEach(d => {
                this.renderSymbol(d, option);
            });

            // 추가된 데이터가 있으면 다시 렌더
            if (data.length !== layers.size()) {
                this.plotData();
            }
            /*--------- symbol End----------*/

            // renderArea 추가
            if (option.renderArea) {
                this.drawArea(layersEnter, layers, y, option, option.smooth ?  d3.curveMonotoneX : d3.curveCardinal.tension(1));
            }
        } else if (chart === 'smoothLine') {
            /*--------- line Start----------*/
            const chartBody = this.chartBodyG();
            let layersList = chartBody.selectAll('g.stack-list');
            if (layersList.empty()) {
                layersList = chartBody.append('g').attr('class', 'stack-list');
            }
            const layers = layersList.selectAll('g.stack').data(data);
            const layersEnter = layers.enter().append('g').attr('class', (d, i) => 'stack ' + '_' + i);
            this.drawLine(layersEnter, layers, y, option, true);
            /*--------- line End----------*/

            /*--------- symbol Start----------*/
            const layers2 = this.chartBodyG().selectAll('path.symbol').data(data);
            layers2.enter()
                .append('g')
                .attr('class', (d, i) => {
                    return 'stack ' + '_' + i;
                });

            data.forEach(d => {
                this.renderSymbol(d, option);
            });

            // 추가된 데이터가 있으면 다시 렌더
            if (data.length !== layers.size()) {
                this.plotData();
            }

            // renderArea 추가
            if (option.renderArea) {
                this.drawArea(layersEnter, layers, y, option, d3.curveMonotoneX);
            }
            /*--------- symbol End----------*/
        } else if (chart === 'line') {
            const chartBody = this.chartBodyG();
            let layersList = chartBody.selectAll('g.stack-list');
            if (layersList.empty()) {
                layersList = chartBody.append('g').attr('class', 'stack-list');
            }
            const layers = layersList.selectAll('g.stack').data(data);
            const layersEnter = layers.enter().append('g').attr('class', (d, i) => 'stack ' + '_' + i);
            this.drawLine(layersEnter, layers, y, option, option.smooth);

            // 추가된 데이터가 있으면 다시 렌더
            if (data.length !== layers.size()) {
                this.plotData();
            }

            if (option.renderArea) {
                this.drawArea(layersEnter, layers, y, option, option.smooth ?  d3.curveMonotoneX : d3.curveCardinal.tension(1));
            }
        } else if (chart === 'stepLine') {
            const chartBody = this.chartBodyG();
            let layersList = chartBody.selectAll('g.stack-list');
            if (layersList.empty()) {
                layersList = chartBody.append('g').attr('class', 'stack-list');
            }
            const layers = layersList.selectAll('g.stack').data(data);
            const layersEnter = layers.enter().append('g').attr('class', (d, i) => 'stack ' + '_' + i);
            this.stepLine(layersEnter, layers, y, option);
            if (option.renderArea) {
                this.drawArea(layersEnter, layers, y, option, d3.curveStepAfter);
            }

            // 추가된 데이터가 있으면 다시 렌더
            if (data.length !== layers.size()) {
                this.plotData();
            }
        } else if (chart === 'symbol' || chart === 'boolean') {
            if (this.chartBodyG().selectAll('path.symbol').empty()) {
                this.chartBodyG().append('path').attr('class', 'symbol');
            }
            const layers = this.chartBodyG().selectAll('path.symbol').data(data);
            layers.enter()
                .append('g')
                .attr('class', (d, i) => 'stack ' + '_' + i);

            data.forEach( d => this.renderSymbol(d, option));
        } else if (chart === 'bar') {
            const bars = this.multiOption.axisOption.filter(d => d.type === 'bar');
            const barIndex = bars.map(d => d.series).indexOf(this._groupName);
            if (this.chartBodyG().selectAll('g.stack').empty()) {
                this.chartBodyG().append('g').attr('class', 'stack _0');
            }
            const layers = this.chartBodyG().selectAll('g.stack').data(data);
            this.calculateBarWidth();
            layers.enter()
                .append('g')
                .attr('class', (d, i) => {
                    return 'stack ' + '_' + i;
                })
                .merge(layers);

            const last = layers.size() - 1;
            layers.each((d, i) => {
                const layer = d3.select(d);
                this.renderBars(layers, i, d, y, option, bars, barIndex);

                if (this.renderLabel() && last === i) {
                    this.renderLabels(layer, i, d);
                }
            });
        } else if (chart === 'thermal') {
            const xStep = option.gap, yStep = 1;
            if (zoomX && zoomY) {
                this.x().domain([zoomX[0], +zoomX[1]]);
                y.domain([zoomY[0], zoomY[1] + yStep]);
            } else {
                this.x().domain([this.multiOption.xRange[0] - (xStep / 2), +this.multiOption.xRange[1] + (xStep / 2)]);
                y.domain([option.domain[0], option.domain[1] + yStep]);
            }

            const layers = this.chartBodyG().selectAll('rect.thermal').data(data);
            layers.enter()
                .append('g')
                .attr('class', (d, i) => 'stack ' + '_' + i);

            data.forEach(d => this.renderThermal(d, option, xStep, yStep, y));
        }
    }

    barPadding(barPadding) {
        if (!barPadding) {
            return this._rangeBandPadding();
        }
        this._rangeBandPadding(barPadding);
        this._gap = undefined;
        return this;
    }

    calculateBarWidth() {
        if (this._barWidth === undefined) {
            const numberOfBars = this.xUnitCount();
            if (this.isOrdinal() && this._gap === undefined) {
                this._barWidth = Math.floor(this.x().bandwidth());
            } else if (this._gap) {
                this._barWidth = Math.floor((this.xAxisLength() - (numberOfBars - 1) * this._gap) / numberOfBars);
            } else {
                this._barWidth = Math.floor(this.xAxisLength() / (1 + this.barPadding()) / numberOfBars);
            }

            if (this._barWidth === Infinity || isNaN(this._barWidth) || this._barWidth < this.MIN_BAR_WIDTH) {
                this._barWidth = this.MIN_BAR_WIDTH;
            }
        }
    }

    drawLine(layersEnter, layers, y, option, smooth) {
        let bandwidth = 0;
        if (this.x().bandwidth) {
            bandwidth = this.x().bandwidth() / 2;
        }

        const line = d3.line()
            .x(d => this.x()(d.x) + bandwidth)
            .y(d => y ? y(d.y) : this.y()(d.y))
            .curve(smooth ? d3.curveMonotoneX : d3.curveCardinal.tension(1));

        if (this._defined) {
            line.defined(this._defined);
        }

        const path = layersEnter.append('path').attr('class', 'line').attr('stroke', option.color ? option.color : this.colors2.bind(this))
            .attr('stroke', option.color ? option.color : this.colors2.bind(this))
            .attr('d', d => this.safeD(line(d.values)))
            .attr('chartKey', d => d.key)
            .style('stroke-width', option.lineWidth + 'px');
        if (option.dashStyle) {
            path.attr('stroke-dasharray', option.dashStyle);
        }

        transition(layers.select('path.line'), this.transitionDuration(), this.transitionDelay())
            .attr('stroke', option.color ? option.color : this.colors2.bind(this))
            .attr('d', d => this.safeD(line(d.values)))
            .attr('seriesKey', d => d.values[0].data.key[0])
            .style('stroke-width', option.lineWidth + 'px');
    }

    colors2(d, i) {
        return this.getColor.call(d, d.values, i);
    }

    safeD(d) {
        return (!d || d.indexOf('NaN') >= 0) ? 'M0,0' : d;
    }

    renderSymbol(d, option) {
        const getSymbol = () => {
            if (option.symbol) {
                if (option.symbol === 'cross') {
                    return d3.symbolCross;
                } else if (option.symbol === 'diamond') {
                    return d3.symbolDiamond;
                } else if (option.symbol === 'square') {
                    return d3.symbolSquare;
                } else if (option.symbol === 'star') {
                    return d3.symbolStar;
                } else if (option.symbol === 'triangle') {
                    return d3.symbolTriangle;
                } else if (option.symbol === 'wye') {
                    return d3.symbolWye;
                } else {
                    return d3.symbolCircle;
                }
            } else {
                return d3.symbolCircle;
            }
        };

        const symbolSize = () => {
            if (option.size) {
                return option.size * option.size;
            } else {
                return 7 * 7;
            }
        };

        const color = option.colorOption ? option.colorOption : (option.color || this.getColor);

        const symbols = this.chartBodyG().selectAll('path.symbol').data(d.values);
        symbols.enter()
            .append('path').attr('class', 'symbol')
            .attr('opacity', 0)
            .attr('fill', option.color ? option.color : this.getColor)
            .attr('transform', this._locator)
            .attr('d', d3.symbol().type(getSymbol()).size(symbolSize()))
            .on('click', () => {
                if (this._click) {
                    return this._click(d);
                }
            });

        if (this.multiOption.tooltip) {
            const tooltip = this.getTooltipElem();
            symbols
                .on('mousemove', (event, data) => {
                    const pageX = event.pageX;
                    const pageY = event.pageY;
                    let left = 0, top = 0;

                    tooltip.transition()
                        .duration(100)
                        .style('opacity', .9)
                        .style('background', color)
                        .style('border-color', color)
                        .style('z-index', 10000);
                    tooltip.html(this.multiOption.tooltip(data));

                    setTimeout(() => {
                        const toolX = tooltip.node().clientWidth;
                        const toolY = tooltip.node().clientHeight;
                        top = pageY - toolY - 15;
                        left = pageX - (toolX / 2);

                        tooltip
                            .style('top', top + 'px')
                            .style('left', left + 'px');
                    });
                })
                .on('mouseout', () => {
                    tooltip .transition()
                        .duration(200)
                        .style('opacity', 0)
                        .style('z-index', -1);
                });
        }

        if (this.multiOption.onClick) {
            symbols.on('click', data => this.multiOption.onClick(data, d3.event));
        }

        transition(symbols, this.transitionDuration(), this.transitionDelay())
            .attr('opacity', (data, i) => isNaN(this._existenceAccessor(data)) ? 0 : this._filtered[i] ? 1 : this.excludedOpacity())
            .attr('stroke', (data, i) => {
                if (this.excludedColor() && !this._filtered[i]) {
                    return this.excludedColor();
                } else if (typeof color === 'function' ) {
                    return color(data.data.value);
                } else {
                    return color;
                }
            })
            .attr('seriesKey', data => data.data.key[0])
            .attr('fill', '#fff')
            .attr('transform', this._locator)
            .attr('d', d3.symbol().type(getSymbol()).size(symbolSize()));

        transition(symbols.exit(), this.transitionDuration(), this.transitionDelay()).attr('opacity', 0).remove();

        // 추가된 데이터가 있으면 다시 렌더
        if (d.values && d.values.length !== symbols.size()) {
            this.renderSymbol(d, option);
        }
    }

    barHeight(y, d) {
        const rtn = +(this.yAxisHeight() - y(d.y)) < 0 ? 0 : utils.safeNumber(+(this.yAxisHeight() - y(d.y)));
        if (d.y0 !== undefined) {
            return (y(d.y0) - y(d.y + d.y0));
        }

        return rtn;
    }

    drawArea(layersEnter, layers, y, option, curve) {
        const area = d3.area()
            .x(d => this.x()(d.x))
            .y1(d =>  y ? y(d.y) : this.y()(d.y))
            .y0(() => {
                if (option.renderAreaRange) {
                    return y ? y(option.renderAreaRange) : this.y()(option.renderAreaRange);
                } else {
                    return this.yAxisHeight();
                }
            })
            .curve(curve);
        if (this._defined) {
            area.defined(this._defined);
        }

        layersEnter.append('path')
            .attr('class', 'area')
            .attr('fill', option.color ? option.color : this.colors2.bind(this))
            .attr('d', d => this.safeD(area(d.values)));

        transition(layers.select('path.area'), this.transitionDuration(), this.transitionDelay())
            .attr('stroke', option.color ? option.color : this.colors2.bind(this)).attr('d', d => this.safeD(area(d.values)));
    }

    renderLabels(layer, layerIndex, d) {
        const labels = layer.selectAll('text.barLabel')
            .data(d.values, pluck('x'));

        labels.enter()
            .append('text')
            .attr('class', 'barLabel')
            .attr('text-anchor', 'middle');

        if (this.isOrdinal()) {
            labels.attr('cursor', 'pointer');
        }

        transition(labels, this.transitionDuration(), this.transitionDelay())
            .attr('x', data => {
                let x = this.x()(data.x);
                if (!this._centerBar) {
                    x += this._barWidth / 2;
                }
                return utils.safeNumber(x);
            })
            .attr('y', data => {
                let y = this.y()(data.y + data.y0);

                if (data.y < 0) {
                    y -= this.barHeight(y, data);
                }

                return utils.safeNumber(y - 3);
            })
            .text(data =>  this.label()(data));

        transition(labels.exit(), this.transitionDuration(), this.transitionDelay())
            .attr('height', 0)
            .remove();
    }

    renderThermal(data, option, xStep, yStep, y) {
        const symbols = this.chartBodyG().selectAll('rect.thermal').data(data.values);
        symbols.enter().append('rect').attr('class', 'thermal');
        transition(symbols, this.transitionDuration(), this.transitionDelay())
            .attr('x', d => this.x()((+d.x - xStep / 2)))
            .attr('y', d => y(+d.y + yStep))
            .attr('width', this.x()(this.x().domain()[0] + xStep) - this.x()(this.x().domain()[0]))
            .attr('height', y(y.domain()[0]) - y(y.domain()[0] + yStep))
            .attr('opacity', d => isNaN(d.z) ? 0 : 1)
            .style('fill', d => option.colorScale(option.colorAccessor(d.data)));
        transition(symbols.exit(), this.transitionDuration(), this.transitionDelay()).attr('opacity', 0).remove();
    }

    renderBars(layer, layerIndex, data, y, option, barlist, barIndex) {
        const bars = layer.selectAll('rect.bar').data(data.values, pluck('x'));
        // eslint-disable-next-line no-unused-vars
        let ordinalType = false;
        if (option.barWidth) {
            this._barWidth = option.barWidth;
        }

        if (this._x.bandwidth) {
            ordinalType = true;
            this._barWidth = this._x.bandwidth();
        }

        if (this.multiOption.xAxisOption && this.multiOption.xAxisOption.type === 'date') {
            const {left, right} = this.margins();
            const xAxisWidth = this._widthCalc() - left - right;
            const uniqKeys = _.uniq(this.data().map(d => d.key[1]));

            this._barWidth = xAxisWidth / uniqKeys.length;
        }

        transition(bars.exit(), this.transitionDuration(), this.transitionDelay())
            .attr('x', d => this.x()(d.x))
            .attr('width', this._barWidth * 0.9)
            .remove();

        bars.enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => {
                let x = this.x()(d.x);
                if (this._centerBar && !this.isOrdinal()) {
                    x -= this._barWidth / 2;
                }
                if (this.isOrdinal() && this._gap !== undefined) {
                    x += this._gap / 2;
                }
                const position = (this._barWidth / barlist.length) * barIndex;
                return utils.safeNumber(x + position);
            })
            .attr('y', d => {
                let yVal;
                if (d.y0 !== undefined) {
                    yVal = y(d.y + d.y0);
                    if (d.y < 0) {
                        yVal -= this.barHeight(y, d);
                    }
                } else {
                    yVal = y(d.y);
                }
                return utils.safeNumber(yVal);
            })
            .attr('width', this._barWidth / barlist.length)
            .attr('height', d => this.barHeight(y, d))
            .attr('fill', pluck('layer', option.color ? d => {
                if (option.stacks) {
                    const index = option.stacks.indexOf(d);
                    return option.color[index];
                } else {
                    return option.color;
                }
            } : this.getColor))
            .select('title').text(pluck('data', this.title(data.name)));

        if (this.multiOption.onClick) {
            bars.on('click', d => this.multiOption.onClick(d, d3.event));
        }

        transition(bars, this.transitionDuration(), this.transitionDelay())
            .attr('x', d => {
                let x = this.x()(d.x);
                if (this._centerBar && !this.isOrdinal()) {
                    x -= this._barWidth / 2;
                }
                if (this.isOrdinal() && this._gap !== undefined) {
                    x += this._gap / 2;
                }
                const position = (this._barWidth / barlist.length) * barIndex;
                return utils.safeNumber(x + position);
            })
            .attr('y', d => {
                let yVal;
                if (d.y0 !== undefined) {
                    yVal = y(d.y + d.y0);
                    if (d.y < 0) {
                        yVal -= this.barHeight(y, d);
                    }
                } else {
                    yVal = y(d.y);
                }
                return utils.safeNumber(yVal);
            })
            .attr('width', this._barWidth / barlist.length)
            .attr('height', d => this.barHeight(y, d))
            .attr('fill', pluck('layer', option.color ? d => {
                if (option.stacks) {
                    const index = option.stacks.indexOf(d);
                    return option.color[index];
                } else {
                    return option.color;
                }
            } : this.getColor))
            .select('title').text(pluck('data', this.title(data.name)));
    }

    stepLine(layersEnter, layers, y, option) {
        let bandwidth = 0;
        if (this.x().bandwidth) {
            bandwidth = this.x().bandwidth() / 2;
        }

        const line = d3.line()
            .x(d => (this.x()(d.x) + bandwidth))
            .y(d => y ? y(d.y) : this.y()(d.y))
            .curve(d3.curveStepAfter);

        if (this._defined) {
            line.defined(this._defined);
        }

        const path = layersEnter.append('path').attr('class', 'line').attr('stroke', option.color ? option.color : this.colors2.bind(this));

        if (option.dashStyle) {
            path.attr('stroke-dasharray', option.dashStyle);
        }
        transition(layers.select('path.line'), this.transitionDuration(), this.transitionDelay())
            .attr('stroke', option.color ? option.color : this.colors2.bind(this))
            .attr('d', d => this.safeD(line(d.values)))
            .style('stroke-width', option.lineWidth + 'px');
    }

    symbol(type) {
        if (!type) {
            return this._symbol.type();
        }
        this._symbol.type(type);
        return this;
    }

    excludedColor(excludedColor) {
        if (!excludedColor) {
            return this._excludedColor;
        }
        this._excludedColor = excludedColor;
        return this;
    }

    excludedOpacity(excludedOpacity) {
        if (!excludedOpacity) {
            return this._excludedOpacity;
        }
        this._excludedOpacity = excludedOpacity;
        return this;
    }

    resizeSymbolsWhere(condition, size) {
        const symbols = this.selectAll('.chart-body path.symbol').filter(() => condition(d3.select(this)));
        const oldSize = this._symbol.size();
        this._symbol.size(Math.pow(size, 2));

        transition(symbols, this.transitionDuration(), this.transitionDelay()).attr('d', this._symbol);
        this._symbol.size(oldSize);
    }

    extendBrush() {
        const extent = this.brush().extent();
        if (this.round()) {
            extent[0] = extent[0].map(this.round());
            extent[1] = extent[1].map(this.round());
            this.g().select('.brush').call(this.brush().extent(extent));
        }
        return extent;
    }

    brushIsEmpty(extent) {
        return this.brush().empty() || !extent || extent[0][0] >= extent[1][0] || extent[0][1] >= extent[1][1];
    }

    _brushing() {
        const extent = this.extendBrush();
        this.redrawBrush(this.g());
        if (this.brushIsEmpty(extent)) {
            events.trigger(() => {
                this.filter(null);
                this.redrawGroup();
            });
        } else {
            const ranged2DFilter = filters.RangedTwoDimensionalFilter(extent);
            events.trigger(() => {
                this.filter(null);
                this.filter(ranged2DFilter);
                this.redrawGroup();
            }, constants.EVENT_DELAY);
        }
    }

    getTooltipElem() {
        if (!this._tooltip || this._tooltip.empty()) {
            this._tooltip  = d3.select('body')
                .append('div')
                .attr('class', 'dj-chart-tooltip')
                .html('')
                .style('opacity', 0)
                .style('position', 'absolute')
                .style('z-index', -1);
        }
        return this._tooltip;
    }
}
