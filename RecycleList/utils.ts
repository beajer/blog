export const NOOP = () => {};

// If a browser doesn't support the `options` argument to
// add/removeEventListener, we need to check, otherwise we will
// accidentally set `capture` with a truthy value.
/** 使用passive改善滚屏性能 */
export const PASSIVE: boolean | AddEventListenerOptions = (() => {
  if (typeof window === 'undefined') return false;
  let hasSupport = false;
  try {
    document.createElement('div').addEventListener('test', NOOP, {
      get passive() {
        hasSupport = true;
        return false;
      },
    });
  } catch (e) {}
  return hasSupport;
})()
  ? { passive: true }
  : false;

type TAxis = 'x' | 'y';

export enum CLIENT_SIZE_KEYS {
  x = 'clientWidth',
  y = 'clientHeight',
}
export enum CLIENT_START_KEYS {
  x = 'clientLeft',
  y = 'clientTop',
}
export enum INNER_SIZE_KEYS {
  x = 'innerWidth',
  y = 'innerHeight',
}
export enum OFFSET_SIZE_KEYS {
  x = 'offsetWidth',
  y = 'offsetHeight',
}
export enum OFFSET_START_KEYS {
  x = 'offsetLeft',
  y = 'offsetTop',
}
export enum OVERFLOW_KEYS {
  x = 'overflowX',
  y = 'overflowY',
}
export enum SCROLL_SIZE_KEYS {
  x = 'scrollWidth',
  y = 'scrollHeight',
}
export enum SCROLL_START_KEYS {
  x = 'scrollLeft',
  y = 'scrollTop',
}
export enum SIZE_KEYS {
  x = 'width',
  y = 'height',
}

export const UNSTABLE_MESSAGE = 'RecycleList failed to reach a stable state.';
export const MAX_SYNC_UPDATES = 30;

/** 获取滚动父元素  */
export const defaultScrollParentGetter: (
  c: any,
) => Window | HTMLElement = component => {
  const axis: TAxis = component.$props.axis;
  let el = component.$el;
  const overflowKey = OVERFLOW_KEYS[axis];
  while (el.parentElement) {
    el = el.parentElement;
    switch ((window.getComputedStyle(el) as any)[overflowKey]) {
      case 'auto':
      case 'scroll':
      case 'overlay':
        return el;
    }
  }
  return window;
};

/** 滚动父元素的clientHeight/clientWidth  */
export const defaultScrollParentViewportSizeGetter: (
  c: any,
) => number = component => {
  const axis: TAxis = component.$props.axis;
  const scrollParent: HTMLElement | Window = component.scrollParent;
  return scrollParent === window
    ? (window as Window)[INNER_SIZE_KEYS[axis]]
    : (scrollParent as HTMLElement)[CLIENT_SIZE_KEYS[axis]];
};

/** 滚动父容器的scrollHeight/scrollWidth  */
export const defaultScrollParentScrollSizeGetter: (
  c: any,
) => number = component => {
  const axis: TAxis = component.$props.axis;
  const scrollParent: HTMLElement | Window = component.scrollParent;
  const { body, documentElement } = document;
  const key = SCROLL_SIZE_KEYS[axis];
  return scrollParent === window
    ? Math.max(body[key], documentElement[key])
    : (scrollParent as HTMLElement)[key];
};
