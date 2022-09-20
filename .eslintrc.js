module.exports = {
  parser: '@babel/eslint-parser',
  plugins: [
    '@babel',
    'meteor',
  ],
  env: {
    meteor: true,
    browser: true,
    es2020: true,
    node: true,
  },
  extends: ['airbnb-base', 'plugin:meteor/recommended'],
  parserOptions: {
    sourceType: 'module',
    requireConfigFile: false,
  },
  rules: {
    'no-promise-executor-return': 'off',
    'function-call-argument-newline': 'off',
    'function-paren-newline': 'off',
    'default-param-last': 'off',
    'no-multiple-empty-lines': 'off',
    'meteor/no-session': 'off',
    'import/no-unresolved': 0,
    'object-curly-newline': 0,
    quotes: ['error', 'single', { allowTemplateLiterals: true }],
    'object-shorthand': ['error', 'always'],
    'newline-per-chained-call': 0,
    // "no-lonely-if": 0,
    'prefer-destructuring': ['error', { object: true, array: false }],
    'no-empty': ['error', { allowEmptyCatch: true }],
    // "no-console": 0,
    'max-len': 0,
    'func-names': 0,
    // "key-spacing": 0,
    'no-param-reassign': 0,
    // "no-prototype-builtins": 0,
    // "prefer-arrow-callback": 0,
    'new-cap': [2, {
      newIsCap: true,
      capIsNewExceptions: ['Match.OneOf', 'Match.Optional', 'Match.ObjectIncluding', 'Match.Where', 'Match.Maybe', 'HTML.Raw', 'CryptoJS.MD5', 'DateTimeFormat'],
    }],
    // "no-nested-ternary": 0,
    'no-eval': 0,
    'arrow-parens': ['error', 'as-needed'],
    'no-mixed-operators': 'error',
    'no-bitwise': 0,
    'no-plusplus': 0,
    'no-else-return': 0,
    'no-underscore-dangle': 0,
    'operator-linebreak': ['error', 'after'],
  },
  globals: {
    // Meteor
    AccountsGuest: 'readonly',
    Picker: 'readonly',
    FlowRouter: 'readonly',
    BlazeLayout: 'readonly',
    SyncedCron: 'readonly',
    marked: 'readonly',
    AutoForm: 'readonly',
    BrowserPolicy: 'readonly',
    UAParser: 'readonly',
    LocalStore: 'readonly',
    CryptoJS: 'readonly',
    Papa: 'readonly',
    OAuth: 'readonly',
    Facts: 'readonly',
    moment: 'readonly',
    FilesCollection: 'readonly',
    Reload: 'writable',
    hotkeys: 'readonly',
    l: 'writable',
    log: 'writable',
    error: 'writable',
    lp: 'writable',
    throttle: 'writable',

    Assets: 'writable',
    Tilesets: 'writable',
    Characters: 'writable',
    Entities: 'writable',
    Tiles: 'writable',
    Zones: 'writable',
    Levels: 'writable',
    Files: 'writable',
    Notifications: 'writable',
    Messages: 'writable',
    Guilds: 'writable',
    Items: 'writable',
    Quests: 'writable',
    canAccessQuest: 'writable',
    remote: 'writable',
    _: 'readable',
    stats: 'writable',
    kebabCase: 'writable',
    entityActionType: 'writable',
    notify: 'writable',
    openConsole: 'writable',
    closeConsole: 'writable',
    createQuestDraft: 'writable',

    analytics: 'writable',
    game: 'writable',
    createLevel: 'writable',
    chest: 'writable',
    click: 'writable',
    beep: 'writable',
    buzz: 'writable',
    unlock: 'writable',
    deleteLevel: 'writable',
    zoom: 'writable',
    selectedTileset: 'writable',
    selectedCharactersPart: 'writable',
    findFirstCharacters: 'writable',
    tilesets: 'writable',
    layers: 'writable',
    peer: 'writable',
    settings: 'writable',
    meet: 'writable',
    meetLowLevel: 'writable',
    meetHighLevel: 'writable',
    savePlayer: 'writable',
    zoneManager: 'writable',
    notificationMessage: 'writable',
    nippleManager: 'writable',
    userChatCircle: 'writable',
    userProximitySensor: 'writable',
    userVoiceRecorderAbility: 'writable',
    charactersParts: 'writable',
    characterPopIns: 'writable',
    capitalize: 'writable',
    generateTURNCredentials: 'writable',
    isModalOpen: 'writable',
    closeModal: 'writable',
    toggleModal: 'writable',
    toggleUserProperty: 'writable',
    scopes: 'writable',
    destroyVideoSource: 'writable',
    waitFor: 'writable',
    userStreams: 'writable',
    streamTypes: 'writable',
    generateRandomAvatarURLForUser: 'writable',
    levelManager: 'writable',
    userManager: 'writable',
    entityManager: 'writable',
    editorModes: 'writable',
    viewportModes: 'writable',
    teleportUserInLevel: 'writable',
    sendEvent: 'writable',
    CharacterReaction: 'writable',
    sendAudioChunksToNearUsers: 'writable',
    sendAudioChunksToUsersInZone: 'writable',
    switchEntityState: 'writable',
    activityType: 'writable',
    callHooks: 'writable',
    createFakeShadow: 'writable',
    userLevel: 'writable',
    spawnEntityFromPrefab: 'writable',
    levelSpawnPosition: 'writable',

    relativePositionToCamera: 'writable',
    updateViewport: 'writable',
    sendDataToUsers: 'writable',
    sendDataToUsersInZone: 'writable',

    BootScene: 'writable',
    EditorScene: 'writable',
    LoadingScene: 'writable',
    WorldScene: 'writable',
    UIScene: 'writable',

    eventTypes: 'writable',

    addToInventory: 'writable',
    removeFromInventory: 'writable',

    importSpritesheetFramesAsEntities: 'writable',
    rewriteSpritesheet: 'writable',
    spritesheetValid: 'writable',

    messagesModule: 'writable',
    nearUserIdsToString: 'writable',
    registerModules: 'writable',
    registerTeamModules: 'writable',
    registerUserListModules: 'writable',
    registerRadialMenuModules: 'writable',
  },
};
