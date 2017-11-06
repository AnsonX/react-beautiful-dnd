// @flow
/* eslint-disable no-use-before-define */
import stopEvent from '../stop-event';
import createScheduler from '../create-scheduler';
import isSloppyClickThresholdExceeded from '../is-sloppy-click-threshold-exceeded';
import isForcePress from '../util/is-force-press';
import * as keyCodes from '../../key-codes';
import blockStandardKeyEvents from '../util/block-standard-key-events';
import type {
  Position,
} from '../../../types';
import type {
  Callbacks,
  MouseSensor,
  Props,
  MouseForceChangedEvent,
} from '../drag-handle-types';

type State = {
  isDragging: boolean,
  preventClick: boolean,
  pending: ?Position,
}

// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
const primaryButton = 0;
const noop = () => { };

export default (callbacks: Callbacks): MouseSensor => {
  let state: State = {
    isDragging: false,
    pending: null,
    preventClick: false,
  };
  // TODO: flow
  const setState = (partial: $Shape<State>): void => {
    state = {
      ...state,
      ...partial,
    };
  };
  const isDragging = (): boolean => state.isDragging;
  const isCapturing = (): boolean => Boolean(state.pending || state.isDragging);
  const schedule = createScheduler(callbacks, isDragging);

  const startDragging = (fn?: Function = noop) => {
    setState({
      pending: null,
      isDragging: true,
      preventClick: true,
    });
    fn();
  };
  const stopDragging = (fn? : Function = noop) => {
    unbindWindowEvents();
    setState({
      isDragging: false,
      pending: null,
    });
    fn();
  };
  const startPendingDrag = (point: Position) => {
    setState({ pending: point, isDragging: false });
    bindWindowEvents();
  };
  const stopPendingDrag = () => {
    setState({
      preventClick: false,
    });
    stopDragging();
  };

  const kill = (fn?: Function = noop) => {
    if (state.pending) {
      stopPendingDrag();
      return;
    }
    stopDragging(fn);
  };

  const cancel = () => {
    kill(callbacks.onCancel);
  };

  const windowBindings = {
    mousemove: (event: MouseEvent) => {
      const { button, clientX, clientY } = event;
      if (button !== primaryButton) {
        return;
      }

      const point: Position = {
        x: clientX,
        y: clientY,
      };

      if (state.isDragging) {
        schedule.move(point);
        return;
      }

      if (!state.pending) {
        console.error('invalid state');
        return;
      }

      // drag is pending

      // threshold not yet exceeded
      if (!isSloppyClickThresholdExceeded(state.pending, point)) {
        return;
      }

      startDragging(() => callbacks.onLift(point));
    },
    mouseup: () => {
      if (state.pending) {
        stopPendingDrag();
        return;
      }

      stopDragging(callbacks.onDrop);
    },
    mousedown: () => {
      // this can happen during a drag when the user clicks a button
      // other than the primary mouse button
      stopDragging(callbacks.onCancel);
    },
    keydown: (event: KeyboardEvent) => {
      // cancelling
      if (event.keyCode === keyCodes.escape) {
        stopEvent(event);
        cancel();
        return;
      }

      blockStandardKeyEvents(event);
    },
    resize: cancel,
    scroll: () => {
      // stop a pending drag
      if (state.pending) {
        stopPendingDrag();
        return;
      }
      schedule.windowScrollMove();
    },
    // Need to opt out of dragging if the user is a force press
    // Only for safari which has decided to introduce its own custom way of doing things
    // https://developer.apple.com/library/content/documentation/AppleApplications/Conceptual/SafariJSProgTopics/RespondingtoForceTouchEventsfromJavaScript.html
    webkitmouseforcechanged: (event: MouseForceChangedEvent) => {
      if (isForcePress(event)) {
        cancel();
      }
    },
  };

  const eventKeys = Object.keys(windowBindings);

  const bindWindowEvents = () => {
    eventKeys.forEach((eventKey: string) => {
      if (eventKey === 'scroll') {
        window.addEventListener(eventKey, windowBindings.scroll, { passive: true });
        return;
      }

      window.addEventListener(eventKey, windowBindings[eventKey]);
    });
  };

  const unbindWindowEvents = () => {
    eventKeys.forEach((eventKey: string) =>
      window.removeEventListener(eventKey, windowBindings[eventKey])
    );
  };

  const onMouseDown = (event: MouseEvent, props: Props): void => {
    if (!props.canLift) {
      return;
    }

    if (isCapturing()) {
      console.error('should not be able to perform a mouse down while a drag or pending drag is occurring');
      cancel();
      return;
    }

    const { button, clientX, clientY } = event;

    // only starting a drag if dragging with the primary mouse button
    if (button !== primaryButton) {
      return;
    }

    stopEvent(event);
    const point: Position = {
      x: clientX,
      y: clientY,
    };

    startPendingDrag(point);
  };

  const onClick = (event: MouseEvent): void => {
    if (!state.preventClick) {
      return;
    }

    // preventing click

    // only want to prevent the first click
    setState({
      preventClick: false,
    });
    stopEvent(event);
  };

  const sensor: MouseSensor = {
    onMouseDown,
    onClick,
    kill,
    isCapturing,
    isDragging,
  };

  return sensor;
};
