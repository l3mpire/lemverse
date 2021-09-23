const isUrl = string => {
  try { return Boolean(new URL(string)); } catch (e) { return false; }
};

const dispatchPopInEvent = event => {
  if (characterPopIns.onPopInEvent) characterPopIns.onPopInEvent(event);
};

characterPopIns = {
  className: 'character-pop-in',
  container: undefined,
  offset: { x: 0, y: -35 }, // y = character's height / 2
  dimensions: { width: 350, height: 200 },
  arrowHeight: 12,
  onPopInEvent: undefined,
  popIns: [],

  init(container) {
    if (this.container) this.destroy();
    this.container = container;

    window.document.removeEventListener('pop-in-event', dispatchPopInEvent);
    window.document.addEventListener('pop-in-event', dispatchPopInEvent, false);
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
    }

    this.createOrUpdate(Meteor.userId(), zone._id, zone.inlineURL, config);
  },

  createOrUpdate(userId, popInIdentifier, popInContent, config = {}) {
    const content = isUrl(popInContent) ? this.createIframeFromURL(popInContent) : popInContent;

    if (!this.popIns[userId]) this.popIns[userId] = [];
    let characterPopIn = this.popIns[userId][popInIdentifier];
    if (!characterPopIn) {
      characterPopIn = this.container.add.dom(this.dimensions.width, this.dimensions.height).createFromHTML(content);
      characterPopIn.visible = false;
      characterPopIn.addListener('click');
      characterPopIn.on('click', event => {
        if (!event.target.classList.contains('toggle-full-screen')) return;
        characterPopIn.node.classList.toggle('full-screen');
      });
    } else if (content !== characterPopIn.node.innerHTML) characterPopIn.setHTML(content);

    const { style } = characterPopIn.node;
    const height = config.height || this.dimensions.height;
    style.width = `${config.width || this.dimensions.width}px`;
    style.height = `${height}px`;
    characterPopIn.updateSize();

    const className = config.className ? [this.className, config.className].join(' ') : this.className;
    characterPopIn.setClassName(className);
    characterPopIn.static = config.position || false;
    characterPopIn.x = config.x || 0;
    characterPopIn.y = (config.y || 0) - height / 2 - characterPopIns.arrowHeight;
    this.popIns[userId][popInIdentifier] = characterPopIn;
  },

  createIframeFromURL(url) {
    return `<div class="toggle-full-screen"></div><iframe frameborder="0" src="${url}"></iframe>`;
  },

  destroyPopIn(userId, popInIdentifier) {
    const characterPopIns = this.popIns[userId];
    if (!characterPopIns) return;

    const popIn = characterPopIns[popInIdentifier];
    if (!popIn) return;

    popIn.destroy();
    delete this.popIns[userId][popInIdentifier];
  },

  destroy() {
    Object.keys(this.popIns).forEach(userId => this.destroyPopIn(userId));
    this.popIns = [];
  },

  update(userPlayer, players) {
    Object.keys(this.popIns).forEach(userId => {
      const player = userId === Meteor.userId() ? userPlayer : players[userId];
      if (!player) return;

      Object.keys(this.popIns[userId]).forEach(popInIdentifier => {
        const characterPopIn = this.popIns[userId][popInIdentifier];
        if (!characterPopIn.static) {
          characterPopIn.x = Math.max(player.x + this.offset.x, characterPopIn.displayWidth / 2);
          characterPopIn.y = Math.max(player.y + this.offset.y - characterPopIn.displayHeight / 2, characterPopIn.displayHeight / 2);
        }
        characterPopIn.visible = true;
      });
    });
  },
};
