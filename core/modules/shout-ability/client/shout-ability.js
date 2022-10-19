import { moduleType } from '../../../client/helpers';

window.addEventListener('load', () => {
  registerModules([
    { id: 'shout', icon: '📢', label: 'Shout', order: 40, shortcut: 55, scope: 'me' },
    moduleType.RADIAL_MENU,
  ]);

  hotkeys('r', { keyup: true, scope: scopes.player }, event => {
    if (event.repeat) return;
    userVoiceRecorderAbility.recordVoice(event.type === 'keydown', sendAudioChunksToUsersInZone);
  });

  const onMenuOptionSelected = e => {
    const { option } = e.detail;
    if (option.id !== 'shout') return;

    userVoiceRecorderAbility.recordVoice(true, sendAudioChunksToUsersInZone);
  };

  const onMenuOptionUnselected = e => {
    const { option } = e.detail;
    if (option.id !== 'shout') return;

    userVoiceRecorderAbility.recordVoice(false, sendAudioChunksToUsersInZone);
  };

  window.addEventListener(eventTypes.onMenuOptionSelected, onMenuOptionSelected);
  window.addEventListener(eventTypes.onMenuOptionUnselected, onMenuOptionUnselected);
});
