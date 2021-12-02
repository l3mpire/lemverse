const waitSourceSelection = () => new Promise((resolve, reject) => {
  const modal = document.querySelector('.modal-container');
  if (!modal) { reject(new Error('modal not found')); return; }
  // todo : remove old listeners
  modal.addEventListener('window-selected', e => resolve(e.detail), false);
  modal.addEventListener('screen-share-canceled', () => reject(new Error('screen share canceled')), false);
});

/**
 * Override the default "getDisplayMedia" method with the electron one.
 */
navigator.mediaDevices.getDisplayMedia = async () => {
  let sources = await globalThis.electron.customDisplayMedia();
  sources = sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
  }));

  // show the window selection modal
  Session.set('modal', { template: 'mediaSourceSelection', sources, promise: 't' });

  // wait for modal results
  let selectedSourceId = sources[0].id;
  try {
    selectedSourceId = await waitSourceSelection();
  } catch (error) { return Promise.reject(error); }

  const mergedConstraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: selectedSourceId,
      },
    },
  };

  return navigator.mediaDevices.getUserMedia(mergedConstraints);
};
