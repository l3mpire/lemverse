/**
 * Override the default "getDisplayMedia" method with the electron one.
 */
navigator.mediaDevices.getDisplayMedia = async () => {
  const selectedSource = await globalThis.electronCustomDisplayMedia();
  const mergedConstraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: selectedSource.id,
      },
    },
  };

  return navigator.mediaDevices.getUserMedia(mergedConstraints);
};
