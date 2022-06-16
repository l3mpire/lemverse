sounds = {
  enabled: true,
  folder: '/assets/sounds/',
  reactionsSounds: {
    '😲': 'sounds_reactions-surprise.mp3',
    '🤣': 'sounds_reactions-laughter.mp3',
    '🙁': 'sounds_reactions-boo.mp3',
    '👍': 'sounds_reactions-thumbs-up.mp3',
    '👏': 'sounds_reactions-applause.mp3',
    '🎉': 'sounds_reactions-applause.mp3',
  },

  play(name, volume = 1.0) {
    if (!name || !this.enabled) return;

    const audio = new Audio(`${this.folder}${name}`);
    audio.volume = volume;
    audio.addEventListener('canplaythrough', audio.play);
  },

  playFromChunks(chunks, volume = 1.0) {
    const audio = new Audio();
    audio.src = this.createAudioURL(chunks);
    audio.volume = volume;
    audio.addEventListener('canplaythrough', audio.play);
  },

  createAudioURL(chunks) {
    const sound = this.generateBlob(chunks);
    const audioURL = URL.createObjectURL(sound);
    audioURL.src = audioURL;

    return audioURL;
  },

  generateBlob(chunks) {
    return new Blob(chunks, { type: this.getSupportedType() });
  },

  getExtension(type) {
    if (!type) type = this.getSupportedType();
    if (type.includes('ogg')) return 'ogg';
    if (type.includes('mp4')) return 'mp4';
    if (type.includes('webm')) return 'webm';

    throw new Error('Invalid type');
  },

  /**
   * @note The type can be supported but not really, it's more like a "may be"
   * @doc https://docs.w3cub.com/dom/mediarecorder/istypesupported
   */
  getSupportedType() {
    const types = [
      'audio/mp4',
      'audio/ogg',
      'audio/ogg; codecs=opus',
      'audio/webm',
      'audio/webm; codecs=opus',
    ];

    const supportedType = types.find(type => MediaRecorder.isTypeSupported(type));
    if (!supportedType) throw new Error('Unable to find a supported type');

    return supportedType;
  },
};
