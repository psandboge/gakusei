/* eslint-disable no-console */

import simplify from 'simplify-js';

import Geometry from '../../../../../shared/util/Geometry';

import * as rules from './DrawArea.rules';
import Canvas from './Canvas';

export default class DrawArea extends React.Component {
  constructor(props) {
    super(props);

    this.onNewUserPath = this.onNewUserPath.bind(this);

    /* devcode:start */
    this.onKeys = function(event) {
      const keyDown = event.key;
      if (keyDown === '0') {
        if (!this.props.buttonsDisabled) {
          this.onNewUserPath(this.state.correctAlternative.pathPoints[this.state.userAnswer.existingPoints.length]);
        }
      }
    }.bind(this);
    /* devcode:end */

    // Defaults
    this.defaultState = {
      correctAlternative: {
        numberPoints: [], // answerSvgNumberPoints
        pathPoints: [] // answerSvgPoints
      },

      userAnswer: {
        existingPoints: []
      }
    };
    this.state = this.defaultState;
  }

  componentDidMount() {
    /* devcode:start */
    // Cheating is fun!
    window.addEventListener('keydown', this.onKeys);
    /* devcode:end */

    // Get answer svg
    this.prepareAnswerSvg();
  }

  componentWillUpdate(nextProps) {
    if (nextProps.signToDraw !== this.props.signToDraw) {
      // New sign to draw! Reset state to default
      this.setState(this.defaultState);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.correctAlternative.pathPoints.length === 0 && prevState.correctAlternative.pathPoints.length !== 0) {
      // No answer present, reload it with new answer / svg vector data.
      this.prepareAnswerSvg();
    } else if (prevState.userAnswer.existingPoints.length !== this.state.userAnswer.existingPoints.length) {
      // A new line has been recorded, let's compare.
      this.compare();
    }
  }

  componentWillUnmount() {
    /* devcode:start */
    window.removeEventListener('keydown', this.onKeys);
    /* devcode:end */
  }

  onNewUserPath(points) {
    this.setState({
      userAnswer: {
        ...this.state.userAnswer,
        existingPoints: [...this.state.userAnswer.existingPoints, simplify(points, 2, true)]
      }
    });
  }

  getDrawActions() {
    return [
      // Draw the answer kanji lines in the background
      {
        data: {
          answerPoints: this.state.correctAlternative.pathPoints,
          existingPoints: this.state.userAnswer.existingPoints,
          difficulty: this.props.difficulty,
          vetEj: this.props.vetEj
        },
        action(canvas, data) {
          const lineColor = 'LightGray';
          const linewidth = 10;
          !['medium', 'hard'].includes(data.difficulty) ||
          data.answerPoints.length === data.existingPoints.length ||
          data.vetEj
            ? data.answerPoints.forEach((answerPoint, i) => {
              this.drawPoints(data.answerPoints[i], lineColor, linewidth);
            })
            : null;
        }
      },
      // Draw the lines the user has previously made
      {
        data: {
          existingPoints: this.state.userAnswer.existingPoints,
          highlightErrors: this.props.highlightErrors,
          matches: this.props.matches
        },
        action(canvas, data) {
          // Go into each path
          for (let i = 0; i < data.existingPoints.length; i++) {
            let lineColor = '#505050';
            const linewidth = 10;
            if (data.highlightErrors) {
              if (!data.matches[i].match.userCorrect) {
                lineColor = 'DarkRed';
              }
            }

            this.drawPoints(data.existingPoints[i], lineColor, linewidth);
          }
        }
      },
      //draw the answer lines again but thinner and another color in the forground of the users lines
      {
        data: {
          answerPoints: this.state.correctAlternative.pathPoints,
          existingPoints: this.state.userAnswer.existingPoints,
          difficulty: this.props.difficulty
        },
        action(canvas, data) {
          let lineColor = 'LightGray';
          let linewidth = 10;

          !['medium', 'hard'].includes(data.difficulty) || data.answerPoints.length === data.existingPoints.length
            ? data.answerPoints.forEach((answerPoint, i) => {
              if (i >= data.existingPoints.length) {
                lineColor = 'transparent';
                linewidth = 10;
              } else {
                lineColor = '#f97a7a';
                linewidth = 4;
              }
              this.drawPoints(data.answerPoints[i], lineColor, linewidth);
            })
            : null;
        }
      },
      // Draw the numbers associated with each kanji line, with color logic
      {
        data: {
          numberPoints: this.state.correctAlternative.numberPoints,
          answerPoints: this.state.correctAlternative.pathPoints,
          existingPoints: this.state.userAnswer.existingPoints,
          highlightErrors: this.props.highlightErrors,
          matches: this.props.matches,
          difficulty: this.props.difficulty
        },
        action(canvas, data) {
          // Answer numbers
          if (
            data.numberPoints.length > 0 &&
            (!['medium', 'hard'].includes(data.difficulty) || data.answerPoints.length === data.existingPoints.length)
          ) {
            data.numberPoints.forEach((numberPoint, i) => {
              let textColor = null;
              let boxColor = null;

              if (data.highlightErrors && !data.matches[i].match.userCorrect) {
                // Error highlighting mode, don't show next number to draw.
                boxColor = 'DarkRed';
              } else {
                const currentNumber = parseInt(numberPoint.text, 10);
                if (currentNumber === data.existingPoints.length + 1) {
                  boxColor = 'Orange';
                } else if (currentNumber < data.existingPoints.length + 1) {
                  boxColor = null;
                  textColor = 'Black';
                  // boxColor = 'LightGray';
                } else {
                  boxColor = null;
                  // boxColor = 'LightGreen';
                }
              }

              this.drawText(numberPoint, textColor, boxColor);
            });
          }
        }
      },
      // Draw the user's unfinished line
      {
        data: {},
        action(canvas, data, drawPoints) {
          this.drawPoints(drawPoints, 'Black');
        }
      }
    ];
  }

  compare() {
    if (this.state.correctAlternative.pathPoints.length > 0 && this.state.userAnswer.existingPoints.length > 0) {
      const latestUserPointIndex = this.state.userAnswer.existingPoints.length - 1;

      const data = {
        correctLine: this.state.correctAlternative.pathPoints[latestUserPointIndex],
        userLine: this.state.userAnswer.existingPoints[latestUserPointIndex],
        correctLines: this.state.correctAlternative.pathPoints,
        userLines: this.state.userAnswer.existingPoints
      };
      this.props.canvasUrlCallback(JSON.stringify(data.userLines));

      //const isLineIntersectingOtherLinesResult = rules.isLineIntersectingOtherLines({}, data);

      const isLineAccurateResult = rules.isLineAccurate(
        { requiredAccuracyPercentage: 50, strictnessPercentage: 20 },
        data
      );

      const areLinesAccurateResult = rules.areLinesAccurate(
        { requiredAccuracyPercentage: 50, strictnessPercentage: 20 },
        data
      );

      const isCorrectDirectionResult = rules.isCorrectDirection({}, data);

      // Send the comparison upward for current index
      this.props.newMatch({
        lineIndex: latestUserPointIndex,
        linesLeft: this.state.correctAlternative.pathPoints.length - (latestUserPointIndex + 1),
        validationResults: [isLineAccurateResult, areLinesAccurateResult, isCorrectDirectionResult]
        // accuracy: isLineAccurateResult.message,
        // totalAccuracy: areLinesAccurateResult.message,
        // userCorrectDirection: isCorrectDirectionResult.value
      });
    }
  }

  prepareAnswerSvg() {
    if (this.props.signToDraw) {
      const bounds = this.canvasComponent.canvas.getBoundingClientRect();

      // Convert the character to hex charcode
      const kanjiCharacter = this.props.signToDraw;
      const kanjiHexCharCode = kanjiCharacter.charCodeAt(0).toString(16);
      const svgUrl = `/img/kanji/kanjivg/0${kanjiHexCharCode}.svg`;

      fetch(svgUrl)
        .then(response => response.text())
        .then(text => {
          const data = Geometry.extractDataFromSVG(text, bounds.width, bounds.height);
          this.setState({
            correctAlternative: {
              pathPoints: data.paths,
              numberPoints: data.numbers
            }
          });
        });
    }
  }

  render() {
    return (
      <Canvas
        ref={c => {
          this.canvasComponent = c;
        }}
        newUserPath={this.onNewUserPath}
        drawActions={this.getDrawActions()}
        inputDisabled={this.props.buttonsDisabled}
      />
    );
  }
}

DrawArea.defaultProps = {
  highlightErrors: false
};

DrawArea.propTypes = {
  signToDraw: PropTypes.string.isRequired,
  matches: PropTypes.arrayOf(PropTypes.object).isRequired,
  highlightErrors: PropTypes.bool,
  newMatch: PropTypes.func.isRequired,
  buttonsDisabled: PropTypes.bool.isRequired,
  difficulty: PropTypes.string.isRequired
};
