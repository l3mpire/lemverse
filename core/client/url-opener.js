const iframeAllowAttributeSettings = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

const isYoutubeURL = url => /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu.be))(\/(?:[\w-]+\?v=|embed\/|v\/)?)([\w-]+)(\S+)?$/.test(url);

const generateEmbeddedYoutubeURL = url => {
  if (!isYoutubeURL(url)) return url;
  if (url.includes('embed')) return url; // the URL is already the embedded version

  const videoID = url.split('?v=')[1];
  if (!videoID) {
    lp.notif.warning(`This Youtube URL is invalid (${url})`);
    return url;
  }

  return `https://www.youtube.com/embed/${videoID}`;
};

const urlOpener = {
  webpageContainer: undefined,
  webpageIframeContainer: undefined,

  open(url, fullscreen = false, style = {}) {
    const allowAttributesRequired = isYoutubeURL(url);
    const urlToLoad = allowAttributesRequired ? generateEmbeddedYoutubeURL(url) : url;

    if (allowAttributesRequired) this.getIframeElement().allow = iframeAllowAttributeSettings;

    var iframe = this.getIframeElement();
    iframe.src = urlToLoad;
    iframe.style = new String(Object.keys(style).map(key => `${key}: ${style[key]}`).join(';'));

    this.getWebpageElement().classList.add('show');

    updateViewport(game.scene.keys.WorldScene, fullscreen ? viewportModes.small : viewportModes.splitScreen);
  },

  close() {
    const iframe = this.getIframeElement();
    if (iframe) {
      iframe.src = '';
      iframe.allow = '';
      iframe.style = '';
    }

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
