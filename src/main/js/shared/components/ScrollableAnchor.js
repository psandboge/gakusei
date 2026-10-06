import React from 'react';
import manager from './anchor/Manager';

// Native child only: Bootstrap Grid does not forward a DOM ref.
export default class ScrollableAnchor extends React.Component {
  constructor(props) {
    super(props);
    this.element = React.createRef();
  }
  componentDidMount() {
    manager.addAnchor(this.props.id, this.element.current);
  }
  componentWillUnmount() {
    manager.removeAnchor(this.props.id);
  }
  render() {
    return React.cloneElement(React.Children.only(this.props.children), { ref: this.element });
  }
}
