sounds = {
  play(name) {
    const dom = $(`.js-audio-${name}`)[0];
    dom.volume = 0.2;
    dom.currentTime = 0;
    dom.play();
  },
};
