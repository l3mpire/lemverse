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
    audio.addEventListener('canplaythrough', audio.play());
  },
};
