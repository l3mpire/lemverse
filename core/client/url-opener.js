const iframeAllowAttributeSettings = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

const isYoutubeURL = url => /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu.be))(\/(?:[\w-]+\?v=|embed\/|v\/)?)([\w-]+)(\S+)?$/.test(url);

const urlOpener = {
  webpageContainer: undefined,
  webpageIframeContainer: undefined,

  open(url, fullscreen = false) {
    this.getIframeElement().src = url;
    if (isYoutubeURL(url)) this.getIframeElement().allow = iframeAllowAttributeSettings;
    this.getWebpageElement().classList.add('show');

    updateViewport(game.scene.keys.WorldScene, fullscreen ? viewportModes.small : viewportModes.splitScreen);
  },

  close() {
    const iframe = this.getIframeElement();
    if (iframe) iframe.src = '';

    const webpageElement = this.getWebpageElement();
    if (webpageElement) webpageElement.classList.remove('show');

    updateViewport(game.scene.keys.WorldScene, viewportModes.fullscreen);
  },

  getIframeElement() {
    if (!this.webpageIframeContainer) this.webpageIframeContainer = document.querySelector('#webpageIframe');
    return this.webpageIframeContainer;
  },

  getWebpageElement() {
    if (!this.webpageContainer) this.webpageContainer = document.querySelector('#webpage');
    return this.webpageContainer;
  },
};

export default urlOpener;
