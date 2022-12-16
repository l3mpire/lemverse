// Ghost image for drag event
const ghost = new Image();
ghost.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';

function resize(event, element) {
  const { classList } = event.srcElement;
  const { target, pageX, pageY, clientX, clientY } = event;
  const {
    originalWidth,
    originalHeight,
    originalMouseX,
    originalMouseY,
    originalX,
    originalY,
    minimumSize,
    startPosX,
    startPosY,
  } = target.dataset;

  if (pageX === 0) {
    return;
  }

  let newWidth;
  let newHeight;
  let newLeft;
  let newTop;

  if (classList.contains('bottom-right')) {
    newWidth = parseInt(originalWidth, 10) + (pageX - originalMouseX);
    newHeight = parseInt(originalHeight, 10) + (pageY - originalMouseY);
  } else if (classList.contains('bottom-left')) {
    newHeight = parseInt(originalHeight, 10) + (pageY - originalMouseY);
    newWidth = originalWidth - (pageX - originalMouseX);
    if (newWidth > minimumSize) {
      newLeft = Math.max(parseInt(originalX, 10) + (pageX - originalMouseX), 44);
    }
  } else if (classList.contains('top-right')) {
    newWidth = parseInt(originalWidth, 10) + (pageX - originalMouseX);
    newHeight = originalHeight - (pageY - originalMouseY);

    if (newHeight > minimumSize) {
      newTop = parseInt(originalY, 10) + (pageY - originalMouseY);
    }
  } else if (classList.contains('top-left')) {
    newWidth = originalWidth - (pageX - originalMouseX);
    newHeight = originalHeight - (pageY - originalMouseY);

    if (newWidth > minimumSize) {
      newLeft = parseInt(originalX, 10) + (pageX - originalMouseX);
    }

    if (newHeight > minimumSize) {
      newTop = parseInt(originalY, 10) + (pageY - originalMouseY);
    }
  } else if (classList.contains('drag')) {
    const newPosX = startPosX - clientX;
    const newPosY = startPosY - clientY;

    target.dataset.startPosX = clientX;
    target.dataset.startPosY = clientY;

    newTop = Math.max(element.offsetTop - newPosY, 0);
    newLeft = Math.max(element.offsetLeft - newPosX, 44);
  } else if (classList.contains('width-resizer') && classList.contains('left-border')) {
    newWidth = originalWidth - (pageX - originalMouseX);
  } else if (classList.contains('width-resizer') && classList.contains('right-border')) {
    newWidth = parseInt(originalWidth, 10) + (pageX - originalMouseX);
  }

  element.style.top = newTop ? `${newTop}px` : element.style.top;
  element.style.left = newLeft ? `${newLeft}px` : element.style.left;
  element.style.width = newWidth ? `${newWidth}px` : element.style.width;
  element.style.height = newHeight ? `${newHeight}px` : element.style.height;
}

function stopResize(element) {
  element.querySelectorAll('iframe').forEach(frame => {
    frame.style.pointerEvents = 'all';
  });
}

const makeResizableDiv = containerId => {
  const element = document.querySelector(containerId);
  const resizers = element.querySelectorAll('.resizer');

  const resizeObserver = new ResizeObserver(entries => {
    for (let idx = 0; idx < entries.length; ++idx) {
      const event = new CustomEvent(eventTypes.onElementResized, { detail: entries[idx] });
      window.dispatchEvent(event);
    }
  });
  resizeObserver.observe(element);

  for (let i = 0; i < resizers.length; i++) {
    const currentResizer = resizers[i];
    currentResizer.addEventListener('dragstart', event => {
      element.querySelectorAll('iframe').forEach(frame => {
        frame.style.pointerEvents = 'none';
      });
      const boundingRect = element.getBoundingClientRect();
      const { target, pageX, pageY, clientX, clientY } = event;

      target.dataset.minimumSize = 100;
      target.dataset.originalWidth = boundingRect.width;
      target.dataset.originalHeight = boundingRect.height;
      target.dataset.originalX = boundingRect.left;
      target.dataset.originalY = boundingRect.top;
      target.dataset.originalMouseX = pageX;
      target.dataset.originalMouseY = pageY;
      target.dataset.startPosX = clientX;
      target.dataset.startPosY = clientY;

      event.dataTransfer.setDragImage(ghost, 0, 0);
    });
    currentResizer.addEventListener('drag', event => {
      resize(event, element);
    });
    currentResizer.addEventListener('dragend', () => {
      stopResize(element);
    });
  }
};


function moveToSideScreen(resizable) {
  if (Session.get('screenSide') === 'right') {
    resizable.style.right = 0;
    resizable.style.left = 'initial';
    resizable.style.width = '50%';
    // We need to set border style splitted and use $primary-color on .css side because it's not supported here
    resizable.style.borderLeftWidth = '2px';
    resizable.style.borderLeftStyle = 'solid';
    resizable.style.borderRight = 'none';
  } else {
    resizable.style.left = 0;
    resizable.style.right = 'initial';
    resizable.style.width = '50%';
    resizable.style.borderLeft = 'none';
    resizable.style.borderRightWidth = '2px';
    resizable.style.borderRightStyle = 'solid';
  }
}

// This toggle function is useful when you want to wrap a container that appear and disappear.
// Like zones, you'll have to call this function when ever you show the zone.
export default function toggleResizable(id, value) {
  document.querySelector(id).classList.toggle('show', value);
  document.querySelector(`${id} .width-resizers`).classList.toggle('show', value);

  // If we are in flexible mode and leave the zone, the corner can be visible. This is why we should remove it when we toggle the resizable function
  if (!value) {
    document.querySelectorAll(`${id} .corner-resizer`).forEach(resizer => resizer.classList.remove('show'));
  }
}

Template.resizable.onCreated(() => {
  const containerId = `.${Template.instance().data.id}`;

  window.addEventListener('onLevelLoaded', () => {
    Session.set('screenMode', 'locked');
    Session.set('screenSide', 'right');

    makeResizableDiv(containerId);
  });
});

Template.resizable.events({
  'click .resizable #locked'(event) {
    event.preventDefault();
    event.stopPropagation();

    const containerId = `.${Template.instance().data.id}`;
    const resizable = document.querySelector(containerId);
    const cornerResizers = document.querySelectorAll(`${containerId} .corner-resizer`);
    const widthResizers = document.querySelector(`${containerId} .width-resizers`);

    resizable.style.top = '25%';
    resizable.style.left = '25%';
    resizable.style.height = '50%';
    resizable.style.width = '50%';
    cornerResizers.forEach(resizer => resizer.classList.add('show'));
    widthResizers.classList.remove('show');

    Session.set('screenMode', 'unlocked');
    Session.set('screenSide', 'right');

    updateViewport(game.scene.keys.WorldScene);
    updateViewport(game.scene.keys.UIScene);
  },
  'click .resizable #unlocked'(event) {
    event.preventDefault();
    event.stopPropagation();

    const containerId = `.${Template.instance().data.id}`;
    const resizable = document.querySelector(containerId);
    const cornerResizers = document.querySelectorAll(`${containerId} .corner-resizer`);
    const widthResizers = document.querySelector(`${containerId} .width-resizers`);

    resizable.style.top = 0;
    resizable.style.right = 0;
    resizable.style.left = '50%';
    resizable.style.bottom = 0;
    resizable.style.height = '100vh';
    resizable.style.width = '50%';

    moveToSideScreen(resizable);
    cornerResizers.forEach(resizer => resizer.classList.remove('show'));
    widthResizers.classList.add('show');

    Session.set('screenMode', 'locked');

    updateViewport(game.scene.keys.WorldScene);
    updateViewport(game.scene.keys.UIScene);
  },
  'click .resizable #switch'(event) {
    event.preventDefault();
    event.stopPropagation();

    const containerId = `.${Template.instance().data.id}`;
    const resizable = document.querySelector(containerId);

    Session.get('screenSide') === 'right' ? Session.set('screenSide', 'left') : Session.set('screenSide', 'right');

    moveToSideScreen(resizable);

    updateViewport(game.scene.keys.WorldScene);
    updateViewport(game.scene.keys.UIScene);
  },
});

Template.resizable.helpers({
  screenMode: () => Session.get('screenMode'),
  screenSide: () => Session.get('screenSide'),
});
