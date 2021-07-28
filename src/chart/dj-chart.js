import CloudChart from './cloud-chart';
import MultiChart from './multi-chart';
import {Base} from "@/chart/base";

export default class DjChart extends Base {
    option;

    constructor(option) {
        super();
        this.option = option;
    }

    cloudChart(element) {
        return new CloudChart(element, this.option);
    }

    multiChart(element) {
        const chart = new MultiChart(element, this.option);
        return chart['anchor'](element);
    }
}
