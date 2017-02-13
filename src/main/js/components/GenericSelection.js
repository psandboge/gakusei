/* global fetch sessionStorage*/

import React from 'react';
import 'whatwg-fetch';
import { Button, Grid, Row, Col, FormGroup, FormControl, ControlLabel } from 'react-bootstrap';
import { connect } from 'react-redux';
import * as Store from '../Store';

export class GenericSelection extends React.Component {
  constructor(props) {
    super(props);
    // this.handleSubmit = this.handleSubmit.bind(this);
    // this.handleChange = this.handleChange.bind(this);
    console.log('Hello world');
    // console.log(this.props.location.query.lessons);
  }

  componentWillMount() {
    let lessonsX = [];
    if (this.props.location.query.type === 'guess') {
      lessonsX = ['JLPT N3', 'JLPT N4', 'JLPT N5', 'GENKI 1', 'GENKI 13', 'GENKI 15'];
    } else if (this.props.location.query.type === 'quiz') {
      lessonsX = ['Den japanska floran'];
    }
    this.props.setLessonNames(lessonsX);
  }

  handleChange(event) {
    this.props.setSelectedLesson(event.target.value);
  }
  handleSubmit(event) {
    event.preventDefault();
    this.props.fetchLesson(() => { this.props.setPageByName('/play', this.props.location.query); });
  }
  render() {
    const title = {
      GuessPlayPage: 'Gissa ordet',
      TranslationPlayPage: 'Översätt ordet',
      QuizPlayPage: 'Quiz'
    };
    const options = this.props.lessonNames.map(name => <option key={name} value={name}>{name}</option>);
    return (
      <Grid className="text-center">
        <Row>
          <h1>{title[this.props.gamemode]}</h1>
        </Row>
        <Row>
          <Col xs={8} xsOffset={2} lg={4} lgOffset={4}>
            <form href="#" onSubmit={this.handleSubmit.bind(this)}>
              <FormGroup>
                <ControlLabel>Välj lista av frågor</ControlLabel>
                <FormControl
                  componentClass="select"
                  id="lessonSelection"
                  onChange={this.handleChange.bind(this)}
                  value={this.props.selectedLesson || ''}
                >
                  {options}
                </FormControl>
              </FormGroup>
              <Button type="submit">Starta</Button>
            </form>
          </Col>
        </Row>
      </Grid>
    );
  }
}

GenericSelection.propTypes = {
  gamemode: React.PropTypes.string.isRequired,
  // switchPage: React.PropTypes.func.isRequired,
  lessonNames: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
  fetchURL: React.PropTypes.string.isRequired,
  // Action creators
  setPageByName: React.PropTypes.func.isRequired
};

export default connect(
    // Selects which state properties are merged into the component's props
    state => (state.reducer),
    // Selects which action creators are merged into the component's props
    Store.actionCreators
)(GenericSelection);
