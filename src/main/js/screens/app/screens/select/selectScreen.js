import {
  Button,
  Grid,
  Row,
  Col,
  FormGroup,
  FormControl,
  ControlLabel,
  Panel,
  Badge,
  ProgressBar
} from 'react-bootstrap';

import Utility from '../../../../shared/util/Utility';

import * as Lessons from '../../../../shared/reducers/Lessons';
import * as Security from '../../../../shared/reducers/Security';

import FontAwesomeIcon from '@fortawesome/react-fontawesome';
import faPlay from '@fortawesome/fontawesome-free-solid/faPlay';
import faStar from '@fortawesome/fontawesome-free-solid/faStar';

import ToggleButton from 'react-toggle-button';

export const Reducers = [Lessons, Security];

export class selectScreen extends React.Component {
  constructor(props) {
    super(props);
    this.handleLanguageSelection = this.handleLanguageSelection.bind(this);
    this.handleStarredClick = this.handleStarredClick.bind(this);
    this.handleSpacedRepetition = this.handleSpacedRepetition.bind(this);
  }

  componentDidMount() {
    window.addEventListener('keydown', this.onKeys);

    this.props.fetchLessons(this.props.match.params.type).catch(() => this.props.verifyUserLoggedIn());

    this.props.fetchUserStarredLessons().catch(() => this.props.verifyUserLoggedIn());

    this.props.fetchFavoriteLesson(this.props.match.params.type).catch(() => this.props.verifyUserLoggedIn());

    this.props.fetchaddressedQuestionsInLessons();

    if (this.props.match.params.type === 'kanji') {
      this.props.setQuestionLanguage('reading');
    }
  }

  // Triggers when we change between play types but remain in "selection" page
  componentWillReceiveProps(nextProps) {
    if (this.props.match.params.type !== nextProps.match.params.type) {
      this.props.fetchLessons(nextProps.match.params.type).catch(() => this.props.verifyUserLoggedIn());
    }
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.onKeys);
  }

  getPageHeader() {
    switch (this.props.match.params.type) {
      case 'quiz':
        return 'Quiz';
      case 'guess':
        return 'Gissa ordet';
      case 'translate':
        return 'Översätt ordet';
      case 'flashcards':
        return 'Bildkort';
      case 'kanji':
        return 'Skriv Kanji';
      case 'grammar':
        return 'Böj verb';
      default:
        throw new Error('No play type specified');
    }
  }

  getPageDescription() {
    switch (this.props.match.params.type) {
      case 'quiz':
        return 'Sätt dina kunskaper om Japan på prov genom att välja en av 4 svarsalternativ';
      case 'guess':
        return 'Välj mellan 4 svarsalternativ för den korrekta översättningen.';
      case 'translate':
        return 'Översätt det visade ordet i fritext.';
      case 'flashcards':
        return 'Träna dig själv genom att använda kort, med frågan på ena sidan och rätta svaret på den andra.';
      case 'kanji':
        return 'Försök rita kanji-tecken med korrekta drag och i rätt ordning.';
      case 'grammar':
        return 'Böj det visade ordet i fritext på angiven verbform.';
      default:
        throw new Error('No play type specified');
    }
  }

  handleLanguageSelection(event) {
    switch (event.target.name) {
      case 'selectedLesson':
        this.props.setSelectedLesson(event.target.value);
        break;
      case 'questionType':
        this.props.setQuestionLanguage(event.target.value);
        break;
      case 'answerType':
        this.props.setAnswerLanguage(event.target.value);
        break;
      default:
        break;
    }
  }

  startLesson() {
    try {
      this.props.fetchLesson(this.props.match.params.type).then(() => {
        this.props.setPageByName(`/play/${this.props.match.params.type}`);
      });
    } catch (err) {
      this.props.verifyUserLoggedIn();
    }
  }

  handleSpacedRepetition() {
    this.props.toggleSpacedRepetition();
  }

  isSpacedRepetition() {
    return this.props.spacedRepetition && this.props.spacedRepetitionModes.includes(this.props.match.params.type);
  }

  handleStarredClick(lesson) {
    this.props.starredLessons.map(userLesson => userLesson.lesson.name).includes(lesson.name)
      ? this.props.removeStarredLesson(lesson.name, this.props.match.params.type)
      : this.props.addStarredLesson(lesson.name, this.props.match.params.type);
  }

  getNumberOfRetentionQuestions(lesson) {
    if (
      this.props.addressedQuestionsInLessons &&
      this.props.addressedQuestionsInLessons[lesson.name] &&
      this.props.spacedRepetitionModes.includes(this.props.match.params.type)
    ) {
      return this.props.addressedQuestionsInLessons[lesson.name];
    }
    return { unanswered: 0, retention: 0, all: 0 };
  }

  getNumberOfFavoriteQuestions() {
    if (
      this.props.favoriteLesson &&
      this.props.favoriteLesson.nuggetData &&
      this.props.spacedRepetitionModes.includes(this.props.match.params.type)
    ) {
      return this.props.favoriteLesson.nuggetData;
    }
    return { unanswered: 0, retention: 0, all: 0 };
  }

  isLessonFinished(lesson) {
    if (!this.props.addressedQuestionsInLessons) {
      return false;
    }
    return (
      this.getNumberOfRetentionQuestions(lesson).unanswered === 0 &&
      this.getNumberOfRetentionQuestions(lesson).retention === 0
    );
  }

  isLessonStarted(lesson) {
    if (!this.props.addressedQuestionsInLessons) {
      return true;
    }

    return !(this.getNumberOfRetentionQuestions(lesson).unanswered === this.getNumberOfRetentionQuestions(lesson).all);
  }

  renderLessons(lessons) {
    const mediumColumnSize = 6;
    const largeColumnSize = 4;
    const renderedLessons = lessons.map(lesson => (
      <Col
        key={lesson.name}
        xs={12}
        md={mediumColumnSize}
        lg={largeColumnSize}
      >
        <Panel>
          <Panel.Body>
            <div className={'exercise'}>
              <div className={'exercise__header'}>
                <h3 className={'exercise__header__title'}>
                  {lesson.name}
                  {this.isSpacedRepetition() &&
                  !this.isLessonFinished(lesson) &&
                  this.getNumberOfRetentionQuestions(lesson).retention > 0 ? (
                      <Badge className="badge--type-todo">{this.getNumberOfRetentionQuestions(lesson).retention}</Badge>
                    ) : null}
                  {this.isSpacedRepetition() &&
                  !this.isLessonFinished(lesson) &&
                  this.getNumberOfRetentionQuestions(lesson).unanswered > 0 ? (
                      <Badge className="badge--type-new">{this.getNumberOfRetentionQuestions(lesson).unanswered}</Badge>
                    ) : null}
                </h3>
                {this.props.match.params.type === 'quiz' ? null : (
                  <div className={'exercise__header__settings'}>
                    <Button
                      bsClass={
                        this.props.starredLessons.map(userLesson => userLesson.lesson.name).includes(lesson.name)
                          ? 'favorite-icon-button favorite-icon-button--active icon-button'
                          : 'favorite-icon-button icon-button'
                      }
                      onClick={e => {
                        e.stopPropagation();
                        this.handleStarredClick(lesson);
                      }}
                    >
                      <FontAwesomeIcon
                        className={'fa-fw'}
                        icon={faStar}
                      />
                    </Button>
                  </div>
                )}
              </div>
              {this.isSpacedRepetition() ? (
                <div className={'exercise__progress'}>
                  <ProgressBar
                    now={
                      100 -
                      (this.getNumberOfRetentionQuestions(lesson).retention +
                        this.getNumberOfRetentionQuestions(lesson).unanswered) /
                        this.getNumberOfRetentionQuestions(lesson).all *
                        100
                    }
                  />
                </div>
              ) : null}
              <p className={'exercise__description'}>{lesson.description}</p>
              <div className={'exercise__actions'}>
                <Button
                  onClick={e => {
                    e.stopPropagation();
                    this.props.setSelectedLesson(lesson);
                    this.startLesson();
                  }}
                  disabled={this.isSpacedRepetition() && this.isLessonFinished(lesson) && this.isLessonStarted(lesson)}
                  bsClass={'icon-button'}
                >
                  <FontAwesomeIcon
                    className={'fa-fw'}
                    icon={faPlay}
                  />
                </Button>
              </div>
            </div>
          </Panel.Body>
        </Panel>
      </Col>
    ));

    const adjustedLessons = [];
    for (let i = 0; i < renderedLessons.length; i++) {
      adjustedLessons.push(renderedLessons[i]);
      if ((i + 1) % (12 / mediumColumnSize) === 0) {
        const fixer = (<div
          key={`clearfix-md ${i}`}
          className="clearfix visible-md"
        />);
        adjustedLessons.push(fixer);
      }

      if ((i + 1) % (12 / largeColumnSize) === 0) {
        const fixer = (<div
          key={`clearfix-lg ${i}`}
          className="clearfix visible-lg"
        />);
        adjustedLessons.push(fixer);
      }
    }
    return adjustedLessons ? <Row>{adjustedLessons}</Row> : null;
  }

  render() {
    let lessonsUnfinished, lessonsFinished, lessonsUnstarted, lessonsAll;
    if (this.isSpacedRepetition()) {
      lessonsUnfinished = this.renderLessons(this.props.lessons.filter(lesson => !this.isLessonFinished(lesson)));
      lessonsFinished = this.renderLessons(
        this.props.lessons.filter(lesson => this.isLessonFinished(lesson) && this.isLessonStarted(lesson))
      );
      lessonsUnstarted = this.renderLessons(this.props.lessons.filter(lesson => !this.isLessonStarted(lesson)));
    } else {
      lessonsAll = this.renderLessons(this.props.lessons);
    }

    const favoriteLesson = (
      <Row>
        <Col
          xs={12}
          md={12}
          lg={12}
        >
          <Panel>
            <Panel.Body>
              <div className={'exercise'}>
                <div className={'exercise__header'}>
                  <h3 className={'exercise__header__title'}>
                    {'Blandade frågor.'}
                    {this.isSpacedRepetition() && this.getNumberOfFavoriteQuestions().retention > 0 ? (
                      <Badge className="badge--type-todo">{this.getNumberOfFavoriteQuestions().retention}</Badge>
                    ) : null}
                    {this.isSpacedRepetition() && this.getNumberOfFavoriteQuestions().unanswered > 0 ? (
                      <Badge className="badge--type-new">{this.getNumberOfFavoriteQuestions().unanswered}</Badge>
                    ) : null}
                  </h3>
                </div>
                {this.isSpacedRepetition() ? (
                  <div className={'exercise__progress'}>
                    <ProgressBar
                      now={
                        this.getNumberOfFavoriteQuestions().all > 0
                          ? 100 -
                            (this.getNumberOfFavoriteQuestions().retention +
                              this.getNumberOfFavoriteQuestions().unanswered) /
                              this.getNumberOfFavoriteQuestions().all *
                              100
                          : 0
                      }
                    />
                  </div>
                ) : null}
                <p className={'exercise__description'}>
                  {'Blandade frågor från alla dina favoritmarkerade lektioner.'}
                </p>
                <div className={'exercise__actions'}>
                  <Button
                    onClick={e => {
                      e.stopPropagation();
                      this.props.setSelectedLesson(this.props.favoriteLesson);
                      this.startLesson();
                    }}
                    disabled={this.props.starredLessons.length === 0}
                    bsClass={'icon-button'}
                  >
                    <FontAwesomeIcon
                      className={'fa-fw'}
                      icon={faPlay}
                    />
                  </Button>
                </div>
              </div>
            </Panel.Body>
          </Panel>
        </Col>
      </Row>
    );

    const answerLanguages = [];
    let questionLanguages = [];
    answerLanguages.push(
      <option
        key={'reading'}
        value={'reading'}
      >
        Japanska
      </option>
    );
    answerLanguages.push(
      <option
        key={'swedish'}
        value={'swedish'}
      >
        Svenska
      </option>
    );
    /* devcode: start */
    answerLanguages.push(
      <option
        key={'english'}
        value={'english'}
      >
        Engelska
      </option>
    );
    /* devcode: end */

    if (this.props.match.params.type === 'kanji') {
      questionLanguages = answerLanguages.shift();
    } else {
      questionLanguages = answerLanguages;
    }

    let languageSelection;
    if (this.props.match.params.type === 'quiz' || this.props.match.params.type === 'grammar') {
      languageSelection = <div />;
    } else {
      languageSelection = (
        <FormGroup>
          <Row>
            <Col
              xs={12}
              sm={4}
            >
              <FormGroup controlId="questionLanguageSelection">
                <ControlLabel>Frågespråk</ControlLabel>
                <FormControl
                  componentClass="select"
                  name="questionType"
                  onChange={this.handleLanguageSelection}
                  value={this.props.questionType}
                  disabled={this.props.match.params.type === 'kanji'}
                >
                  {questionLanguages}
                </FormControl>
              </FormGroup>
            </Col>
            <Col
              xs={12}
              sm={4}
            >
              <FormGroup controlId="answerLanguageSelection">
                <ControlLabel>Svarspråk</ControlLabel>
                <FormControl
                  componentClass="select"
                  name="answerType"
                  onChange={this.handleLanguageSelection}
                  value={this.props.answerType}
                >
                  {answerLanguages}
                </FormControl>
              </FormGroup>
            </Col>
            <Col
              xs={12}
              sm={4}
            >
              <FormGroup>
                <ControlLabel>Smart inlärningsläge</ControlLabel>
                <ToggleButton
                  inactiveLabel={'Av'}
                  activeLabel={'På'}
                  value={this.isSpacedRepetition()}
                  onToggle={this.handleSpacedRepetition}
                />
              </FormGroup>
            </Col>
          </Row>
        </FormGroup>
      );
    }
    return (
      <Grid>
        <Col>
          <h1>{this.getPageHeader()}</h1>
          <p>{this.getPageDescription()}</p>
          <h2>Lektioner</h2>
          {this.props.match.params.type !== 'quiz' && this.props.match.params.type !== 'grammar'
            ? favoriteLesson
            : null}
          {this.isSpacedRepetition() ? (
            <div>
              {lessonsUnfinished ? <h3>Pågående lektioner</h3> : null}
              {lessonsUnfinished}

              {lessonsUnstarted ? <h3>Ej påbörjade lektioner</h3> : null}
              {lessonsUnstarted}

              {lessonsFinished ? <h3>Färdiga lektioner</h3> : null}
              {lessonsFinished}
            </div>
          ) : (
            lessonsAll
          )}
          {languageSelection}
        </Col>
      </Grid>
    );
  }
}

selectScreen.defaultProps = Utility.reduxEnabledDefaultProps({}, Reducers);

selectScreen.propTypes = Utility.reduxEnabledPropTypes({}, Reducers);

export default Utility.superConnect(this, Reducers)(selectScreen);
