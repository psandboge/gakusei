import * as Security from '../../../../shared/reducers/Security';
import * as Lessons from '../../../../shared/reducers/Lessons';
import Utility from '../../../../shared/util/Utility';
import { Col, DropdownButton, Grid, MenuItem, FormGroup, Form, Button, FormControl } from 'react-bootstrap';

import { translate } from 'react-i18next';
import { AppScreen } from '../../AppScreen';

export const Reducers = [Lessons, Security];

export class settingsScreen extends React.Component {
  constructor(props) {
    super(props);

    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleSubmitPassChange = this.handleSubmitPassChange.bind(this);
    this.getOldPassValidationState = this.getOldPassValidationState.bind(this);
    this.getNewPassValidationState = this.getNewPassValidationState.bind(this);
    this.getRepeatPassValidationState = this.getRepeatPassValidationState.bind(this);

    this.state = {
      options: {
        reading: { text: `${this.translate('gakuseiNav.jp')}` },
        swedish: { text: `${this.translate('gakuseiNav.swe')}` }
      },
      oldPassword: '',
      newPassword: '',
      repeatPassword: ''
    };
  }

  HandleSelect(languageType, input) {
    switch (languageType) {
      case 'questionLang':
        this.props.setQuestionLanguage(input);
        for (const key in this.state.options) {
          if (key !== input) {
            this.props.setAnswerLanguage(key);
          }
        }
        break;
      case 'answerLang':
        this.props.setAnswerLanguage(input);
        break;
    }
  }

  translate(input) {
    const { t, i18n } = this.props;
    return t(input);
  }

  fromLangButton() {
    const SelectionButton = props => {
      return (
        <DropdownButton
          id={props.name}
          name={props.name}
          title={props.title}
          onSelect={this.HandleSelect.bind(this, props.languageType)} //this = eventKey
        >
          {Object.keys(this.state.options).map(key => {
            if (props.languageType === 'answerLang' && key === this.props.questionType) {
              return null;
            } else {
              return (
                <MenuItem
                  key={key}
                  eventKey={key}
                >
                  {this.state.options[key].text}
                </MenuItem>
              );
            }
          })}
        </DropdownButton>
      );
    };
    return (
      <FormGroup controlId="languageSelect">
        <span>{this.translate('gakuseiSettings.defaultLanguage')}</span>

        <SelectionButton
          key={'UIlang'}
          title={this.state.options[this.props.questionType].text}
          name={'languageSelect'}
          languageType={'questionLang'}
        />
        <span> → </span>
        <SelectionButton
          key={'AnswerLang'}
          title={this.state.options[this.props.answerType].text}
          name={'languageSelect'}
          languageType={'answerLang'}
        />
      </FormGroup>
    );
  }

  getOldPassValidationState() {
    if (this.state.oldPassword.match(' ')) return 'error';
    const length = this.state.oldPassword.length;
    if (length > 1) {
      return 'success';
    } else if (length > 0) {
      return 'error';
    } else {
      return null;
    }
  }

  getNewPassValidationState() {
    if (this.state.newPassword.match(' ')) return 'error';
    const length = this.state.newPassword.length;
    if (length > 1) {
      return 'success';
    } else if (length > 0) {
      return 'error';
    } else {
      return null;
    }
  }

  getRepeatPassValidationState() {
    if (this.state.repeatPassword.match(' ')) return 'error';
    const length = this.state.repeatPassword.length;
    if (length > 1 && length < 101) {
      return 'success';
    } else if (length === 1 || length > 100) {
      return 'error';
    } else {
      return null;
    }
  }

  handleInputChange(e) {
    this.setState({
      [e.target.name]: e.target.value
    });
  }

  handleSubmitPassChange() {
    if (this.state.oldPassword === this.state.newPassword) {
      console.log('Your new password can not be the same as your old password.');
    } else if (this.state.newPassword === this.state.repeatPassword) {
      console.log(
        'Submitted password change! \nOld password: ' +
          this.state.oldPassword +
          '\nNew password: ' +
          this.state.newPassword +
          '\nRepeated password: ' +
          this.state.repeatPassword
      );
      console.log(this.props.loggedInUser);
      const formData = this.props.loggedInUser + '&' + this.state.oldPassword + '&' + this.state.newPassword;
      try {
        fetch('/changepassword', {
          method: 'post',
          body: formData
        }).then(response => {
          switch (response.status) {
            case 403:
              window.alert('Wrong password, please enter the correct password and try again.');
              break;
            case 200:
              window.alert('You have successfully changed your password.');
              break;
            default:
              console.log(response.status);
              throw new Error();
          }
        });
      } catch (error) {
        window.alert('Technical issue. please try again later.');
      }
    } else {
      console.log('Your new password does not match.');
    }
  }

  render() {
    return (
      <div>
        <Grid>
          <Col>
            <h1>{this.translate('gakuseiSettings.settings')}</h1>
            <h3>{this.translate('gakuseiSettings.languageOption')}</h3>
            <div>
              <FormGroup>{this.fromLangButton()}</FormGroup>
            </div>
          </Col>
        </Grid>
        <Grid>
          <Col>
            <h1 style={{ marginBottom: 20 }}>Change password</h1>
            <Form>
              <FormGroup
                controlId="formChangePassOld"
                validationState={this.getOldPassValidationState()}
                style={{ width: 300 }}
              >
                <FormControl
                  type="password"
                  name="oldPassword"
                  placeholder="Old password"
                  value={this.state.oldPassword}
                  onChange={this.handleInputChange}
                />
              </FormGroup>
              <FormGroup
                controlId="formChangePassNew"
                validationState={this.getNewPassValidationState()}
                style={{ width: 300 }}
              >
                <FormControl
                  type="password"
                  name="newPassword"
                  placeholder="New password"
                  value={this.state.newPassword}
                  onChange={this.handleInputChange}
                />
              </FormGroup>
              <FormGroup
                controlId="formChangePassRepeat"
                validationState={this.getRepeatPassValidationState()}
                style={{ width: 300 }}
              >
                <FormControl
                  type="password"
                  name="repeatPassword"
                  placeholder="Repeat new password"
                  value={this.state.repeatPassword}
                  onChange={this.handleInputChange}
                />
              </FormGroup>
            </Form>
          </Col>
          <Button
            type="submit"
            name="submitPassChange"
            bsStyle="success"
            onClick={this.handleSubmitPassChange}
            disabled={
              this.getOldPassValidationState() != 'success' ||
              this.getNewPassValidationState() != 'success' ||
              this.getRepeatPassValidationState() != 'success'
            }
          >
            Submit
          </Button>
        </Grid>
      </div>
    );
  }
}
settingsScreen.defaultProps = Utility.reduxEnabledDefaultProps({}, Reducers);

settingsScreen.propTypes = Utility.reduxEnabledPropTypes({}, Reducers);

export default translate('translations')(Utility.superConnect(this, Reducers)(settingsScreen));
