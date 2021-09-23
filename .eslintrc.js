module.exports = {
  parser: '@babel/eslint-parser',
  plugins: [
    '@babel',
  ],
  env: {
    meteor: true,
    browser: true,
    es2020: true,
    node: true,
  },
  extends: ['airbnb-base'],
  parserOptions: {
    sourceType: 'module',
    requireConfigFile: false,
  },
  rules: {
    'object-curly-newline': 0,
    quotes: ['error', 'single', { allowTemplateLiterals: true }],
    'object-shorthand': ['error', 'always'],
    'newline-per-chained-call': 0,
    // "no-lonely-if": 0,
    'prefer-destructuring': ['error', { object: true, array: false }],
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-console': 0,
    'max-len': 0,
    'func-names': 0,
    // "key-spacing": 0,
    'no-param-reassign': 0,
    // "no-prototype-builtins": 0,
    // "prefer-arrow-callback": 0,
    'new-cap': [2, {
      newIsCap: true,
      capIsNewExceptions: ['Match.OneOf', 'Match.Optional', 'Match.Where', 'Match.Maybe', 'HTML.Raw', 'CryptoJS.MD5', 'DateTimeFormat'],
    }],
    // "no-nested-ternary": 0,
    'no-eval': 0,
    'arrow-parens': ['error', 'as-needed'],
    'no-mixed-operators': 0,
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

    Tilesets: 'writable',
    Characters: 'writable',
    Tiles: 'writable',
    Zones: 'writable',
    Levels: 'writable',
    Files: 'writable',
    Notifications: 'writable',
    nearestDuration: 'writable',
    isEditionAllowed: 'writable',
    remote: 'writable',
    _: 'readable',

    game: 'writable',
    zoom: 'writable',
    selectedTileset: 'writable',
    selectedCharactersPart: 'writable',
    findFirstCharacters: 'writable',
    calls: 'writable',
    remoteCalls: 'writable',
    myPeer: 'writable',
    myStream: 'writable',
    myScreenStream: 'writable',
    remoteStreamsByUsers: 'writable',
    tilesets: 'writable',
    layers: 'writable',
    undoTiles: 'writable',
    redoTiles: 'writable',
    peer: 'writable',
    settings: 'writable',
    sounds: 'writable',
    meet: 'writable',
    characterNames: 'writable',
    savePlayer: 'writable',
    zones: 'writable',
    notificationMessage: 'writable',
    nippleManager: 'writable',
    userChatCircle: 'writable',
    userProximitySensor: 'writable',
    userVoiceRecorderAbility: 'writable',
    charactersParts: 'writable',
    characterPopIns: 'writable',
    updateSkin: 'writable',
    peerConfig: 'writable',
    generateTURNCredentials: 'writable',
    isModalOpen: 'writable',
    scopes: 'writable',
    destroyVideoSource: 'writable',
    waitFor: 'writable',

    tileGlobalIndex: 'writable',
    tileLayer: 'writable',

    BootScene: 'writable',
    EditorScene: 'writable',
    LoadingScene: 'writable',
    WorldScene: 'writable',
  },
};
