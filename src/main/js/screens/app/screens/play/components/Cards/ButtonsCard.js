import AnswerButtonSet from '../AnswerButtonSet';
import DisplayQuestion from '../../../../shared/DisplayQuestion';
import AnswerButton from '../AnswerButton';
import React from 'react';

class ButtonsCard extends React.Component {
  constructor(props) {
    super(props);

    /* devcode:start */
    this.onKeys = function(event) {
      const keyDown = event.key;
      if (!this.props.buttonsDisabled) {
        if (keyDown === '0') {
          this.props.clickCallback(this.props.question.correctAlternative[0], this.props);
        }
      }
    }.bind(this);
    /* devcode:end */
  }

  componentDidMount() {
    /* devcode:start */
    window.addEventListener('keydown', this.onKeys);
    /* devcode:end */
  }

  componentWillUnmount() {
    /* devcode:start */
    window.removeEventListener('keydown', this.onKeys);
    /* devcode:end */
  }

  render() {
    return (
      <div>
        <DisplayQuestion
          primaryText={this.props.question.shapes[0]}
          secondaryText={this.props.question.shapes[1] || null}
          resourceRef={this.props.question.resourceRef}
          japaneseCharacters={this.props.questionType === 'reading' && this.props.cardType !== 'quiz'}
          showSpeechButton
          showKanji
        />
        <AnswerButtonSet
          alternatives={this.props.question.randomizedAlternatives}
          buttonStyles={this.props.question.buttonStyles}
          japaneseCharacters={this.props.questionType === 'reading' && this.props.cardType !== 'quiz'}
          buttonsDisabled={this.props.buttonsDisabled}
          answerType={this.props.answerType}
          clickCallback={this.props.clickCallback}
        />
        <div style={{ width: '40%', margin: '0% auto' }}>
          <AnswerButton
            answerText={'Vet ej'}
            primaryText={'Vet ej'}
            onAnswerClick={this.props.clickCallback}
            buttonStyle={'danger'}
            buttonSize="small"
            disableButton={this.props.buttonsDisabled}
            answerType={this.props.answerType}
            name="dunnobutton"
          />
        </div>
      </div>
    );
  }
}

ButtonsCard.defaultProps = {};

ButtonsCard.propTypes = {
  question: PropTypes.shape({
    shapes: PropTypes.arrayOf(PropTypes.string),
    randomizedAlternatives: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
    buttonStyles: PropTypes.arrayOf(PropTypes.string).isRequired,
    resourceRef: PropTypes.shape({
      type: PropTypes.string.isRequired,
      location: PropTypes.string.isRequired
    }),
    correctAlternative: PropTypes.array
  }).isRequired,
  buttonsDisabled: PropTypes.bool.isRequired,
  answerType: PropTypes.string.isRequired,
  questionType: PropTypes.string.isRequired,
  clickCallback: PropTypes.func.isRequired,
  cardType: PropTypes.string.isRequired
};

export default ButtonsCard;
