const isUrl = string => {
  try { return Boolean(new URL(string)); } catch (e) { return false; }
};

characterPopIns = {
  className: 'character-pop-in',
  container: undefined,
  offset: { x: 0, y: -125 },
  dimensions: { width: 350, height: 200 },
  onPopInEvent: undefined,
  popIns: [],

  init(container) {
    if (this.container) this.destroyAll();
    this.container = container;
    window.document.addEventListener('pop-in-event', e => this.onPopInEvent && this.onPopInEvent(e), false);
  },

  createOrUpdate(userId, popInContent, config = {}) {
    const content = isUrl(popInContent) ? this.createIframeFromURL(popInContent) : popInContent;

    let characterPopIn = this.popIns[userId];
    if (!characterPopIn) {
      characterPopIn = this.container.add.dom(this.dimensions.width, this.dimensions.height).createFromHTML(content);
      characterPopIn.addListener('click');
      characterPopIn.on('click', event => {
        if (!event.target.classList.contains('toggle-full-screen')) return;
        characterPopIn.node.classList.toggle('full-screen');
      });
    } else characterPopIn.setHTML(content);

    const { style } = characterPopIn.node;
    style.width = `${config.width || this.dimensions.width}px`;
    style.height = `${config.height || this.dimensions.height}px`;
    characterPopIn.updateSize();

    const className = config.className ? [this.className, config.className].join(' ') : this.className;
    characterPopIn.setClassName(className);
    characterPopIn.visible = false;
    characterPopIn.static = config.static || false;
    characterPopIn.x = config.x || 0;
    characterPopIn.y = config.y || 0;

    this.popIns[userId] = characterPopIn;
  },

  createIframeFromURL(url) {
    return `<div class="toggle-full-screen"></div><iframe frameborder="0" src="${url}"></iframe>`;
  },

  destroy(userId) {
    const characterPopIn = this.popIns[userId];
    if (!characterPopIn) return;

    characterPopIn.destroy();
    delete this.popIns[userId];
  },

  destroyAll() {
    Object.keys(this.popIns).forEach(userId => this.destroy(userId));
    this.popIns = [];
  },

  update(userPlayer, players) {
    Object.keys(this.popIns).forEach(userId => {
      const player = userId === Meteor.userId() ? userPlayer : players[userId];
      if (!player) return;

      const characterPopIn = this.popIns[userId];
      if (!characterPopIn.static) {
        characterPopIn.x = Math.max(player.x + this.offset.x, characterPopIn.displayWidth / 2);
        characterPopIn.y = Math.max(player.y + this.offset.y, characterPopIn.displayHeight / 2);
      }
      characterPopIn.visible = true;
    });
  },
};
