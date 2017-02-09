/* global fetch window sessionStorage */

import React from 'react';
import { connect } from 'react-redux';
import { ButtonToolbar, Grid, Row, Col } from 'react-bootstrap';
import AnswerButton from './AnswerButton';
import Utility from '../util/Utility';
import * as SecurityStore from '../store/Security';

export class FourAlternativeQuestion extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      question: [],
      correctAlt: '',
      randomOrderAlt: ['', '', '', ''],
      buttonStyles: ['default', 'default', 'default', 'default'],
      buttonDisabled: false,
      results: [],
      lessonLength: JSON.parse(sessionStorage.lesson).length
    };
    this.checkAnswer = this.checkAnswer.bind(this);
    this.onKeys = this.onKeys.bind(this);

    sessionStorage.setItem('correctAttempts', 0);
    sessionStorage.totalAttempts = 0;
    sessionStorage.currentQuestionIndex = 0;
  }
  componentDidMount() {
    window.addEventListener('keydown', this.onKeys);
    this.setQuestion(0);
  }
  componentWillUnmount() {
    window.removeEventListener('keydown', this.onKeys);
    sessionStorage.removeItem('currentQuestionIndex');
  }
  onKeys(event) {
    const keyDown = event.key;
    if (!this.state.buttonDisabled) {
      if (keyDown === '1') {
        this.checkAnswer(this.state.randomOrderAlt[0]);
      } else if (keyDown === '2') {
        this.checkAnswer(this.state.randomOrderAlt[1]);
      } else if (keyDown === '3') {
        this.checkAnswer(this.state.randomOrderAlt[2]);
      } else if (keyDown === '4') {
        this.checkAnswer(this.state.randomOrderAlt[3]);
      }
    }
  }
  setQuestion(questionIndex) {
    this.setState({
      question: JSON.parse(sessionStorage.lesson)[questionIndex].question,
      correctAlt: JSON.parse(sessionStorage.lesson)[questionIndex].correctAlternative,
      randomOrderAlt: Utility.randomizeOrder([
        JSON.parse(sessionStorage.lesson)[questionIndex].alternative1,
        JSON.parse(sessionStorage.lesson)[questionIndex].alternative2,
        JSON.parse(sessionStorage.lesson)[questionIndex].alternative3,
        JSON.parse(sessionStorage.lesson)[questionIndex].correctAlternative]),
      buttonStyles: ['default', 'default', 'default', 'default'],
      buttonDisabled: false,
      resourceRef: JSON.parse(sessionStorage.lesson)[questionIndex].resourceReference
    }, () => {
      Utility.logEvent(this.props.pageName, 'question', this.state.question, this.props.loggedInUser);
      for (let i = 0; i < this.state.randomOrderAlt.length; i += 1) {
        Utility.logEvent(this.props.pageName, 'alternative', this.state.randomOrderAlt[i], this.props.loggedInUser);
      }
    });
  }
  getNextQuestion() {
    if (Number(sessionStorage.currentQuestionIndex) + 1 < this.state.lessonLength) {
      sessionStorage.currentQuestionIndex = Number(sessionStorage.currentQuestionIndex) + 1;
      this.setQuestion(Number(sessionStorage.currentQuestionIndex));
    } else {
      this.setState({
        buttonDisabled: true
      });
    }
  }
  checkAnswer(answer) {
    Utility.logEvent(this.props.pageName, 'userAnswer', answer, this.props.loggedInUser);
    let newButtonStyles = [];
    let answeredCorrectly = false;
    if (answer === this.state.correctAlt) {
      answeredCorrectly = true;
      newButtonStyles = this.state.randomOrderAlt.map(word => ((word === answer) ? 'success' : 'default'));
      sessionStorage.correctAttempts = Number(sessionStorage.correctAttempts) + 1;
    } else {
      newButtonStyles = this.state.randomOrderAlt.map((word) => {
        if (word === answer) {
          return 'danger';
        } else if (word === this.state.correctAlt) {
          return 'success';
        }
        return 'default';
      });
    }
    sessionStorage.totalAttempts = Number(sessionStorage.totalAttempts) + 1;
    this.setState({
      buttonDisabled: true,
      buttonStyles: newButtonStyles,
      results: this.state.results.concat([[this.state.question, this.state.correctAlt, answer]])
    });
    Utility.logEvent(this.props.pageName, 'correctAnswer', this.state.question, this.props.loggedInUser);
    Utility.logEvent(this.props.pageName, 'correctAnswer', this.state.correctAlt, this.props.loggedInUser);
    Utility.logEvent(this.props.pageName, 'answeredCorrectly', answeredCorrectly, this.props.loggedInUser);
    if (Number(sessionStorage.currentQuestionIndex) < this.state.lessonLength - 1) {
      setTimeout(() => {
        this.getNextQuestion();
      }, 1000);
    } else {
      setTimeout(
        () => this.props.switchPage('EndScreenPage', { results: this.state.results, gamemode: this.props.pageName }), 1000);
    }
  }
  displayQuestion(pageName) {
    const questionText = {
      GuessPlayPage: (
        <div>
          <h2>Läsform: {this.state.question[0]}</h2>
          <h2>Skrivform: {(this.state.question.length > 1) ? this.state.question[1] : ''}</h2>
        </div>
      ),
      QuizPlayPage: <h2>{this.state.question[0]}</h2>
    };
    let resource;
    if (this.state.resourceRef && this.state.resourceRef.type === 'kanjidrawing') {
      resource = <object height="50em" type="image/svg+xml" data={this.state.resourceRef.location}>SVG error</object>;
    }
    return resource ? <div>{resource}<br />{questionText[pageName]}</div> : questionText[pageName];
  }
  render() {
    return (
      <div>
        <Grid className="text-center">
          <Row>
            {this.displayQuestion(this.props.pageName)}
          </Row>
          <br />
          <Row>
            <ButtonToolbar>
              <Col xs={6} sm={4} smOffset={2} md={3} mdOffset={3}>
                <AnswerButton
                  label={this.state.randomOrderAlt[0]}
                  onAnswerClick={this.checkAnswer}
                  buttonStyle={this.state.buttonStyles[0]}
                  disableButton={this.state.buttonDisabled}
                />
              </Col>
              <Col xs={6} sm={4} md={3}>
                <AnswerButton
                  label={this.state.randomOrderAlt[1]}
                  onAnswerClick={this.checkAnswer}
                  buttonStyle={this.state.buttonStyles[1]}
                  disableButton={this.state.buttonDisabled}
                />
              </Col>
            </ButtonToolbar>
          </Row>
          <br />
          <Row>
            <ButtonToolbar>
              <Col xs={6} sm={4} smOffset={2} md={3} mdOffset={3}>
                <AnswerButton
                  label={this.state.randomOrderAlt[2]}
                  onAnswerClick={this.checkAnswer}
                  buttonStyle={this.state.buttonStyles[2]}
                  disableButton={this.state.buttonDisabled}
                />
              </Col>
              <Col xs={6} sm={4} md={3}>
                <AnswerButton
                  label={this.state.randomOrderAlt[3]}
                  onAnswerClick={this.checkAnswer}
                  buttonStyle={this.state.buttonStyles[3]}
                  disableButton={this.state.buttonDisabled}
                />
              </Col>
            </ButtonToolbar>
          </Row>
          <br />
          <br />
          <Row>
            <div>
              <p>
                Fråga: {Number(sessionStorage.currentQuestionIndex) + 1} / {this.state.lessonLength}
              </p>
              <p>
                {sessionStorage.correctAttempts} rätt {Utility.getSuccessRate()}
              </p>
            </div>
          </Row>
        </Grid>
      </div>
    );
  }
}

FourAlternativeQuestion.propTypes = {
  // username: React.PropTypes.string.isRequired,
  switchPage: React.PropTypes.func.isRequired,
  pageName: React.PropTypes.string.isRequired,
    // used action creators
  // fetchLoggedInUser: React.PropTypes.func.isRequired,
  // loggedIn: React.PropTypes.bool.isRequired,
  loggedInUser: React.PropTypes.string.isRequired,
  lessonSuccessRate: React.PropTypes.number.isRequired,
  lessonSuccessRateMessage: React.PropTypes.string.isRequired,
  correctAttempts: React.PropTypes.number.isRequired,
  totalAttempts: React.PropTypes.number.isRequired
};

// Wire up the React component to the Redux store and export it when importing this file
export default connect(
    state => state.security, // Selects which state properties are merged into the component's props
    { ...SecurityStore.actionCreators } // Selects which action creators are merged into the component's props
)(FourAlternativeQuestion);
