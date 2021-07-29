<template>
 <div ref="chartElement"></div>
</template>

<script>
import DjChartOption from "@/class/dj-chart-option";
import {isArray} from "util";
import * as d3 from 'd3';
import * as moment from 'moment';
import {transition} from 'dc';
import DjChart from "@/chart/dj-chart";

export default {
  name: "VueDjChart",
  data() {
    return {
      domWidth: 0,
      resizeDelay: 300,
      resizeTimer: null,
      chart: null,
      djChart: null,
      // eslint-disable-next-line vue/no-reserved-keys
      _option: null
    }
  },
  props: {
    option: DjChartOption
  },
  watch: {
    option() {
      this.initComponent();
    }
  },
  methods: {
    initComponent() {
      if (!this.option) {
        return ;
      }

      if (this.option.type === 'composite') {
        this.option.setAxisOption();
      }

      this.djChart = new DjChart(this.option);
      this._option = this.option;

      switch (this._option.type) {
        case 'pieChart':
          this.chart = this.djChart.pieChart(this.$refs.chartElement);
          this.setPieChart();
          break;
        case 'cloudChart':
          this.chart = this.djChart.cloudChart(this.$refs.chartElement);
          this.setCloudChart();
          break;
        case 'dcChart':
          this.setDcChart();
          break;
        default:
          this.chart = this.djChart.seriesChart(this.$refs.chartElement);
          this.setMultiSeries();
          break;
      }

      this.chart.render();
      this.$emit('rendered');
    },
    observeSize() {
      const ro = new ResizeObserver(entries => {
        entries.forEach(entry => {
          const { width } = entry.contentRect;

          clearTimeout(this.resizeTimer);
          this.resizeTimer = setTimeout(() => {
            if (this.domWidth !== width) {
              this.domWidth = width;

              // redraw
              if (this.chart) {
                this.chart.minWidth(100);
                this.chart.minHeight(50);
                this.chart.width(0);
                this.chart.height(0);
                if (this.chart.rescale) {
                  this.chart.rescale();
                }
                if (this.chart.update) {
                  this.chart.update();
                } else {
                  this.chart.redraw();
                }
              }
            }
          }, this.resizeDelay);
        })
      })
      ro.observe(this.$refs.chartElement)
    },
    create() {
      this.setWidthHeight();
      this.setMargins();

      // input type이 crossfilter와 data일때 처리
      if (this._option.data !== undefined) {
        this.chart.dimension(this.filter());
        this.chart.group({all: () => this._option.data, size: () => this._option.data.length});
      } else {
        this.chart.dimension(this._option.dimension);
        this.chart.group(this._option.group);
      }

      const overrideFields = ['onClick'];
      overrideFields.forEach(key => {
        if (this._option[key] !== undefined) {
          if (key === 'onClick') {
            this.chart[key] = d => this._option.onClick(d, d3.event);
          } else {
            this.chart[key] = this._option[key];
          }
        }
      });

      if (this._option.onClickEvent) {
        this.chart['_onClickEvent'] = this.chart.onClick;
        this.chart['onClick'] = (d) => {
          this.chart._onClickEvent(d);
          this._option.onClickEvent(d);
        };
      }

      if (this._option.onFilterChanged) {
        this.chart.on('filtered', d => this._option.onFilterChanged(d));
      }

      this._option['chart'] = this.chart;
    },
    setPieChart() {
      this.create();
      const _innerRadius = this._option.innerRadius || 30;
      const _radius = this._option.radius || 80;
      const _externalLabels = this._option.externalLabels || 0;
      const size = d3.min([+this.width, +this.height]);


      this.chart
          .radius((size / 2) * (_radius / 100))
          .innerRadius((size / 2) * (_innerRadius / 100))
          .externalLabels(_externalLabels)
          .drawPaths(true);

      if (this._option.slicesPercent) {
        let data = this._option.data || this._option.group.all();
        data = data.sort((a, b) => b.value - a.value);
        let sum = 0;
        let index = 0;
        data.forEach(d => sum += d.value);
        while (index < data.length) {
          const percent = (data[index].value / sum) * 100;
          if (percent < this._option.slicesPercent) {
            break;
          }
          index++;
        }

        this.chart.slicesCap(index);
      }

      if (this._option.slicesCap) {
        this.chart.slicesCap(this._option.slicesCap);
      }

      if (this._option.colors) {
        this.chart.colors(d => {
          const key = isArray(d) ? d[0] : d;
          return this._option.colors[key] || '#ccc';
        });
      }

      this.chart.on('pretransition', (chart) => {
        chart.selectAll('text.pie-slice').text(d => {
          let key = d.data.key;
          const angle = d.endAngle - d.startAngle;
          if (this._option.legends) {
            key = this._option.legends[key] || key;
          }

          if (angle > 0.5 || (angle > 0.5 && _externalLabels)) {
            return key;
          }
          return '';
        });

        if (this._option.tooltip) {
          const tooltip = this.getTooltipElem();
          chart.selectAll('title').remove();
          chart.selectAll('g.pie-slice')
              .on('mousemove', data => {
                const key = isArray(data.data.key) ? data.data.key[0] : data.data.key;
                const color = this._option.colors ? this._option.colors[key] : this.chart.getColor(data.data);
                const pageX = d3.event.pageX;
                const pageY = d3.event.pageY;
                let left = 0, top = 0;

                tooltip.transition()
                    .duration(100)
                    .style('opacity', .9)
                    .style('background', color)
                    .style('border-color', color)
                    .style('z-index', 10000);
                tooltip.html(this._option.tooltip(data));

                setTimeout(() => {
                  const toolX = tooltip.node().clientWidth;
                  const toolY = tooltip.node().clientHeight;
                  top = pageY - toolY - 20;
                  left = pageX - (toolX / 2);

                  tooltip
                      .style('top', top + 'px')
                      .style('left', left + 'px');
                });
              })
              .on('mouseout', () => {
                tooltip.transition()
                    .duration(300)
                    .style('opacity', 0)
                    .style('z-index', -1);
              });
        }
      });
    },
    setDcChart() {
      this.chart = this.djChart[this._option.dcChart](this.$refs.chartElement);
      this.create();

      Object.keys(this._option).forEach(key => {
        if (this.chart[key]) {
          this.chart[key](this._option[key]);
        }
      });
    },
    setCloudChart() {
      this.create();
      this.chart.padding(this._option.padding);
      this.chart.legends(this._option.legends);
    },
    setMargins() {
      if (this._option.margins) {
        this.chart.margins().left = this._option.margins.left !== undefined ? +this._option.margins.left : 30;
        this.chart.margins().right = this._option.margins.right !== undefined ? +this._option.margins.right : 50;
        this.chart.margins().bottom = this._option.margins.bottom !== undefined ? +this._option.margins.bottom : 30;
        this.chart.margins().top = this._option.margins.top !== undefined ? +this._option.margins.top : 10;
      }
    },
    setMultiSeries() {
      this.create();

      let min = d3.min(this.chart.group().all(), d => +d.key[1]) || 0;
      let max = d3.max(this.chart.group().all(), d => +d.key[1]);
      const subChart = c => {
        return this.djChart.multiChart(c);
      };

      let leftYAxisWidth = 30;
      this.chart
          .chart(subChart)
          .renderHorizontalGridLines(true)
          .renderVerticalGridLines(true)
          .x(d3.scaleLinear().domain([min, max]))
          .yAxisLabel(this._option.axisOption && this._option.axisOption.length ? this._option.axisOption[0].axisLabel : this._option.yAxisLabel)
          .xAxisLabel(this._option.xAxisLabel)
          .clipPadding(5)
          .elasticY(false)
          .mouseZoomable(false)
          .brushOn(false)
          .seriesAccessor(d => d.key[0])
          .seriesSort((a, b) => {
            const orderList = this._option.axisOption.map(d => d.series);
            return orderList.indexOf(a) - orderList.indexOf(b);
          })
          .keyAccessor(d => {
            return d.key ? isNaN(d.key[1]) ? d.key[1] : +d.key[1] : null;
          })
          .valueAccessor(d => d.value);

      // set lef y axis
      this.setLeftYAxis();

      // xAxis
      if (this._option.xAxisOption) {
        if (this._option.xAxisOption.domain) {
          min = this._option.xAxisOption.domain[0];
          max = this._option.xAxisOption.domain[1];
        }
        switch (this._option.xAxisOption.type) {
          case 'ordinal':
            this.chart.x(d3.scaleBand()).xUnits(this.djChart.units.ordinal).domain([min, max]);
            break;
          case 'date':
            if (this._option.xAxisOption.domain) {
              min = moment(min, this._option.xAxisOption.dateFormat).valueOf();
              max = moment(max, this._option.xAxisOption.dateFormat).valueOf();
            }
            this.chart.x(d3.scaleTime().domain([new Date(min), new Date(max)]));
            if (this._option.xAxisOption.dateTickFormat) {
              this.chart.xAxis().tickFormat(d => moment(d).format(this._option.xAxisOption.dateTickFormat));
            }
            break;
          default:
            this.chart.x(d3.scaleLinear().domain([min, max]));
            break;
        }

        if (this._option.xAxisOption.ticks) {
          this.chart.xAxis().ticks(this._option.xAxisOption.ticks);
        }
        if (this._option.xAxisOption.tickFormat) {
          this.chart.xAxis().tickFormat(this._option.xAxisOption.tickFormat);
        }

        this.chart.xAxisLabel(this._option.xAxisOption.axisLabel);
      }

      // series sort
      if (this._option.order) {
        this.chart.seriesSort((a, b) => {
          const order = this._option.order;
          const before = order.indexOf(a);
          const after = order.indexOf(b);
          return before - after;
        });
      }

      // renderlet
      this.chart['renderOn'] = chart => {
        if (this._option.highlight) {
          this.renderHighlight(chart);
        }
      };

      // update
      this.chart['update'] = () => {
        let rightWidth = 0;
        this.chart.redraw();
        this.setLeftYAxis();

        setTimeout(() => {
          this._option.axisOption.forEach((v, i) => {
            if (i && !v.hide) {
              rightWidth += +v.width ? +v.width : 0;
            }
          });
          // right yAxis 2개 이상부터 35씩 추가
          if (this._option.yAxisOptions.length > 2) {
            rightWidth += (this._option.yAxisOptions.length - 2) * 35;
          }

          if (this._option.elasticRightMargin) {
            this.chart.margins().right = this.chart.marginRight + rightWidth;
          } else {
            this.chart.margins().right = this.chart.marginRight;
          }


          // left yAxis 의 width 구하기
          if (this._option.elasticLeftMargin) {
            leftYAxisWidth = this.chart.svg().selectAll('.axis.y')._groups[0][0].getBoundingClientRect().width + 20;
            this.chart.margins().left = this._option.axisOption[0].axisLabel || this._option.yAxisLabel ? leftYAxisWidth : this.chart.margins().left;
          }

          // left margin 영역 만큼 chart g 이동
          const chartBodys = this.chart.g().selectAll('g.chart-body');
          const gridLines = this.chart.g().selectAll('g.grid-line');
          const highlight = this.chart.g().selectAll('g.highlight');
          transition(chartBodys, this.chart.transitionDuration(), this.chart.transitionDelay())
              .attr('transform', `translate(${this.chart.margins().left}, ${this.chart.margins().top})`);
          transition(gridLines, this.chart.transitionDuration(), this.chart.transitionDelay())
              .attr('transform', `translate(${this.chart.margins().left}, ${this.chart.margins().top})`);
          transition(highlight, this.chart.transitionDuration(), this.chart.transitionDelay())
              .attr('transform', `translate(${this.chart.margins().left}, ${this.chart.margins().top})`);


          setTimeout(() => {
            this.chart.redraw();
          });
        }, 500);
      };

      // redraw change
      this.chart['_redraw'] = this.chart.redraw;
      this.chart['_redraw'] = this.chart.redraw;
      this.chart['redraw'] = () => {
        this.chart._redraw();
        this.chart.renderOn(this.chart);
      };


      // render change
      this.chart['_render'] = this.chart.render;
      this.chart.render = () => {
        this.chart['marginRight'] = this.chart.margins().right;
        this.chart._render();

        setTimeout(() => {
          this.chart.update();
        }, 300);
      };
    },
    setLeftYAxis() {
      const axisOption = this._option.axisOption;
      if (axisOption && axisOption[0]) {
        let domain;
        const leftOption = axisOption[0];
        // domain
        if (axisOption && axisOption.length && leftOption.domain) {
          domain = leftOption.domain;
        } else {
          if (this.chart.group().all().length) {
            domain = [
              d3.min(this.chart.group().all(),
                  d => typeof d.value === 'object' ? d.value.value : d.value) + (this._option.gap ? - this._option.gap : 0
              ),
              d3.max(this.chart.group().all(),
                  d => typeof d.value === 'object' ? d.value.value : d.value) + (this._option.gap ? this._option.gap : 0
              )
            ];
          } else {
            domain = [0, 100];
          }
        }
        this.chart.y(d3.scaleLinear().domain(domain ? domain : [0, 100]));

        // tickformat
        if (leftOption.tickFormat) {
          this.chart.yAxis().tickFormat(leftOption.tickFormat);
        } else if (leftOption.prevTickText || leftOption.nextTickText) {
          const tickFormat = d => {
            let tick = '';
            if (leftOption.prevTickText) {
              tick += leftOption.prevTickText;
            }
            tick += this.commaSeparateNumber(d) || 0;
            if (leftOption.nextTickText) {
              tick += leftOption.nextTickText;
            }

            return tick;
          };
          this.chart.yAxis().tickFormat(tickFormat);
        } else {
          this.chart.yAxis().tickFormat(d => this.commaSeparateNumber(d) || 0);
        }

        // label
        if (leftOption.axisLabel) {
          this.chart.yAxisLabel(leftOption.axisLabel);
        }
      } else {
        this.chart.y(d3.scaleLinear().domain([0, 100]));
      }
    },
    setWidthHeight() {
      this.width = this._option.width ? this._option.width : this.$refs.chartElement.clientWidth || 200;
      this.height = this._option.height ? this._option.height : this.$refs.chartElement.clientHeight || 400;

      this.chart
          .width(this.width)
          .height(this.height);
    },
    filter() {
      if (!this._option.filters) {
        this._option['filters'] = [];
      }

      return {
        filter: () => {
          this._option.filters = this.getFilters();
          this.$emit('changFilter');
        },
        filterExact: () => {
          this._option.filters = this.getFilters();
          this.$emit('changFilter');
        },
        filterFunction: () => {
          this._option.filters = this.getFilters();
          this.$emit('changFilter');
        }
      };
    },
    getFilters() {
      const filters =  this.chart.filters().map(d => {
        if (Array.isArray(d)) {
          return d[0];
        } else {
          return d;
        }
      });
      return filters;
    },
    getTooltipElem() {
      if (!this._tooltip || this._tooltip.empty()) {
        this._tooltip  = d3.select('body')
            .append('div')
            .attr('class', 'dj-chart-tooltip')
            .html('')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('z-index', 10000);
      }
      return this._tooltip;
    },
    renderHighlight (chart) {
      const g = chart.g();

      let highlight = g.selectAll('g.highlight');
      if (highlight.empty()) {
        highlight = g.insert('g', ':first-child')
            .attr('class', 'highlight')
            .attr('transform', `translate(${this.chart.margins().left},${this.chart.margins().top})`);
      }

      const sections = highlight.selectAll('rect.section').data(this._option.highlight);
      sections.enter()
          .append('rect')
          .attr('class', (d, i) => `section _${i}`)
          .attr('fill', d => d.color || 'blue')
          .attr('fill-opacity', d => d.opacity || .3)
          .attr('stroke', '#fff')
          .attr('x', d => {
            const domain = d.domain;
            let x0;
            if (this._option.xAxisOption.type === 'date') {
              const dateFormat = this._option.xAxisOption.dateFormat;
              if (domain[0].valueOf) {
                x0 = domain[0].valueOf();
              } else {
                x0 = moment(domain[0], dateFormat).valueOf();
              }
            } else {
              x0 = domain[0];
            }
            return this.chart.x()(x0);
          })
          .attr('y', 0)
          .attr('height', this.chart.yAxisHeight())
          .attr('width', d => {
            const domain = d.domain;
            let x0, x1;

            if (this._option.xAxisOption.type === 'date') {
              const dateFormat = this._option.xAxisOption.dateFormat;
              x0 = moment(domain[0], dateFormat).valueOf();
              x1 = moment(domain[1], dateFormat).valueOf();
            } else {
              x0 = domain[0];
              x1 = domain[1];
            }
            const x = this.chart.x()(x0);
            return this.chart.x()(x1) - x;
          });

      transition(sections, this.chart.transitionDuration(), this.chart.transitionDelay())
          .attr('fill', d => d.color || 'blue')
          .attr('fill-opacity', d => d.opacity || .3)
          .attr('stroke', '#fff')
          .attr('x', d => {
            const domain = d.domain;
            let x0;
            if (this._option.xAxisOption.type === 'date') {
              const dateFormat = this._option.xAxisOption.dateFormat;
              x0 = moment(domain[0], dateFormat).valueOf();
            } else {
              x0 = domain[0];
            }
            return this.chart.x()(x0);
          })
          .attr('width', d => {
            const domain = d.domain;
            let x0, x1;

            if (this._option.xAxisOption.type === 'date') {
              const dateFormat = this._option.xAxisOption.dateFormat;
              x0 = moment(domain[0], dateFormat).valueOf();
              x1 = moment(domain[1], dateFormat).valueOf();
            } else {
              x0 = domain[0];
              x1 = domain[1];
            }
            const x = this.chart.x()(x0);
            return this.chart.x()(x1) - x;
          });

      transition(sections.exit(), this.chart.transitionDuration(), this.chart.transitionDelay()).attr('opacity', 0).remove();
    },
    commaSeparateNumber (value) {
      if (!value) {
        return '';
      }
      while (/(\d+)(\d{3})/.test(value.toString())) {
        value = value.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
      }
      return value;
    }
  },
  mounted () {
    if (!this.option) {
      return ;
    }
    this.observeSize();
    this.initComponent();
  }
}
</script>

<style>
 @import "../../node_modules/dc/dist/style/dc.css";

 svg.dj-chart-cloud  text {
   font-family: 'Noto Sans KR', 'Nanum Gothic Coding', SpoqaHanSans, sans-serif !important;
   cursor: pointer;
 }
 svg.dj-chart-cloud  text:hover {opacity: .5;}

 /*app-dj-chart*/
 .axis path,
 .axis line {
   fill: none;
   stroke: #000;
   shape-rendering: crispEdges;
 }
 .drag rect.extent {
   fill: #008bff;
   fill-opacity: 0.2;
 }
 svg .x-axis-label, .y-axis-label{
   opacity: .5;
   font-size: 11px !important;
 }

 g.dc-legend{
   font-size: 15px;
 }

 .radar{
   margin: 0 !important;
 }

 .svg-vis .level-labels{
   font-size: 9px;
 }
 .svg-vis.radarAxis .axis-labels{
   font-size: 9px;
 }
 .ntnChart .y.axis .tick text{
   font-size: 9px;
 }

 .axis text, .dc-chart .bar_group text.text{
   font-size: 9px;
   font-family: "Helvetica Neue", Roboto, Arial, "Droid Sans", sans-serif;
 }

 .test-result-tc g.dc-legend{
   font-size: 11px;
 }

 .annotation{
   font-size: 100%;
   font-weight: inherit;
 }

 path.dc-symbol, .dc-legend g.dc-legend-item.fadeout {
      fill-opacity: 0.5;
      stroke-opacity: 0.5;
 }

 .dc-chart rect.bar {stroke: none; cursor: pointer; }
 .dc-chart rect.bar:hover {fill-opacity: .5; }

 .dc-chart rect.deselected {stroke: none; fill: #ccc;}

 .dc-chart .pie-slice {
    fill: #fff;
    font-size: 12px;
    cursor: pointer; }
 .dc-chart .pie-slice.external {fill: #000; }
 .dc-chart .pie-slice :hover, .dc-chart .pie-slice.highlight {fill-opacity: .8; }

 .dc-chart .pie-path {
    fill: none;
    stroke-width: 2px;
    stroke: #000;
    opacity: 0.4;
 }

 .dc-chart .selected path, .dc-chart .selected circle {
   stroke-width: 3;
   stroke: #ccc;
   fill-opacity: 1;
 }

 .dc-chart .deselected path, .dc-chart .deselected circle {
   stroke: none;
   fill-opacity: .5;
   fill: #ccc;
 }

 .dc-chart .axis path, .dc-chart .axis line {
   fill: none;
   stroke: #000;
   shape-rendering: crispEdges;
 }

 .dc-chart .axis text {font: 10px sans-serif; }

 .dc-chart .grid-line, .dc-chart .axis .grid-line, .dc-chart .grid-line line, .dc-chart .axis .grid-line line {
   fill: none;
   stroke: #ccc;
   shape-rendering: crispEdges;
 }

 .dc-chart .brush rect.selection {fill: #4682b4; fill-opacity: .125;}

 .dc-chart .brush .custom-brush-handle {
   fill: #eee;
   stroke: #666;
   cursor: ew-resize;
 }

 .dc-chart path.line {fill: none; stroke-width: 1.5px;}

 .dc-chart path.area {fill-opacity: .3;stroke: none; }

 .dc-chart path.highlight {
    stroke-width: 3;
    fill-opacity: 1;
    stroke-opacity: 1;
 }

 .dc-chart g.state {
    cursor: pointer;
 }
 .dc-chart g.state :hover {
    fill-opacity: .8;
 }
 .dc-chart g.state path {
    stroke: #fff;
 }

 .dc-chart g.deselected path {
    fill: #808080; }

 .dc-chart g.deselected text {
    display: none; }

 .dc-chart g.row rect {
    fill-opacity: 0.8;
    cursor: pointer; }
 .dc-chart g.row rect:hover {
    fill-opacity: 0.6; }

 .dc-chart g.row text {
    fill: #fff;
    font-size: 12px;
    cursor: pointer; }

 .dc-chart g.dc-tooltip path {
    fill: none;
    stroke: #808080;
    stroke-opacity: .8; }

 .dc-chart g.county path {
    stroke: #fff;
    fill: none; }

 .dc-chart g.debug rect {
    fill: #00f;
    fill-opacity: .2; }

 .dc-chart g.axis text {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    pointer-events: none; }

 .dc-chart .node {
    font-size: 0.7em;
    cursor: pointer; }
 .dc-chart .node :hover {
    fill-opacity: .8; }

 .dc-chart .bubble {
    stroke: none;
    fill-opacity: 0.6; }

 .dc-chart .highlight {
    fill-opacity: 1;
    stroke-opacity: 1; }

 .dc-chart .fadeout {
    fill-opacity: 0.2;
    stroke-opacity: 0.2; }

 .dc-chart .box text {
    font: 10px sans-serif;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    pointer-events: none; }

 .dc-chart .box line {
    fill: #fff; }

 .dc-chart .box rect, .dc-chart .box line, .dc-chart .box circle {
                                                stroke: #000;
                                                stroke-width: 1.5px; }

 .dc-chart .box .center {
    stroke-dasharray: 3, 3; }

 .dc-chart .box .data {
    stroke: none;
    stroke-width: 0px; }

 .dc-chart .box .outlier {
    fill: none;
    stroke: #ccc; }

 .dc-chart .box .outlierBold {
    fill: red;
    stroke: none; }

 .dc-chart .box.deselected {
    opacity: 0.5; }
 .dc-chart .box.deselected .box {
    fill: #ccc; }

 .dc-chart .symbol {
    stroke-width: 1.5px;
    cursor: pointer;
  }

 .dc-chart .heatmap .box-group.deselected rect {
    stroke: none;
    fill-opacity: 0.5;
    fill: #ccc; }

 .dc-chart .heatmap g.axis text {
    pointer-events: all;
    cursor: pointer; }

 .dc-chart .empty-chart .pie-slice {
    cursor: default; }
 .dc-chart .empty-chart .pie-slice path {
    fill: #fee;
    cursor: default; }

 .dc-data-count {
   float: right;
   margin-top: 15px;
   margin-right: 15px; }
 .dc-data-count .filter-count, .dc-data-count .total-count {
   color: #3182bd;
   font-weight: bold; }

 .dc-legend {
   font-size: 11px; }
 .dc-legend .dc-legend-item {
   cursor: pointer; }
 .dc-legend g.dc-legend-item.selected {
   fill: blue; }

 .dc-hard .number-display {
   float: none; }

 div.dc-html-legend {
   overflow-y: auto;
   overflow-x: hidden;
   height: inherit;
   float: right;
   padding-right: 2px; }
 div.dc-html-legend .dc-legend-item-horizontal {
   display: inline-block;
   margin-left: 5px;
   margin-right: 5px;
   cursor: pointer; }
 div.dc-html-legend .dc-legend-item-horizontal.selected {
   background-color: #3182bd;
   color: white; }
 div.dc-html-legend .dc-legend-item-vertical {
   display: block;
   margin-top: 5px;
   padding-top: 1px;
   padding-bottom: 1px;
   cursor: pointer; }
 div.dc-html-legend .dc-legend-item-vertical.selected {
   background-color: #3182bd;
   color: white; }
 div.dc-html-legend .dc-legend-item-color {
   display: table-cell;
   width: 12px;
   height: 12px; }
 div.dc-html-legend .dc-legend-item-label {
   line-height: 12px;
   display: table-cell;
   vertical-align: middle;
   padding-left: 3px;
   padding-right: 3px;
   font-size: 0.75em; }

 .dc-html-legend-container {
   height: inherit;
 }

 .dj-chart-tooltip {
   position: relative;
   min-width: 30px;
   min-height: 30px;
   padding: 8px;
   border-radius: 4px;
   color: #fff;
 }
 .dj-chart-tooltip:after, .dj-chart-tooltip:before {
             border: solid transparent;
             content: " ";
             height: 0;
             width: 0;
             position: absolute;
             pointer-events: none;
           }

 .dj-chart-tooltip:after {
    border-color: rgba(255, 255, 255, 0);
    border-width: 5px;
    margin-top: -5px;
  }
 .dj-chart-tooltip:before {
    border-color: rgba(0, 0, 0, 0);
    border-width: 6px;
    margin-top: -6px;
  }

 .dj-chart-tooltip.top:after, .dj-chart-tooltip.top:before {top: 10px;}
 .dj-chart-tooltip.bottom:after, .dj-chart-tooltip.bottom:before {bottom: 4px;}

 .dj-chart-tooltip:after, .dj-chart-tooltip:before {
   bottom: -10px;
   border-top-color: inherit;
   left: calc(50% - 6px);
 }
</style>
