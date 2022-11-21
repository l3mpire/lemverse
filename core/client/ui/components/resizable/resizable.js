const makeResizableDiv = (containerId) => {
  const element = document.querySelector(containerId);
  const resizers = document.querySelectorAll(`${containerId} .resizer`);
  const minimumSize = 100;
  let originalWidth = 0;
  let originalHeight = 0;
  let originalX = 0;
  let originalY = 0;
  let originalMouseX = 0;
  let originalMouseY = 0;
  let startPosX = 0;
  let startPosY = 0;

  for (let i = 0; i < resizers.length; i++) {
    const currentResizer = resizers[i];
    currentResizer.addEventListener('mousedown', e => {
      e.preventDefault();
      originalWidth = parseFloat(getComputedStyle(element, null).getPropertyValue('width').replace('px', ''));
      originalHeight = parseFloat(getComputedStyle(element, null).getPropertyValue('height').replace('px', ''));
      originalX = element.getBoundingClientRect().left;
      originalY = element.getBoundingClientRect().top;
      originalMouseX = e.pageX;
      originalMouseY = e.pageY;
      startPosX = e.clientX;
      startPosY = e.clientY;

      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResize);
    });

    function resize(e) {
      const { classList } = currentResizer;

      if (classList.contains('bottom-right')) {
        const width = originalWidth + (e.pageX - originalMouseX);
        const height = originalHeight + (e.pageY - originalMouseY);
        if (width > minimumSize) {
          element.style.width = `${width}px`;
        }
        if (height > minimumSize) {
          element.style.height = `${height}px`;
        }
      } else if (classList.contains('bottom-left')) {
        const height = originalHeight + (e.pageY - originalMouseY);
        const width = originalWidth - (e.pageX - originalMouseX);

        if (height > minimumSize) {
          element.style.height = `${height}px`;
        }

        if (width > minimumSize) {
          element.style.width = `${width}px`;
          element.style.left = `${originalX + (e.pageX - originalMouseX)}px`;
        }
      } else if (classList.contains('top-right')) {
        const width = originalWidth + (e.pageX - originalMouseX);
        const height = originalHeight - (e.pageY - originalMouseY);

        if (width > minimumSize) {
          element.style.width = `${width}px`;
        }

        if (height > minimumSize) {
          element.style.height = `${height}px`;
          element.style.top = `${originalY + (e.pageY - originalMouseY)}px`;
        }
      } else if (classList.contains('top-left')) {
        const width = originalWidth - (e.pageX - originalMouseX);
        const height = originalHeight - (e.pageY - originalMouseY);

        if (width > minimumSize) {
          element.style.width = `${width}px`;
          element.style.left = `${originalX + (e.pageX - originalMouseX)}px`;
        }

        if (height > minimumSize) {
          element.style.height = `${height}px`;
          element.style.top = `${originalY + (e.pageY - originalMouseY)}px`;
        }
      } else if (classList.contains('drag')) {
        newPosX = startPosX - e.clientX;
        newPosY = startPosY - e.clientY;

        startPosX = e.clientX;
        startPosY = e.clientY;

        element.style.top = `${element.offsetTop - newPosY}px`;
        element.style.left = `${element.offsetLeft - newPosX}px`;
      } else if (classList.contains('width-resizer') && classList.contains('left-border')) {
        const width = originalWidth - (e.pageX - originalMouseX);

        if (width > minimumSize) {
          element.style.width = `${width}px`;
          element.style.left = `${originalX + (e.pageX - originalMouseX)}px`;
        }
      } else if (classList.contains('width-resizer') && classList.contains('right-border')) {
        const width = originalWidth + (e.pageX - originalMouseX);

        if (width > minimumSize) {
          element.style.width = `${width}px`;
        }
      }
    }

    function stopResize() {
      window.removeEventListener('mousemove', resize);
    }
  }
}


function moveToSideScreen(resizable) {
  if (Session.get('screenSide') === 'right') {
    resizable.style.right = 0;
    resizable.style.left = '50%';
    resizable.style.width = '50%';
    // We need to set border style splitted and use $primary-color on .css side because it's not supported here
    resizable.style.borderLeftWidth = '2px';
    resizable.style.borderLeftStyle = 'solid';
    resizable.style.borderRight = 'none';
  } else {
    resizable.style.left = 0;
    resizable.style.right = '50%';
    resizable.style.width = '50%';
    resizable.style.borderLeft = 'none';
    resizable.style.borderRightWidth = '2px';
    resizable.style.borderRightStyle = 'solid';
  }
}

// This toggle function is useful when you want to wrap a container that appear and disappear.
// Like zones, you'll have to call this function when ever you show the zone.
export function toggleResizable(id, value) {
  document.querySelector(id).classList.toggle('show', value);
  document.querySelector(`${id} .width-resizers`).classList.toggle('show', value);

  // If we are in flexible mode and leave the zone, the corner can be visible. This is why we should remove it when we toggle the resizable function
  if (!value) {
    document.querySelectorAll(`${id} .corner-resizer`).forEach(resizer => resizer.classList.remove('show'));
  }
}


Template.resizable.onCreated(() => {
  const containerId = `.${Template.instance().data.id}`;

  window.addEventListener('load', () => {
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
  },
  'click .resizable #switch'(event) {
    event.preventDefault();
    event.stopPropagation();

    const containerId = `.${Template.instance().data.id}`;
    const resizable = document.querySelector(containerId);

    Session.get('screenSide') === 'right' ? Session.set('screenSide', 'left') : Session.set('screenSide', 'right');

    moveToSideScreen(resizable);
  },
});

Template.resizable.helpers({
  screenMode: () => Session.get('screenMode'),
  screenSide: () => Session.get('screenSide'),
});
