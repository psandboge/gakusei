import React from 'react';
import ReactDOM from 'react-dom';
import { NavDropdown as BootstrapNavDropdown, DropdownButton as BootstrapDropdownButton } from 'react-bootstrap';

// Reviewed against Bootstrap 0.32.1's immediate native toggle children.
function guarded(Component) {
  return class Guard extends React.Component {
    constructor(props) {
      super(props);
      this.state = { open: !!props.defaultOpen };
      this.instance = null;
      this.toggle = null;
      this.capture = component => {
        this.instance = component;
        if (!component) this.toggle = null;
      };
      this.onToggle = (next, event, details) => {
        const native = event && (event.nativeEvent || event);
        if (details && details.source === 'rootClose' && native &&
            native.type === 'mousedown' && this.ownToggle(native)) return;
        if (this.props.open === undefined) this.setState({ open: next });
        if (this.props.onToggle) this.props.onToggle(next, event, details);
      };
    }

    acquire() {
      const root = ReactDOM.findDOMNode(this.instance);
      const nodes = root ? Array.from(root.children).filter(node =>
        ['A', 'BUTTON'].includes(node.tagName) && node.classList.contains('dropdown-toggle')) : [];
      if (nodes.length !== 1) throw Error('Cannot identify exact instance toggle');
      this.toggle = nodes[0];
    }

    componentDidMount() { this.acquire(); }
    componentDidUpdate() { this.acquire(); }
    componentWillUnmount() { this.toggle = null; this.instance = null; }

    ownToggle(event) {
      const toggle = this.toggle;
      if (!toggle || !toggle.isConnected) return false;
      const target = event.target;
      return target === toggle || !!(target && target.nodeType && toggle.contains(target)) ||
        (typeof event.composedPath === 'function' && event.composedPath().includes(toggle));
    }

    render() {
      const { defaultOpen, open, onToggle, rootCloseEvent, ...rest } = this.props;
      return React.createElement(Component, {
        ...rest,
        open: open === undefined ? this.state.open : open,
        onToggle: this.onToggle,
        rootCloseEvent: 'mousedown',
        ref: this.capture
      });
    }
  };
}

export const NavDropdown = guarded(BootstrapNavDropdown);
export const DropdownButton = guarded(BootstrapDropdownButton);
