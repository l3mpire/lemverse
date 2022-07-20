import audioManager from './audio-manager';

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
  recordingIndicatorOffset: -125,
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

  async initMediaRecorder() {
    if (this.loading) throw new Error('already loading');
    this.loading = true;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    this.stream = stream;
    this.loading = false;

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: audioManager.getSupportedType(),
      audio: true,
      video: false,
    });

    mediaRecorder.onerror = e => error(`An error has occurred during recording: ${e.message}`);
    mediaRecorder.onstop = this.onStop.bind(this);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
  },

  async start() {
    if (mediaRecorder?.state === 'recording') throw new Error('already recording');

    this.recordingIndicator.getAt(2).setText('⌛');
    await this.initMediaRecorder();

    recordedChunks = [];
    this.progress = 0;
    this.recordingIndicator.getAt(2).setText('📣');
    this.recordingIndicator.visible = true;
    mediaRecorder.start();
  },

  stop() {
    if (!mediaRecorder || mediaRecorder?.state === 'inactive') return;
    mediaRecorder?.stop();
    mediaRecorder = undefined;
    this.progress = 0;
    this.recordingIndicator.visible = false;
    this.stream?.getTracks()?.forEach(track => track.stop());
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

  update(delta) {
    if (!this.isRecording()) return;

    this.progress += delta / 1000;
    if (this.progress >= recordingMaxDuration) { this.stop(); return; }

    const progress = (360 / recordingMaxDuration) * this.progress;
    const radialProgressBar = this.recordingIndicator.getAt(0);
    radialProgressBar.clear();
    radialProgressBar.fillStyle(0x0078e7);
    radialProgressBar.slice(0, 0, this.recordingIndicatorRadius, 0, progress * (Math.PI / 180), false);
    radialProgressBar.fillPath();
  },

  setPosition(x, y, camera) {
    this.recordingIndicator.setPosition(x, y + (this.recordingIndicatorOffset * camera.zoom));
  },

  isRecording() {
    return mediaRecorder?.state === 'recording';
  },

  recordVoice(start, callback) {
    this.onSoundRecorded = callback;

    if (start && !this.isRecording()) {
      userStreams.audio(false);
      this.start();
    } else {
      userStreams.audio(Meteor.user().profile.shareAudio);
      this.stop();
    }
  },
};

const sendAudioChunksToTargets = (chunks, userIds) => {
  // Upload
  const blob = audioManager.generateBlob(chunks);
  const file = new File([blob], `audio-record.${audioManager.getExtension()}`, { type: blob.type });
  const uploadInstance = Files.insert({
    file,
    chunkSize: 'dynamic',
    meta: { source: 'voice-recorder', userIds },
  }, false);

  uploadInstance.on('end', error => {
    if (error) lp.notif.error(`Error during upload: ${error.reason}`);
  });

  uploadInstance.start();
};

sendAudioChunksToUsersInZone = async chunks => {
  const user = Meteor.user();
  const usersInZone = zones.usersInZone(zones.currentZone(user));
  const userInZoneIds = usersInZone.map(u => u._id);

  try {
    await peer.sendData(userInZoneIds, { type: 'audio', emitter: user._id, data: chunks });
    lp.notif.success(`📣 Everyone has heard your powerful voice`);
  } catch { lp.notif.warning('❌ No one is there to hear you'); }
};

sendAudioChunksToNearUsers = chunks => {
  const { nearUsers } = userProximitySensor;
  const userIds = [...new Set(_.keys(nearUsers))].filter(target => target !== Meteor.userId());
  if (!userIds.length) { lp.notif.error(`You need someone near you to whisper`); return undefined; }

  lp.notif.success('✉️ Your voice message has been sent!');
  return sendAudioChunksToTargets(chunks, userIds);
};
