/* global fetch */

import React from 'react';
import { Pie } from 'react-chartjs-2';
import 'whatwg-fetch';

import { connect } from 'react-redux';
import * as Store from '../Store';

export class UserStatisticsPage extends React.Component {
  static getChartOptions() {
    return {
      maintainAspectRatio: true,
      legend: {
        onClick: () => { /* Do nothing */ }
      },
      tooltips: {
        callbacks: {
          label(tooltipItem, data) {
            return `${data.labels[tooltipItem.index]}: ${data.datasets[0].data[tooltipItem.index]}%`;
          }
        }
      }
    };
  }

  componentWillMount() {
    this.props.fetchUserSuccessRate(this.props.loggedInUser);
  }

  getChartData() {
    const theLabels = [
      'Andel rätt svar', 'Andel fel svar'
    ];

    return {
      labels: theLabels,
      datasets: [
        {
          label: theLabels,
          backgroundColor: [
            'rgba(130,200,130,1.0)', 'rgba(130,170,130,0.4)'
          ],
          data: [
            this.props.successRate, 100 - this.props.successRate
          ]
        }
      ]
    };
  }

  render() {
    return (
      <div className="text-center">
        <h2>Spelarstatistik</h2>
        { this.props.requestingSuccessRate === false ?
          <Pie data={this.getChartData()} options={UserStatisticsPage.getChartOptions()} /> :
          <p>Loading...</p> }
      </div>
    );
  }
}

UserStatisticsPage.propTypes = {
  // username: React.PropTypes.string.isRequired,
  successRate: React.PropTypes.number.isRequired,
  loggedInUser: React.PropTypes.string.isRequired,
  requestingSuccessRate: React.PropTypes.bool.isRequired,
  // action creators
  fetchUserSuccessRate: React.PropTypes.func.isRequired
};

export default connect(
    // Selects which state properties are merged into the component's props
    state => (state.reducer),
    // Selects which action creators are merged into the component's props
    Store.actionCreators
)(UserStatisticsPage);
