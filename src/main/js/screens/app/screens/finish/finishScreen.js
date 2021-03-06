import { Button, Grid, Row, ListGroup, ListGroupItem, Col } from 'react-bootstrap';
import Utility from '../../../../shared/util/Utility';
import getCSRF from '../../../../shared/util/getcsrf';
import DisplayQuestion from '../../shared/DisplayQuestion';
import * as Lessons from '../../../../shared/reducers/Lessons';
import * as Security from '../../../../shared/reducers/Security';
import { translate } from 'react-i18next';

export const Reducers = [Lessons, Security];

export class finishScreen extends React.Component {
  constructor(props) {
    super(props);
    this.playAgain = this.playAgain.bind(this);
    this.backtoSelection = this.backtoSelection.bind(this);
    this.showResults = this.showResults.bind(this);
  }

  componentDidMount() {
    // Kick user out if data is missing
    if (!this.props.answeredQuestions || this.props.answeredQuestions.length === 0) {
      if (this.props.match.params.type) {
        this.props.setPageByName(`/select/${this.props.match.params.type}`);
      } else {
        this.props.setPageByName('/home');
      }
    }
    this.logEvents();
  }

  logEvents() {
    this.props.answeredQuestions.forEach(processedQuestionWithAnswer => {
      try {
        // Send in the correct answers
        processedQuestionWithAnswer.correctAlternative.forEach(correctAlt =>
          Utility.logEvent('finish', 'correctAlternative', correctAlt, null, this.props.loggedInUser)
        );
        // Send in the user answer
        Utility.logEvent('finish', 'userAnswer', processedQuestionWithAnswer.userAnswer, null, this.props.loggedInUser);
      } catch (err) {
        this.props.requestUserLogout(this.props.location.query.currentUrl || '/', getCSRF());
      }
    });
  }

  translate(input) {
    const { t, i18n } = this.props;
    return t(input);
  }

  backtoSelection() {
    this.props
      .fetchLessons(this.props.match.params.type)
      .catch(this.props.verifyUserLoggedIn())
      .then(this.props.setPageByName(`/select/${this.props.match.params.type}`));
  }
  playAgain() {
    if (!this.props.isFetchingLesson) {
      if (this.props.selectedLesson.name !== undefined) {
        try {
          this.props.fetchLesson(this.props.match.params.type).then(() => {
            this.props.setPlayType(this.props.match.params.type);
            this.props.setPageByName(`/play/${this.props.match.params.type}`);
          });
        } catch (err) {
          this.props.verifyUserLoggedIn();
        }
      } else {
        try {
          this.props.fetchLessonIncorrectAnswers(this.props.match.params.type).then(() => {
            this.props.setPlayType(this.props.match.params.type);
            this.props.setPageByName(`/play/${this.props.match.params.type}`);
          });
        } catch (err) {
          this.props.verifyUserLoggedIn();
        }
      }
    }
  }

  isSpacedRepetition() {
    return this.props.spacedRepetition;
  }

  showResults() {
    const result = this.props.answeredQuestions.map(qa => {
      let yourAnswerText = `${this.translate('aboutGakusei.finishScreen.answer')} ${qa.correctAlternative}. `;

      if ((qa.userAnswer === null || qa.userAnswer === '') && qa.userCorrect) {
        yourAnswerText += '(Du svarade rätt)';
      } else if ((qa.userAnswer === null || qa.userAnswer === '') && !qa.userCorrect) {
        yourAnswerText += '(Du svarade fel)';
      } else {
        yourAnswerText += `${this.translate('aboutGakusei.finishScreen.youAnswered')} ${qa.userAnswer}`;
      }

      return (
        <ListGroupItem
          key={qa.userAnswer + qa.correctAlternative[0]}
          bsStyle={qa.userCorrect ? 'success' : 'danger'}
        >
          <DisplayQuestion
            primaryText={qa.shapes[0]}
            secondaryText={qa.shapes[1] || null}
            resourceRef={qa.resourceRef}
            japaneseCharacters={qa.questionType === 'reading'}
            showSpeechButton={this.props.match.params.type !== 'quiz'}
            smallerText
          />
          {yourAnswerText}
        </ListGroupItem>
      );
    });
    return result;
  }
  render() {
    return (
      <Grid>
        <Row>
          <div className="text-center">
            <h2>
              {this.props.lessonSuccessRate}
              {this.translate('aboutGakusei.finishScreen.correct')}
            </h2>
            <h3>
              {this.translate('aboutGakusei.finishScreen.rightAnswer')} {this.props.correctAttempts}{' '}
              {this.translate('aboutGakusei.finishScreen.witch')}
              {this.props.totalAttempts} {this.translate('aboutGakusei.finishScreen.sumQuestion')}
            </h3>
          </div>
        </Row>
        <Row>
          <Col
            xs={12}
            md={8}
            mdOffset={2}
          >
            <ListGroup>
              <ListGroupItem>{this.showResults()}</ListGroupItem>
            </ListGroup>
          </Col>
        </Row>
        <Row>
          <Col
            xs={12}
            md={8}
            mdOffset={2}
          >
            <div className="text-center">
              <Button
                bsStyle="info"
                className="tryAgainButton"
                onClick={e => {
                  e.stopPropagation();
                  this.playAgain();
                }}
                disabled={this.props.lessonSuccessRate === '100' || this.isSpacedRepetition()}
              >
                {this.translate('aboutGakusei.finishScreen.tryAgain')}
              </Button>{' '}
              <Button
                bsStyle="info"
                className="backToSelectScreenButton"
                onClick={this.backtoSelection}
              >
                {this.translate('aboutGakusei.finishScreen.button')}
              </Button>
            </div>
          </Col>
        </Row>
        <br />
      </Grid>
    );
  }
}

finishScreen.defaultProps = Utility.reduxEnabledDefaultProps({}, Reducers);

finishScreen.propTypes = Utility.reduxEnabledPropTypes({}, Reducers);

export default translate('translations')(Utility.superConnect(this, Reducers)(finishScreen));
