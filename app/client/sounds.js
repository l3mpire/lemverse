sounds = {
  play(name) {
    const dom = $(`.js-audio-${name}`)[0];
    dom.volume = 0.2;
    dom.currentTime = 0;
    dom.muted = false;
    dom.play().catch(() => error(`unable to play the sound "${name}"`));
  },
};
