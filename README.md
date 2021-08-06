# vue-dj-chart
D3, Crossfilter, DC library를 이용하여 Vue3 모듈로 만든 차트

## 설치
```
npm install vue3-dj-chart
```

## 사용
DJChartOption 을 이용하여 옵션 생성 후 :option을 통해 랜더
#### App.vue
````vue
<template>
  <vue-dj-chart :option="chartOption" @rendered="chartRendered" @changFilter="changeFilter"></vue-dj-chart>
</template>

<script>
import HelloWorld from './components/HelloWorld.vue'
import VueDjChart from 'vue3-dj-chart'
import {DjChartOption} from 'vue3-dj-chart'
require('vue3-dj-chart/dist/vue3-dj-chart.css')

export default {
  name: 'App',
  methods: {
    chartRendered() {
      console.log('chart rendered');
    },
    changeFilter() {
      console.log('change filter');
    },
    createOption() {
      const chartOption = new DjChartOption({
        data: [
          {
            key: ['sale', '20200601'],
            value: 701.0
          },
          {
            key: ['sale', '20200608'],
            value: 534.0
          },
          {
            key: ['sale', '20200615'],
            value: 236.0
          },
          {
            key: ['sale', '20200622'],
            value: 53.0
          },
          {
            key: ['sale', '20200629'],
            value: 127.0
          },
          {
            key: ['gross', '20200608'],
            value: 1869000.0
          },
          {
            key: ['gross', '20200615'],
            value: 826000.0
          },
          {
            key: ['gross', '20200622'],
            value: 185500.0
          },
          {
            key: ['gross', '20200629'],
            value: 444500.0
          }
        ],
        type: 'composite',
        colors: {
          sale: '#304ffe',
          gross: '#c51162'
        },
        legends: {
          sale: '총 주문량',
          gross: '총 주문 금액'
        },
        seriesTypes: {
          sale: 'lineSymbol',
          gross: 'line'
        },
        seriesOptions: {
          sale: {
            smooth: true,
            renderArea: true,
          },
          gross: {}
        },
        xAxisOption: {
          'axisLabel': '날짜 (월/일)',
          'type': 'date',
          'dateFormat': 'YYYYMMDD',
          'dateTickFormat': 'MM/DD',
        },
        yAxisOptions: [
          {
            axisLabel: '총 주문량',
            domain: [
              0.0,
              12673.0
            ],
            keys: ['sale']
          },
          {
            'axisLabel': '총 주문 금액',
            'domain': [
              0.0,
              4.4355325E7
            ],
            nextTickText: '원',
            keys: [
              'gross'
            ]
          }
        ],
        tooltip: (d) => {
          const html = `<dl><dt>${d.data.key[1]}</dt><dd>${d.data.value}</dd>`;
          return html;
        },
        renderArea: false,
        smooth: true
      });
      this.chartOption = chartOption;
    }
  },
  data() {
    return {
      chartOption: null
    }
  },
  components: {
    HelloWorld,
    VueDjChart
  },
  mounted() {
    this.createOption();
  }
}
</script>

<style>

</style>

````
