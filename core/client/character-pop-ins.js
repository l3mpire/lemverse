import { formatURL, formatURLs } from './helpers';

const dispatchPopInEvent = event => {
  if (characterPopIns.onPopInEvent) characterPopIns.onPopInEvent(event);
};

characterPopIns = {
  className: 'character-pop-in',
  scene: undefined,
  dimensions: { width: 350, height: 200 },
  arrowHeight: 12,
  onPopInEvent: undefined,
  popIns: [],

  init(scene) {
    if (this.scene) this.destroy();
    this.scene = scene;

    window.document.removeEventListener(eventTypes.onPopInEvent, dispatchPopInEvent);
    window.document.addEventListener(eventTypes.onPopInEvent, dispatchPopInEvent, false);
  },

  dispatchPopInEvent(event) {
    if (this.onPopInEvent) this.onPopInEvent(event);
  },

  initFromZone(zone) {
    const config = zone.popInConfiguration || {};
    if (config.position) {
      const position = zones.computePositionFromString(zone, config.position);
      if (config.position === 'relative') {
        position.x += Number(config.x || 0);
        position.y += Number(config.y || 0);
      }

      config.x = position.x;
      config.y = position.y;
    } else config.target = userManager.getControlledCharacter();

    // allow zones to show iframe
    config.iframe = !!formatURL(zone.inlineURL);

    this.createOrUpdate(`${Meteor.userId()}-${zone._id}`, zone.inlineURL, config);
  },

  createPopIn(popInIdentifier, content, callback) {
    const popIn = this.scene.add.dom().createFromHTML(content);
    popIn.addListener('click');
    popIn.on('click', event => {
      if (event.target.classList.contains('toggle-full-screen')) popIn.node.classList.toggle('full-screen');
      if (callback) callback(event);
    });
    this.popIns[popInIdentifier] = popIn;

    return popIn;
  },

  createOrUpdate(popInIdentifier, popInContent, config = {}, callback = undefined) {
    const content = config.iframe ? this.createIframeFromURL(popInContent) : this.formatText(popInContent, config);

    let popIn = this.popIns[popInIdentifier];
    if (!popIn) popIn = this.createPopIn(popInIdentifier, content, callback);
    else if (content !== popIn.node.innerHTML) popIn.setHTML(content);

    const { style } = popIn.node;
    if (config.width) style.width = `${config.width}px`;
    if (config.height) style.height = `${config.height}px`;

    const className = config.className ? [this.className, config.className].join(' ') : this.className;
    popIn.setClassName(className);
    popIn.static = config.position || false;

    if (config.target) popIn.setData('target', config.target);
    else popIn.setData('target', { x: config.x || 0, y: config.y || 0 });
    popIn.setData('offset', config.offset || { x: 0, y: 0 });

    clearTimeout(popIn.autoCloseHandler);
    if (config.autoClose) popIn.autoCloseHandler = window.setTimeout(() => this.destroyPopIn(popInIdentifier), config.autoClose);

    return popIn;
  },

  createIframeFromURL(url) {
    return `<div class="toggle-full-screen"></div><iframe loading="lazy" src="${url}" allow="accelerometer; autoplay; encrypted-media; gyroscope;"></iframe>`;
  },

  destroyPopIn(popInIdentifier) {
    this.popIns[popInIdentifier]?.destroy();
    delete this.popIns[popInIdentifier];
  },

  destroy() {
    Object.keys(this.popIns).forEach(identifier => this.destroyPopIn(identifier));
    this.popIns = [];
  },

  find(identifier) {
    return this.popIns[identifier];
  },

  formatText(text, options = {}) {
    const user = Meteor.user();

    // parse special strings
    let newText = text.replace('{{firstname}}', user.profile.name || 'guest');
    newText = newText.replace('{{level}}', Levels.findOne(user.profile.levelId).name);

    // parse urls
    if (options.parseURL) newText = formatURLs(text, true);

    return `<p class="${options.classList || ''}">${newText}</p>`;
  },

  setContent(popInIdentifier, content) {
    const popIn = this.popIns[popInIdentifier];
    if (!popIn) {
      lp.notif.warning(`Pop-in "${popInIdentifier}"not found`);
      return;
    }

    popIn.setHTML(content);
  },

  update(camera) {
    Object.keys(this.popIns).forEach(identifier => {
      const popIn = this.popIns[identifier];
      const target = popIn.getData('target');
      if (!target) return;

      const offset = popIn.getData('offset');
      const x = Math.max(target.x + offset.x, popIn.displayWidth / 2);
      const y = Math.max(target.y + offset.y, popIn.displayHeight / 2);

      const position = relativePositionToCamera({ x, y }, camera);
      popIn.x = position.x;
      popIn.y = position.y - popIn.displayHeight / 2 - characterPopIns.arrowHeight;
    });
  },
};
