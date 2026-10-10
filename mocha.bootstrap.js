/* eslint-env node */

// This file is for unit tests to work properly
// require('ignore-styles');
// ES6/ES201X-functionality
// require('babel-polyfill');
require('@babel/register')({
  // This will override `node_modules` ignoring - you can alternatively pass
  // an array of strings to be explicitly matched or a regex / glob
  ignore: [function(filename) {
    if (filename.includes('moresketchy')) {
      return false;
    } else if (filename.includes('node_modules')) {
      return true;
    } else {
      return false;
    }
  }],
  // This is a .babelrc config
  sourceMaps: 'inline',
  retainLines: true,
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current'
        }
      }
    ],
    ['@babel/preset-react', { runtime: 'automatic' }]
  ],
  babelrc: false
});

// Chai
global.assert = require('chai').assert; // Using Assert style
global.expect = require('chai').expect; // Using Expect style
require('chai').should(); // Using Should style

// DOM simulation things
// ------------------------
if (!global.dom) {
  const jsdom = require('jsdom');
  // Define some html to be our basic document
  // JSDOM will consume this and act as if we were in a browser
  const DEFAULT_HTML = '<html><body></body></html>';
  // Define some variables to make it look like we're a browser
  // First, use JSDOM's fake DOM as the document
  const dom = new jsdom.JSDOM(DEFAULT_HTML, { url: 'http://localhost/' });
  // Set up a mock window
  global.window = dom.window;
  global.document = dom.window.document;
  // Allow for things like window.location
  Object.defineProperty(global, 'navigator', { value: global.window.navigator, configurable: true });

  global.dom = dom;

  // ugly shim for react 16 to stop complaining
  if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = callback => {
      setTimeout(callback, 0);
    };
  }
}

// Put react on Window, that's what we do in the normal application (for now)
global.React = require('react');
global.ReactDOM = require('react-dom');
global.window.React = global.React;
global.window.ReactDOM = global.ReactDOM;

// Not on React 16 yet
// var Adapter = require('enzyme-adapter-react-16');
// var configure = require('enzyme').configure;
// configure({ adapter: new Adapter() });

global.PropTypes = require('prop-types');
global.IS_REACT_ACT_ENVIRONMENT = true;
// Browser constructors needed by the actual application and SweetAlert.
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.CharacterData = window.CharacterData;
global.DocumentType = window.DocumentType;
