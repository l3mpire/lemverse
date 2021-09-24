const Phaser = require('phaser');

let mediaRecorder;
let recordedChunks = [];
const minChunkSize = 1000; // ~100ms
const recordingMaxDuration = 15; // 15 seconds

userVoiceRecorderAbility = {
  loading: false,
  stream: undefined,
  onSoundRecorded: undefined,
  progress: 0,
  recordingIndicator: undefined,
  recordingIndicatorOffset: { x: 0, y: -85 },
  recordingIndicatorRadius: 30,

  init(container) {
    this.recordingIndicator = container.add.container(0, 0);
    this.recordingIndicator.visible = false;
    this.recordingIndicator.setDepth(99998);

    const radialProgressBar = container.add.graphics();
    radialProgressBar.angle = -90;
    this.recordingIndicator.add([radialProgressBar]);

    this.recordingIndicator.add([
      container.add.circle(0, 0, this.recordingIndicatorRadius * 0.7, 0x4da9ff),
      container.add.text(0, 0, '📣', { font: '22px Sans Open' }).setOrigin(0.5, 0.5).setDepth(99999),
    ]);
  },

  destroy() {
    this.recordingIndicator.destroy();
  },

  initMediaRecorder() {
    if (this.loading) return Promise.reject(new Error('already loading'));
    this.loading = true;

    return navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      this.stream = stream;
      this.loading = false;

      mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.getSupportedType(),
        audio: true,
        video: false,
      });

      mediaRecorder.onerror = e => error(`An error has occurred during recording: ${e.message}`);
      mediaRecorder.onstop = this.onStop.bind(this);
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    });
  },

  start() {
    if (mediaRecorder?.state === 'recording') return Promise.reject(new Error('already recording'));

    this.recordingIndicator.getAt(2).setText('⌛');
    return this.initMediaRecorder().then(() => {
      recordedChunks = [];
      this.progress = 0;
      this.recordingIndicator.getAt(2).setText('📣');
      this.recordingIndicator.visible = true;
      mediaRecorder.start();
    });
  },

  stop() {
    if (!mediaRecorder || mediaRecorder?.state === 'inactive') return;
    mediaRecorder?.stop();
    mediaRecorder = undefined;
    this.progress = 0;
    this.recordingIndicator.visible = false;
    this.stream?.getTracks()?.forEach(track => track.stop());
  },

  playSound(chunks) {
    const audio = new Audio();
    audio.src = this.createAudioURL(chunks);
    audio.play();
  },

  onStop() {
    if (this.onSoundRecorded && recordedChunks.length) {
      if (recordedChunks[0].size < minChunkSize) {
        lp.notif.error('❌ Your message was too small to be sent');
        return;
      }

      this.onSoundRecorded(recordedChunks);
    }
  },

  update(x, y, delta) {
    if (!this.isRecording()) return;

    this.progress += delta / 1000;
    if (this.progress >= recordingMaxDuration) { this.stop(); return; }

    const progress = 360 / recordingMaxDuration * this.progress;
    const radialProgressBar = this.recordingIndicator.getAt(0);
    radialProgressBar.clear();
    radialProgressBar.fillStyle(0x0078e7);
    // eslint-disable-next-line new-cap
    radialProgressBar.slice(0, 0, this.recordingIndicatorRadius, 0, Phaser.Math.DegToRad(progress), false);
    radialProgressBar.fillPath();

    this.recordingIndicator.setPosition(x + this.recordingIndicatorOffset.x, y + this.recordingIndicatorOffset.y);
  },

  isRecording() {
    return mediaRecorder?.state === 'recording';
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

  createAudioURL(chunks) {
    const sound = this.generateBlob(chunks);
    const audioURL = URL.createObjectURL(sound);
    audioURL.src = audioURL;

    return audioURL;
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
