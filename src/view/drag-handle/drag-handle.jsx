// @flow
import { Component } from 'react';
import invariant from 'invariant';
import memoizeOne from 'memoize-one';
import rafSchedule from 'raf-schd';
// Using keyCode's for consistent event pattern matching between
// React synthetic events as well as raw browser events.
import * as keyCodes from '../key-codes';
import getWindowFromRef from '../get-window-from-ref';
import type { Position, HTMLElement } from '../../types';
import type {
  Props,
  Provided,
  MouseSensor,
  KeyboardSensor,
} from './drag-handle-types';
import createMouseSensor from './sensor/create-mouse-sensor';
import createKeyboardSensor from './sensor/create-keyboard-sensor';

const getFalse: () => boolean = () => false;

type SensorMap = {|
  mouse: MouseSensor,
  keyboard: KeyboardSensor,
  // touch: TouchSensor,
|}

export default class DragHandle extends Component {
  /* eslint-disable react/sort-comp */
  props: Props
  sensors: SensorMap = {
    mouse: createMouseSensor(this.props.callbacks),
    keyboard: createKeyboardSensor(this.props.callbacks),
    // touch: createTouchSensor(this.props.callbacks),
  }

  componentWillUnmount() {
    // TODO
  }

  componentWillReceiveProps(nextProps: Props) {
    // TODO
  }

  onKeyDown = (event: MouseEvent) => {
    const { mouse, keyboard } = this.sensors;

    // let the mouse sensor deal with it
    if (mouse.isCapturing()) {
      return;
    }

    keyboard.onKeyDown(event, this.props);
  }

  onMouseDown = (event: MouseEvent) => {
    const { mouse, keyboard } = this.sensors;

    // let the keyboard sensor deal with it
    if (keyboard.isCapturing()) {
      return;
    }

    mouse.onMouseDown(event, this.props);
  }

  onTouchStart = (event: TouchEvent) => {
    if (!this.props.canLift) {
      return;
    }

    const { mouse, keyboard, touch } = this.sensors;

    // let the keyboard sensor deal with it
    if (mouse.isCapturing() || keyboard.isCapturing()) {
      console.error('mouse or keyboard already listening when attempting to touch drag');
      return;
    }

    touch.start(event);
  }

  isSensorDragging = () =>
    Object.keys(this.sensors)
      .some((key: string) => this.sensors[key].isDragging())

  getProvided = memoizeOne((isEnabled: boolean, isDragging: boolean): ?Provided => {
    if (!isEnabled) {
      return null;
    }

    const provided: Provided = {
      onMouseDown: this.onMouseDown,
      onKeyDown: this.onKeyDown,
      onTouchStart: this.onTouchStart,
      onClick: this.sensors.mouse.onClick,
      tabIndex: 0,
      'aria-grabbed': isDragging,
      draggable: false,
      onDragStart: getFalse,
      onDrop: getFalse,
    };

    return provided;
  })

  render() {
    const { children, isEnabled } = this.props;

    return children(this.getProvided(isEnabled, this.isSensorDragging()));
  }
}
