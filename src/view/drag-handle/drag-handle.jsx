// @flow
import { Component } from 'react';
import memoizeOne from 'memoize-one';
// Using keyCode's for consistent event pattern matching between
// React synthetic events as well as raw browser events.
import type {
  Props,
  Provided,
  Sensor,
  MouseSensor,
  KeyboardSensor,
  TouchSensor,
} from './drag-handle-types';
import createMouseSensor from './sensor/create-mouse-sensor';
import createKeyboardSensor from './sensor/create-keyboard-sensor';
import createTouchSensor from './sensor/create-touch-sensor';

const getFalse: () => boolean = () => false;

export default class DragHandle extends Component {
  /* eslint-disable react/sort-comp */
  props: Props
  mouseSensor: MouseSensor = createMouseSensor(this.props.callbacks);
  keyboardSensor: KeyboardSensor = createKeyboardSensor(this.props.callbacks);
  touchSensor: TouchSensor = createTouchSensor(this.props.callbacks);
  sensors: Sensor[] = [
    this.mouseSensor,
    this.keyboardSensor,
    this.touchSensor,
  ];

  componentWillUnmount() {
    this.sensors.forEach((sensor: Sensor) => {
      // kill the current drag and fire a cancel event if
      const wasCapturing = sensor.isCapturing();
      const wasDragging = sensor.isDragging();

      // stop capturing
      if (wasCapturing) {
        sensor.kill();
      }
      // cancel if drag was occurring
      if (wasDragging) {
        this.props.callbacks.onCancel();
      }
    });
  }

  componentWillReceiveProps(nextProps: Props) {
    // if the application cancels a drag we need to unbind the handlers
    const isDragStopping: boolean = (this.props.isDragging && !nextProps.isDragging);

    if (!isDragStopping) {
      return;
    }

    this.sensors.forEach((sensor: Sensor) => {
      if (sensor.isCapturing()) {
        sensor.kill();
        // not firing any cancel event as the drag is already over
      }
    });
  }

  onKeyDown = (event: MouseEvent) => {
    // let the mouse sensor deal with it
    if (this.mouseSensor.isCapturing()) {
      return;
    }

    this.keyboardSensor.onKeyDown(event, this.props);
  }

  onMouseDown = (event: MouseEvent) => {
    // let the keyboard sensor deal with it
    if (this.keyboardSensor.isCapturing()) {
      return;
    }

    this.mouseSensor.onMouseDown(event, this.props);
  }

  onTouchStart = (event: TouchEvent) => {
    if (!this.props.canLift) {
      return;
    }

    // let the keyboard sensor deal with it
    if (this.mouseSensor.isCapturing() || this.keyboardSensor.isCapturing()) {
      console.error('mouse or keyboard already listening when attempting to touch drag');
      return;
    }

    this.touchSensor.onTouchStart(event, this.props);
  }

  isSensorDragging = () =>
    this.sensors.some((sensor: Sensor) => sensor.isDragging())

  getProvided = memoizeOne((isEnabled: boolean, isDragging: boolean): ?Provided => {
    if (!isEnabled) {
      return null;
    }

    const provided: Provided = {
      onMouseDown: this.onMouseDown,
      onKeyDown: this.onKeyDown,
      onTouchStart: this.onTouchStart,
      onClick: this.mouseSensor.onClick,
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
