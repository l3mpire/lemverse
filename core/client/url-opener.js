import toggleResizable from './ui/components/resizable/resizable';

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

  openHtml(html, fullscreen = false, style = {}) {
    var iframe = this.getIframeElement();
    iframe.contentWindow.document.write(html);
    iframe.style = new String(Object.keys(style).map(key => `${key}: ${style[key]}`).join(';'));

    this.getWebpageElement().classList.add('show');

    toggleResizable('.resizableWebpage', true);
    updateViewport(game.scene.keys.WorldScene, fullscreen ? viewportModes.small : viewportModes.splitScreen);
    updateViewport(game.scene.keys.UIScene, fullscreen ? viewportModes.small : viewportModes.splitScreen);
  },

  open(url, fullscreen = false, style = {}) {
    const allowAttributesRequired = isYoutubeURL(url);
    const urlToLoad = allowAttributesRequired ? generateEmbeddedYoutubeURL(url) : url;

    if (allowAttributesRequired) this.getIframeElement().allow = iframeAllowAttributeSettings;

    var iframe = this.getIframeElement();
    iframe.src = urlToLoad;
    iframe.style = new String(Object.keys(style).map(key => `${key}: ${style[key]}`).join(';'));

    this.getWebpageElement().classList.add('show');

    toggleResizable('.resizableWebpage', true);
    updateViewport(game.scene.keys.WorldScene, fullscreen ? viewportModes.small : viewportModes.splitScreen);
    updateViewport(game.scene.keys.UIScene, fullscreen ? viewportModes.small : viewportModes.splitScreen);
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

    toggleResizable('.resizableWebpage', false);
    updateViewport(game.scene.keys.WorldScene, viewportModes.fullscreen);
    updateViewport(game.scene.keys.UIScene, viewportModes.fullscreen);
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
