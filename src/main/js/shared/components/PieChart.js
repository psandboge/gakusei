import React from 'react';
import Chart from 'chart.js';

// Only the retained home-screen Pie contract is supported. Chart 2 mutates
// datasets/arrays; keep those mutations away from caller-owned Redux data.
function copy(value) {
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === 'object') return Object.keys(value).reduce((out, key) => {
    out[key] = copy(value[key]);
    return out;
  }, {});
  return value;
}
export default class PieChart extends React.Component {
  constructor(props) {
    super(props);
    this.canvas = React.createRef();
  }
  componentDidMount() {
    this.chart = new Chart(this.canvas.current, {
      type: 'pie', data: copy(this.props.data), options: copy(this.props.options)
    });
  }
  componentDidUpdate() {
    const data = copy(this.props.data);
    // Retain dataset identity so Chart 2 keeps its controllers/animation state.
    const previous = this.chart.data.datasets;
    data.datasets = data.datasets.map((dataset, index) => Object.assign(previous[index] || {}, dataset));
    this.chart.data = data;
    this.chart.options = Chart.helpers.configMerge(this.chart.options, copy(this.props.options));
    this.chart.update();
  }
  componentWillUnmount() {
    this.chart.destroy();
  }
  render() {
    return <canvas ref={this.canvas} height={this.props.height} width={this.props.width} />;
  }
}
PieChart.defaultProps = { height: 150, width: 300, options: {} };
