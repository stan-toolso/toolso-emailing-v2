import React, { Component } from 'react';

class ClipboardElement extends Component {
  constructor(props) {
    super(props);
    this.state = {
      markup: props.markup,
      random: (Math.random() + '').replace('.', '')
    };

    this.initClipboard = this.initClipboard.bind(this);
  }

  componentDidMount() {
    this.initClipboard();
  }

  UNSAFE_componentWillReceiveProps(props) {
    this.setState(
      {
        markup: props.markup
      },
      this.initClipboard
    );
  }

  initClipboard() {
    new window.Clipboard('.clip_' + this.state.random, {
      target: function () {
        var _this = this;

        var removeFake = function () {
          if (_this.fakeHandler) {
            document.body.removeEventListener('click', _this.fakeHandlerCallback);
            _this.fakeHandler = null;
            _this.fakeHandlerCallback = null;
          }
          if (_this.fakeElem) {
            document.body.removeChild(_this.fakeElem);
            _this.fakeElem = null;
          }
        };

        var isRTL = document.documentElement.getAttribute('dir') === 'rtl';

        removeFake();

        this.fakeHandlerCallback = function () {
          return removeFake();
        };
        this.fakeHandler = document.body.addEventListener('click', this.fakeHandlerCallback) || true;

        this.fakeElem = document.createElement('div');
        // Prevent zooming on iOS
        this.fakeElem.style.fontSize = '12pt';
        // Reset box model
        this.fakeElem.style.border = '0';
        this.fakeElem.style.padding = '0';
        this.fakeElem.style.margin = '0';
        // Move element out of screen horizontally
        this.fakeElem.style.position = 'absolute';
        this.fakeElem.style[isRTL ? 'right' : 'left'] = '-9999px';
        // Move element to the same position vertically
        var yPosition = window.pageYOffset || document.documentElement.scrollTop;
        this.fakeElem.addEventListener('focus', window.scrollTo(0, yPosition));
        this.fakeElem.style.top = yPosition + 'px';

        this.fakeElem.setAttribute('readonly', '');
        this.fakeElem.innerHTML = this.state.markup;

        document.body.appendChild(this.fakeElem);

        return this.fakeElem;
      }.bind(this)
    });
  }

  render() {
    return <span className={'clip_' + this.state.random}>{this.props.children}</span>;
  }
}

export default ClipboardElement;
