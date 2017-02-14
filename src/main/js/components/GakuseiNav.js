import React from 'react';
import { connect } from 'react-redux';
import { Navbar, Nav, NavItem, NavbarBrand, NavDropdown, MenuItem } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';

import * as Store from '../Store';

export class GakuseiNav extends React.Component {
  constructor(props) {
    super(props);

    this.eventHandler = this.eventHandler.bind(this);
  }

  eventHandler(eventKey) {
    switch (eventKey) {
      case 1.1:
        // this.props.setGameMode('/play/guess');
        this.props.setPageByName('/select', { type: 'guess' }); break;
      case 1.2:
        this.props.setPageByName('/select', { type: 'translate' }); break;
      case 3:
        // this.props.setGameMode('/play/quiz');
        this.props.setPageByName('/select', { type: 'quiz' }); break;
      case 4:
        this.props.setPageByName('/lists'); break;
      case 5:
        this.props.setPageByName('/about'); break;
      case 6:
        this.props.setPageByName('/profile'); break;
      // case 7:
        // TODO: Fix route to login page via react router
        // switchPage('Login'); break;
      // case 8:
        // TODO: Fix logout functionality in react router
        // logout(); break;
      default:
        this.props.setPageByName('/');
    }
  }

  render() {
    return (
      <Navbar onSelect={this.eventHandler} inverse collapseOnSelect>
        <Navbar.Header>
          <NavbarBrand>
            <button className="brandButton" onClick={this.eventHandler}>
              <span>
                <img height="100%" src="/img/logo/temp_gakusei_logo3.png" alt="Gakusei logo" />
              Gakusei
            </span>
            </button>
          </NavbarBrand>
          <Navbar.Toggle />
        </Navbar.Header>
        <Navbar.Collapse>
          <Nav>
            { this.props.loggedIn ? (
            <NavDropdown eventKey={1} title="Glosor" id="basic-nav-dropdown">
              <MenuItem eventKey={1.1}>Gissa ordet</MenuItem>
              <MenuItem eventKey={1.2}>Översätt ordet</MenuItem>
            </NavDropdown>
            ) : ''
          }
            { this.props.loggedIn ? <NavItem eventKey={2}>Grammatik</NavItem> : '' }
            { this.props.loggedIn ? <NavItem eventKey={3}>Quiz</NavItem> : '' }
            { this.props.loggedIn ? <NavItem eventKey={4}>Lista ord</NavItem> : '' }
            <NavItem eventKey={5}>Om Gakusei</NavItem>
          </Nav>
          <Nav pullRight>
            { this.props.loggedIn ? <NavItem eventKey={6}>Inloggad som: {props.username}</NavItem> : '' }
            { !this.props.loggedIn ? <NavItem eventKey={7}>Logga in</NavItem> : <NavItem eventKey={8}>Logga ut</NavItem>}
          </Nav>
        </Navbar.Collapse>
      </Navbar>
    );
  }
}

GakuseiNav.propTypes = {
  // action creators
  setPageByName: React.PropTypes.func.isRequired,
  loggedInUser: React.PropTypes.string.isRequired
};

// Wire up the React component to the Redux store and export it when importing this file
export default connect(
    // Selects which state properties are merged into the component's props
    state => (state.reducer),
    // Selects which action creators are merged into the component's props
    Store.actionCreators
)(GakuseiNav);
